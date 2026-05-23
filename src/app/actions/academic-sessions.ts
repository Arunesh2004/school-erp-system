"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { AcademicSessionStatus, AcademicRecordStatus } from "@prisma/client";
import { verifySession } from "@/lib/auth/session";

export async function getSessions() {
  return prisma.academicSession.findMany({
    orderBy: { startDate: "desc" },
  });
}

export async function createSession(data: { name: string; startDate: Date; endDate: Date }) {
  const sessionUser = await verifySession();
  if (!sessionUser?.userId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.userId } });
  if (user?.role !== "ADMIN") throw new Error("Forbidden");

  // Create as ARCHIVED by default, they must manually activate it
  const session = await prisma.academicSession.create({
    data: {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      status: "ARCHIVED",
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "SESSION_CREATED",
      entityType: "AcademicSession",
      entityId: session.id,
      details: JSON.stringify({ name: session.name }),
      actorId: user.id,
    },
  });

  revalidatePath("/admin/academic-session");
  return session;
}

export async function activateSession(id: string) {
  const sessionUser = await verifySession();
  if (!sessionUser?.userId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.userId } });
  if (user?.role !== "ADMIN") throw new Error("Forbidden");

  const newSession = await prisma.academicSession.findUnique({ where: { id } });
  if (!newSession) throw new Error("Session not found");

  // Only ONE session may remain ACTIVE globally.
  // 1. Archive currently active session
  await prisma.academicSession.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  // 2. Activate new session
  await prisma.academicSession.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  // 3. Update SchoolSettings.activeSessionId
  await prisma.schoolSettings.upsert({
    where: { id: "default" },
    update: { activeSessionId: id },
    create: {
      id: "default",
      activeSessionId: id,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "SESSION_ACTIVATED",
      entityType: "AcademicSession",
      entityId: id,
      details: JSON.stringify({ name: newSession.name }),
      actorId: user.id,
    },
  });

  revalidatePath("/admin/academic-session");
  revalidatePath("/admin/settings");
}

export async function archiveSession(id: string) {
  const sessionUser = await verifySession();
  if (!sessionUser?.userId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.userId } });
  if (user?.role !== "ADMIN") throw new Error("Forbidden");

  const session = await prisma.academicSession.findUnique({ where: { id } });
  if (!session) throw new Error("Session not found");

  // block archival if draft reports exist, unpublished academic records exist
  const unfinalizedRecords = await prisma.studentAcademicRecord.count({
    where: {
      academicSession: session.name,
      status: { in: ["DRAFT", "PUBLISHED"] },
    },
  });

  if (unfinalizedRecords > 0) {
    throw new Error(`Cannot archive session: ${unfinalizedRecords} academic records are not yet finalized.`);
  }

  // Update session
  await prisma.academicSession.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  // Check if it was the active session
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } });
  if (settings?.activeSessionId === id) {
    await prisma.schoolSettings.update({
      where: { id: "default" },
      data: { activeSessionId: null },
    });
  }

  await prisma.activityLog.create({
    data: {
      action: "SESSION_ARCHIVED",
      entityType: "AcademicSession",
      entityId: id,
      details: JSON.stringify({ name: session.name }),
      actorId: user.id,
    },
  });

  revalidatePath("/admin/academic-session");
  revalidatePath("/admin/settings");
}
