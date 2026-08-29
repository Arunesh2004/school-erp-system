"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { verifySession } from "@/lib/auth/session"
import { logActivity } from "./logging"
import { assertClassTeacherOwnership, validateAttendanceRoster, requireActiveSessionId } from "@/lib/auth/teacher-authorization"

export async function upsertAttendance(data: { studentId: string, classId: string, date: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED", remarks?: string, expectedSessionId?: string }) {
  const session = await verifySession()
  if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
    return { error: "Unauthorized" }
  }

  const activeSessionId = await requireActiveSessionId()
  if (data.expectedSessionId && data.expectedSessionId !== activeSessionId) {
    return { error: "The active academic session has changed. Please reload the page." }
  }

  let teacherId = null
  if (session.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher) return { error: "Teacher profile not found" }
    teacherId = teacher.id

    try {
      await assertClassTeacherOwnership(teacherId, data.classId, activeSessionId)
    } catch (e: any) {
      return { error: e.message }
    }
  } else {
    // Admin override: we find the ACTIVE class teacher for the session to record attendance against
    const assignment = await prisma.classTeacherAssignment.findFirst({ 
      where: { classId: data.classId, academicSessionId: activeSessionId, isActive: true } 
    })
    if (!assignment) return { error: "Class has no active class teacher for the current session to record attendance against." }
    teacherId = assignment.teacherId
  }

  try {
    const record = await prisma.studentAcademicRecord.findUnique({
      where: { studentId_academicSessionId: { studentId: data.studentId, academicSessionId: activeSessionId } }
    })
    if (record?.status === "FINALIZED") {
      return { error: "Academic record is finalized and immutable." }
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
        remarks: data.remarks,
        academicSessionId: activeSessionId
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

export async function bulkMarkPresent(classId: string, date: string, studentIds: string[], expectedSessionId?: string) {
  const session = await verifySession()
  if (!session || session.role !== "TEACHER") {
    return { error: "Unauthorized" }
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) return { error: "Teacher profile not found" }

  const activeSessionId = await requireActiveSessionId()
  if (expectedSessionId && expectedSessionId !== activeSessionId) {
    return { error: "The active academic session has changed. Please reload the page." }
  }

  try {
    await assertClassTeacherOwnership(teacher.id, classId, activeSessionId)
  } catch (e: any) {
    return { error: e.message }
  }

  try {
    const attendanceDate = new Date(date)
    attendanceDate.setHours(0, 0, 0, 0)

    // Ensure all target students belong to the class
    const { validStudentIds } = await validateAttendanceRoster(studentIds, classId, activeSessionId)
    
    if (validStudentIds.length === 0) return { error: "No valid students found" }

    if (activeSessionId) {
      const finalizedRecords = await prisma.studentAcademicRecord.count({
        where: {
          studentId: { in: validStudentIds },
          academicSessionId: activeSessionId,
          status: "FINALIZED"
        }
      })
      if (finalizedRecords > 0) {
        return { error: "Cannot bulk update attendance: one or more students have finalized academic records." }
      }
    }

    // Execute in transaction
    await prisma.$transaction(
      validStudentIds.map((sid) => 
        prisma.attendance.upsert({
          where: {
            studentId_date: {
              studentId: sid,
              date: attendanceDate
            }
          },
          update: {
            status: "PRESENT"
          },
          create: {
            studentId: sid,
            classId: classId,
            teacherId: teacher.id,
            date: attendanceDate,
            status: "PRESENT",
            academicSessionId: activeSessionId
          }
        })
      )
    )

    await logActivity("BULK_ATTENDANCE", "Attendance", classId, `Bulk marked present for ${validStudentIds.length} students on ${attendanceDate.toISOString().split('T')[0]}`, session.userId)

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
