"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { verifySession } from "@/lib/auth/session"
import { logActivity } from "./logging"

export async function upsertAttendance(data: { studentId: string, classId: string, date: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED", remarks?: string }) {
  const session = await verifySession()
  if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
    return { error: "Unauthorized" }
  }

  // Find teacher if role is TEACHER to attach teacherId
  let teacherId = null
  if (session.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher) return { error: "Teacher profile not found" }
    teacherId = teacher.id
  } else {
    // Admin override (requires a teacher assigned to class)
    const cls = await prisma.class.findUnique({ where: { id: data.classId } })
    if (!cls?.teacherId) return { error: "Class has no assigned teacher to record attendance against." }
    teacherId = cls.teacherId
  }

  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }, include: { activeSession: true } })
    const activeSessionName = settings?.activeSession?.name
    if (activeSessionName) {
      const record = await prisma.studentAcademicRecord.findUnique({
        where: { studentId_academicSession: { studentId: data.studentId, academicSession: activeSessionName } }
      })
      if (record?.status === "FINALIZED") {
        return { error: "Academic record is finalized and immutable." }
      }
    }

    const attendanceDate = new Date(data.date)
    attendanceDate.setHours(0, 0, 0, 0) // Normalize to midnight

    const attendance = await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId: data.studentId,
          date: attendanceDate
        }
      },
      update: {
        status: data.status,
        remarks: data.remarks
      },
      create: {
        studentId: data.studentId,
        classId: data.classId,
        teacherId: teacherId,
        date: attendanceDate,
        status: data.status,
        remarks: data.remarks
      }
    })

    await logActivity("ATTENDANCE_MARKED", "Attendance", attendance.id, `Status set to ${data.status} for ${attendanceDate.toISOString().split('T')[0]}`, session.userId)

    revalidatePath("/teacher/attendance")
    revalidatePath("/admin/attendance")
    revalidatePath("/teacher/class", "layout")
    revalidatePath("/student", "layout")
    return { success: true, attendance }
  } catch (err) {
    console.error(err)
    return { error: "Failed to save attendance" }
  }
}

export async function bulkMarkPresent(classId: string, date: string, studentIds: string[]) {
  const session = await verifySession()
  if (!session || session.role !== "TEACHER") {
    return { error: "Unauthorized" }
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) return { error: "Teacher profile not found" }

  try {
    const attendanceDate = new Date(date)
    attendanceDate.setHours(0, 0, 0, 0)

    // Ensure all target students belong to the class
    const studentsInClass = await prisma.student.findMany({
      where: { id: { in: studentIds }, classId: classId }
    })
    
    if (studentsInClass.length === 0) return { error: "No valid students found" }

    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }, include: { activeSession: true } })
    const activeSessionName = settings?.activeSession?.name
    
    if (activeSessionName) {
      const finalizedRecords = await prisma.studentAcademicRecord.count({
        where: {
          studentId: { in: studentsInClass.map(s => s.id) },
          academicSession: activeSessionName,
          status: "FINALIZED"
        }
      })
      if (finalizedRecords > 0) {
        return { error: "Cannot bulk update attendance: one or more students have finalized academic records." }
      }
    }

    // Execute in transaction
    await prisma.$transaction(
      studentsInClass.map((student) => 
        prisma.attendance.upsert({
          where: {
            studentId_date: {
              studentId: student.id,
              date: attendanceDate
            }
          },
          update: {
            status: "PRESENT"
          },
          create: {
            studentId: student.id,
            classId: classId,
            teacherId: teacher.id,
            date: attendanceDate,
            status: "PRESENT"
          }
        })
      )
    )

    await logActivity("BULK_ATTENDANCE", "Attendance", classId, `Bulk marked present for ${studentsInClass.length} students on ${attendanceDate.toISOString().split('T')[0]}`, session.userId)

    revalidatePath("/teacher/attendance")
    revalidatePath("/admin/attendance")
    revalidatePath("/teacher/class", "layout")
    revalidatePath("/student", "layout")
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Failed to mark bulk attendance" }
  }
}
