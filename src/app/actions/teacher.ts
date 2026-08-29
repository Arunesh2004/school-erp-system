"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { markSchema } from "@/lib/validations"
import { verifySession } from "@/lib/auth/session"
import { logActivity } from "./logging"
import { assertMarkEntryAuthorized, requireActiveSessionId } from "@/lib/auth/teacher-authorization"

export async function upsertMark(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "TEACHER") return { error: "Unauthorized" }

  const data = Object.fromEntries(formData.entries())
  const parsed = markSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const expectedSessionId = data.expectedSessionId as string | undefined;

  try {
    const teacherUser = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { teacher: true }
    })
    const teacherId = teacherUser?.teacher?.id
    if (!teacherId) return { error: "Teacher profile not found" }

    const activeSessionId = await requireActiveSessionId()
    if (expectedSessionId && expectedSessionId !== activeSessionId) {
      return { error: "The active academic session has changed. Please reload the page." }
    }

    // NEW CANONICAL AUTHORIZATION (Correction #4)
    // Verifies: Student is enrolled + Teacher teaches this subject to that class + Session matches
    let enrollmentInfo;
    try {
      enrollmentInfo = await assertMarkEntryAuthorized(
        teacherId,
        parsed.data.studentId,
        parsed.data.subjectId,
        activeSessionId
      )
    } catch (authError: any) {
      return { error: authError.message }
    }

    // Immutability Check
    const record = await prisma.studentAcademicRecord.findUnique({
      where: { studentId_academicSessionId: { studentId: parsed.data.studentId, academicSessionId: activeSessionId } }
    })
    if (record?.status === "FINALIZED") {
      return { error: "Academic record is finalized and immutable." }
    }

    await prisma.mark.upsert({
      where: {
        studentId_subjectId_examType_academicSessionId: {
          studentId: parsed.data.studentId,
          subjectId: parsed.data.subjectId,
          examType: parsed.data.examType,
          academicSessionId: activeSessionId,
        }
      },
      update: {
        score: parsed.data.score,
        status: parsed.data.status,
      },
      create: {
        studentId: parsed.data.studentId,
        subjectId: parsed.data.subjectId,
        teacherId: teacherId,
        examType: parsed.data.examType,
        score: parsed.data.score,
        status: parsed.data.status,
        academicSessionId: activeSessionId,
      }
    })
    
    await logActivity(
      parsed.data.status === "PUBLISHED" ? "MARK_PUBLISHED" : "MARK_DRAFTED", 
      "Mark", 
      null, 
      `Scored ${parsed.data.score} in ${parsed.data.examType}`, 
      session.userId
    )

    revalidatePath("/teacher/marks")
    revalidatePath("/teacher/class", "layout")
    revalidatePath("/student", "layout")
    return { success: true }
  } catch {
    return { error: "Failed to save mark." }
  }
}

export async function bulkUpdateMarkStatus(markIds: string[], status: "PUBLISHED" | "DRAFT") {
  const session = await verifySession()
  if (!session || session.role !== "TEACHER") return { error: "Unauthorized" }

  try {
    const teacherUser = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { teacher: true }
    })
    const teacherId = teacherUser?.teacher?.id
    if (!teacherId) return { error: "Teacher profile not found" }

    const marks = await prisma.mark.findMany({ where: { id: { in: markIds }, teacherId } })
    const studentIds = [...new Set(marks.map(m => m.studentId))]

    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
    const activeSessionId = settings?.activeSessionId
    
    if (activeSessionId) {
      const finalizedRecords = await prisma.studentAcademicRecord.count({
        where: {
          studentId: { in: studentIds },
          academicSessionId: activeSessionId,
          status: "FINALIZED"
        }
      })
      if (finalizedRecords > 0) {
        return { error: "Cannot bulk update marks: one or more students have finalized academic records." }
      }
    }

    // Security check: only update marks that belong to this teacher
    await prisma.mark.updateMany({
      where: {
        id: { in: markIds },
        teacherId: teacherId
      },
      data: {
        status: status
      }
    })
    
    await logActivity(
      status === "PUBLISHED" ? "BULK_PUBLISHED_MARKS" : "BULK_DRAFTED_MARKS", 
      "Mark", 
      null, 
      `Bulk updated ${markIds.length} marks to ${status}`, 
      session.userId
    )

    revalidatePath("/teacher/marks")
    revalidatePath("/teacher/class", "layout")
    revalidatePath("/student", "layout")
    return { success: true }
  } catch {
    return { error: "Failed to bulk update marks." }
  }
}
