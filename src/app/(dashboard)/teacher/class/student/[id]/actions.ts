"use server"

import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { revalidatePath } from "next/cache"

import { calculateGrade } from "@/lib/academic/grading"

export async function saveRemarks(studentId: string, classId: string, academicSession: string, remarks: string) {
  const session = await verifySession()
  if (!session?.userId) return { success: false, error: "Unauthorized" }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { teacher: true }
  })

  if (dbUser?.role !== "TEACHER" || !dbUser.teacher) {
    return { success: false, error: "Forbidden" }
  }

  // Verify class ownership
  const teacherClass = await prisma.class.findFirst({
    where: { id: classId, teacherId: dbUser.teacher.id }
  })

  if (!teacherClass) {
    return { success: false, error: "Not authorized for this class" }
  }

  const existingRecord = await prisma.studentAcademicRecord.findUnique({
    where: { studentId_academicSession: { studentId, academicSession } }
  })

  if (existingRecord?.status === "FINALIZED") {
    return { success: false, error: "Record is finalized and immutable." }
  }

  try {
    await prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicSession: {
          studentId,
          academicSession
        }
      },
      update: {
        teacherRemarks: remarks
      },
      create: {
        studentId,
        classId,
        academicSession,
        teacherRemarks: remarks
      }
    })

    revalidatePath(`/teacher/class/student/${studentId}`)
    return { success: true }
  } catch (error) {
    console.error("Error saving remarks:", error)
    return { success: false, error: "Failed to save remarks" }
  }
}

export async function publishReport(
  studentId: string, 
  classId: string, 
  academicSession: string, 
  finalPercentage: number, 
  finalGrade: string, 
  remarks: string
) {
  const session = await verifySession()
  if (!session?.userId) return { success: false, error: "Unauthorized" }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { teacher: true }
  })

  if (dbUser?.role !== "TEACHER" || !dbUser.teacher) {
    return { success: false, error: "Forbidden" }
  }

  // Verify class ownership
  const teacherClass = await prisma.class.findFirst({
    where: { id: classId, teacherId: dbUser.teacher.id }
  })

  if (!teacherClass) {
    return { success: false, error: "Not authorized for this class" }
  }

  const existingRecord = await prisma.studentAcademicRecord.findUnique({
    where: { studentId_academicSession: { studentId, academicSession } }
  })

  if (existingRecord?.status === "FINALIZED") {
    return { success: false, error: "Record is finalized and immutable." }
  }

  try {
    await prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicSession: {
          studentId,
          academicSession
        }
      },
      update: {
        finalPercentage,
        finalGrade,
        teacherRemarks: remarks,
        status: "PUBLISHED",
        publishedAt: new Date()
      },
      create: {
        studentId,
        classId,
        academicSession,
        finalPercentage,
        finalGrade,
        teacherRemarks: remarks,
        status: "PUBLISHED",
        publishedAt: new Date()
      }
    })

    revalidatePath(`/teacher/class/student/${studentId}`)
    return { success: true }
  } catch (error) {
    console.error("Error publishing report:", error)
    return { success: false, error: "Failed to publish report" }
  }
}

export async function finalizeRecord(
  studentId: string, 
  classId: string, 
  academicSession: string,
  finalPercentage: number,
  finalGrade: string,
  attendancePercentage: number,
  failedSubjectCount: number,
  remarks: string
) {
  const session = await verifySession()
  if (!session?.userId) return { success: false, error: "Unauthorized" }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { teacher: true }
  })

  if (dbUser?.role !== "TEACHER" || !dbUser.teacher) {
    return { success: false, error: "Forbidden" }
  }

  const teacherClass = await prisma.class.findFirst({
    where: { id: classId, teacherId: dbUser.teacher.id }
  })

  if (!teacherClass) {
    return { success: false, error: "Not authorized for this class" }
  }

  const existingRecord = await prisma.studentAcademicRecord.findUnique({
    where: { studentId_academicSession: { studentId, academicSession } }
  })

  if (existingRecord?.status === "FINALIZED") {
    return { success: false, error: "Record is already finalized and cannot be modified." }
  }

  try {
    await prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicSession: { studentId, academicSession }
      },
      update: {
        finalPercentage,
        finalGrade,
        attendancePercentage,
        failedSubjectCount,
        teacherRemarks: remarks,
        status: "FINALIZED",
        finalizedAt: new Date()
      },
      create: {
        studentId,
        classId,
        academicSession,
        finalPercentage,
        finalGrade,
        attendancePercentage,
        failedSubjectCount,
        teacherRemarks: remarks,
        status: "FINALIZED",
        finalizedAt: new Date()
      }
    })

    await prisma.activityLog.create({
      data: {
        action: "RECORD_FINALIZED",
        entityType: "StudentAcademicRecord",
        entityId: `${studentId}_${academicSession}`,
        details: JSON.stringify({ studentId, academicSession, finalGrade }),
        actorId: dbUser.id
      }
    })

    revalidatePath(`/teacher/class/student/${studentId}`)
    return { success: true }
  } catch (error) {
    console.error("Error finalizing report:", error)
    return { success: false, error: "Failed to finalize report" }
  }
}
