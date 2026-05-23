"use server"

import prisma from "@/lib/prisma"

export async function logActivity(
  action: string, 
  entityType: string, 
  entityId: string | null, 
  details: string | null, 
  actorId: string
) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        entityType,
        entityId,
        details,
        actorId
      }
    })
  } catch (err) {
    // We don't want logging failures to crash the main request
    console.error("Failed to log activity:", err)
  }
}
