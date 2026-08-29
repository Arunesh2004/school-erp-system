"use server";

import prisma from "@/lib/prisma";
import { verifySession } from "@/lib/auth/session";
import { checkEligibility, EligibilityStatus } from "@/lib/academic/grading";
import { revalidatePath } from "next/cache";

export type PromotionStudentData = {
  id: string;
  name: string;
  rollNumber: string | null;
  attendancePercentage: number;
  failedSubjectCount: number;
  recordStatus: string;
  eligibility: EligibilityStatus;
};

export async function getPromotionEligibility(sourceClassId: string): Promise<PromotionStudentData[]> {
  const session = await verifySession();
  if (!session || session.role !== "ADMIN") throw new Error("Unauthorized");

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } });
  const activeSessionId = settings?.activeSessionId;
  if (!activeSessionId) throw new Error("No active academic session found.");

  const students = await prisma.student.findMany({
    where: { classId: sourceClassId },
    include: {
      user: true,
      attendance: {
        where: { academicSessionId: activeSessionId }
      },
      marks: {
        where: { status: "PUBLISHED", academicSessionId: activeSessionId }
      },
      academicRecords: {
        where: { academicSessionId: activeSessionId }
      }
    }
  });

  return students.map(student => {
    const record = student.academicRecords[0];
    const recordStatus = record?.status || "DRAFT";
    
    const totalAttendance = student.attendance.length;
    const totalPresent = student.attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attendancePercentage = totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0;

    const failedSubjectCount = student.marks.filter(m => (m.score / m.maxScore) * 100 < 50).length;
    const hasUnpublishedRecords = recordStatus !== "PUBLISHED" && recordStatus !== "FINALIZED";

    // If record is finalized, we can use its snapshot, but for evaluation, current data is fine.
    // If it's finalized, they should be ELIGIBLE (assuming they passed), but let's re-run checkEligibility
    // Or actually, if it's finalized, they shouldn't be "hasUnpublishedRecords".
    
    const eligibility = checkEligibility(
      record?.attendancePercentage ?? attendancePercentage,
      record?.failedSubjectCount ?? failedSubjectCount,
      hasUnpublishedRecords
    );

    return {
      id: student.id,
      name: student.user.name || "Unknown",
      rollNumber: student.rollNumber,
      attendancePercentage: record?.attendancePercentage ?? attendancePercentage,
      failedSubjectCount: record?.failedSubjectCount ?? failedSubjectCount,
      recordStatus,
      eligibility
    };
  });
}

export async function promoteStudents(studentIds: string[], destinationClassId: string, expectedSessionId?: string) {
  const session = await verifySession();
  if (!session || session.role !== "ADMIN") throw new Error("Unauthorized");

  const targetClass = await prisma.class.findUnique({ where: { id: destinationClassId } });
  if (!targetClass) throw new Error("Destination class not found");

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }, include: { activeSession: true } });
  const activeSession = settings?.activeSession;
  if (!activeSession) throw new Error("No active academic session found.");

  if (expectedSessionId && expectedSessionId !== activeSession.id) {
    throw new Error("The active academic session has changed. Please reload the page.");
  }

  // Find the next session created by the admin to use as destination
  const nextSession = await prisma.academicSession.findFirst({
    where: { startDate: { gt: activeSession.startDate } },
    orderBy: { startDate: 'asc' }
  });

  if (!nextSession) {
    throw new Error("Please create the next academic session in settings before promoting students.");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update the student current class pointer
    await tx.student.updateMany({
      where: { id: { in: studentIds } },
      data: { classId: destinationClassId }
    });

    // 2. Upsert enrollment to prevent duplicates and preserve history
    for (const studentId of studentIds) {
      const existingEnrollment = await tx.studentEnrollment.findFirst({
        where: {
          studentId,
          academicSessionId: nextSession.id,
          status: "ACTIVE"
        }
      });

      if (existingEnrollment) {
        await tx.studentEnrollment.update({
          where: { id: existingEnrollment.id },
          data: { classId: destinationClassId }
        });
      } else {
        await tx.studentEnrollment.create({
          data: {
            studentId,
            classId: destinationClassId,
            academicSessionId: nextSession.id,
            status: "ACTIVE"
          }
        });
      }
    }
  });

  await prisma.activityLog.create({
    data: {
      action: "STUDENTS_PROMOTED",
      entityType: "Class",
      entityId: destinationClassId,
      details: JSON.stringify({ count: studentIds.length, destinationClassId }),
      actorId: session.userId,
    }
  });

  revalidatePath("/admin/promotions");
  revalidatePath("/teacher/class", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/admin/students");
  return { success: true };
}
