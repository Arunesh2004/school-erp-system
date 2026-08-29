"use server"

import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { revalidatePath } from "next/cache"

import { calculateGrade } from "@/lib/academic/grading"
import { assertClassTeacherOwnership } from "@/lib/auth/teacher-authorization"

export async function saveRemarks(studentId: string, classId: string, academicSessionId: string, remarks: string, expectedSessionId?: string) {
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
  try {
    await assertClassTeacherOwnership(dbUser.teacher.id, classId, academicSessionId);
  } catch {
    return { success: false, error: "Not authorized for this class" }
  }

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (expectedSessionId && expectedSessionId !== activeSessionId) {
    return { success: false, error: "The active academic session has changed. Please reload the page." }
  }

  const existingRecord = await prisma.studentAcademicRecord.findUnique({
    where: { studentId_academicSessionId: { studentId, academicSessionId } }
  })

  if (existingRecord?.status === "FINALIZED") {
    return { success: false, error: "Record is finalized and immutable." }
  }

  try {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId, academicSessionId, status: "ACTIVE" }
    })

    await prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicSessionId: {
          studentId,
          academicSessionId
        }
      },
      update: {
        teacherRemarks: remarks
      },
      create: {
        studentId,
        classId,
        academicSessionId,
        enrollmentId: enrollment?.id,
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
  academicSessionId: string, 
  finalPercentage: number, 
  finalGrade: string, 
  remarks: string,
  expectedSessionId?: string
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
  try {
    await assertClassTeacherOwnership(dbUser.teacher.id, classId, academicSessionId);
  } catch {
    return { success: false, error: "Not authorized for this class" }
  }

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionIdServer = settings?.activeSessionId

  if (expectedSessionId && expectedSessionId !== activeSessionIdServer) {
    return { success: false, error: "The active academic session has changed. Please reload the page." }
  }

  const existingRecord = await prisma.studentAcademicRecord.findUnique({
    where: { studentId_academicSessionId: { studentId, academicSessionId } }
  })

  if (existingRecord?.status === "FINALIZED") {
    return { success: false, error: "Record is finalized and immutable." }
  }

  try {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId, academicSessionId, status: "ACTIVE" }
    })

    await prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicSessionId: {
          studentId,
          academicSessionId
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
        academicSessionId,
        enrollmentId: enrollment?.id,
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
  academicSessionId: string,
  finalPercentage: number,
  finalGrade: string,
  attendancePercentage: number,
  failedSubjectCount: number,
  remarks: string,
  expectedSessionId?: string
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

  try {
    await assertClassTeacherOwnership(dbUser.teacher.id, classId, academicSessionId);
  } catch {
    return { success: false, error: "Not authorized for this class" }
  }

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionIdServer = settings?.activeSessionId

  if (expectedSessionId && expectedSessionId !== activeSessionIdServer) {
    return { success: false, error: "The active academic session has changed. Please reload the page." }
  }

  const existingRecord = await prisma.studentAcademicRecord.findUnique({
    where: { studentId_academicSessionId: { studentId, academicSessionId } }
  })

  if (existingRecord?.status === "FINALIZED") {
    return { success: false, error: "Record is already finalized and cannot be modified." }
  }

  try {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId, academicSessionId, status: "ACTIVE" }
    })

    await prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicSessionId: { studentId, academicSessionId }
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
        academicSessionId,
        enrollmentId: enrollment?.id,
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
        entityId: `${studentId}_${academicSessionId}`,
        details: JSON.stringify({ studentId, academicSessionId, finalGrade }),
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
