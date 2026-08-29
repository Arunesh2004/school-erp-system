"use server"

import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { resolveAndAuthorizeAlertTargets, assertAlertRecipient, assertAlertCreatorOrAdmin, AlertTargetPayload } from "@/lib/auth/alert-authorization"
import { requireActiveSessionId } from "@/lib/auth/teacher-authorization"
import { AlertPriority, AlertStatus, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

export type CreateAlertInput = {
  title: string
  message: string
  priority: AlertPriority
  requiresAcknowledgement: boolean
  expiresAt?: Date
  targetPayload: AlertTargetPayload
}

/**
 * Creates a new alert and snapshotted recipients.
 */
export async function createAlert(input: CreateAlertInput) {
  const session = await verifySession()
  if (!session) {
    return { error: "Not authenticated" }
  }

  const academicSessionId = await requireActiveSessionId()

  try {
    // 1. Resolve and Authorize Targets
    const targetUserIds = await resolveAndAuthorizeAlertTargets(
      session.userId,
      session.role as any, // Cast to Role Enum
      input.targetPayload,
      academicSessionId
    )

    if (targetUserIds.length === 0) {
      return { error: "No valid recipients found for the specified target." }
    }

    // 2. Atomic Transaction for Alert + Recipients
    await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          title: input.title,
          message: input.message,
          priority: input.priority,
          requiresAcknowledgement: input.requiresAcknowledgement,
          expiresAt: input.expiresAt,
          status: "PUBLISHED",
          publishedAt: new Date(),
          creatorId: session.userId,
          targetType: input.targetPayload.targetType,
        }
      })

      // Use createMany to insert explicitly resolved recipient snapshots
      const recipientData = targetUserIds.map(id => ({
        alertId: alert.id,
        userId: id
      }))

      await tx.alertRecipient.createMany({
        data: recipientData
      })
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Alert creation failed:", error)
    return { error: error.message || "An unexpected error occurred." }
  }
}

/**
 * Gets the current user's alerts.
 * Automatically filters out expired alerts for active views, but leaves historical if specified.
 */
export async function getMyAlerts(filter: "ACTIVE" | "HISTORY" = "ACTIVE") {
  const session = await verifySession()
  if (!session) throw new Error("Not authenticated")

  const now = new Date()

  // Base where clause ensures IDOR protection implicitly (userId equals session)
  const whereClause: any = {
    userId: session.userId,
    alert: {
      status: { in: ["PUBLISHED", "ARCHIVED"] }
    }
  }

  if (filter === "ACTIVE") {
    whereClause.alert.status = "PUBLISHED"
    whereClause.alert.OR = [
      { expiresAt: null },
      { expiresAt: { gt: now } }
    ]
  }

  const recipients = await prisma.alertRecipient.findMany({
    where: whereClause,
    include: {
      alert: {
        include: {
          creator: { select: { name: true, role: true } }
        }
      }
    },
    orderBy: {
      alert: { createdAt: 'desc' }
    }
  })

  return recipients
}

/**
 * Marks an alert as read by the current user.
 */
export async function markAlertRead(alertId: string) {
  const session = await verifySession()
  if (!session) throw new Error("Not authenticated")

  // IDOR protection is built into the update where clause
  try {
    const recipient = await prisma.alertRecipient.findUnique({
      where: { alertId_userId: { alertId, userId: session.userId } },
      include: { alert: true }
    })

    if (!recipient) return { error: "Alert recipient record not found." }
    if (recipient.alert.status === "CANCELLED") return { error: "This alert has been cancelled." }

    await prisma.alertRecipient.update({
      where: {
        alertId_userId: { alertId, userId: session.userId }
      },
      data: {
        readAt: new Date()
      }
    })
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to mark alert as read:", error)
    return { error: "Failed to update read status." }
  }
}

/**
 * Acknowledges an alert if required.
 */
export async function acknowledgeAlert(alertId: string) {
  const session = await verifySession()
  if (!session) throw new Error("Not authenticated")

  try {
    const recipient = await prisma.alertRecipient.findUnique({
      where: { alertId_userId: { alertId, userId: session.userId } },
      include: { alert: true }
    })

    if (!recipient) {
      return { error: "Alert recipient record not found." }
    }

    if (!recipient.alert.requiresAcknowledgement) {
      return { error: "This alert does not require acknowledgement." }
    }

    if (recipient.alert.status === "CANCELLED") {
      return { error: "This alert has been cancelled." }
    }

    await prisma.alertRecipient.update({
      where: {
        alertId_userId: { alertId, userId: session.userId }
      },
      data: {
        acknowledgedAt: new Date(),
        // Implicitly mark as read if acknowledged
        readAt: recipient.readAt || new Date()
      }
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Failed to acknowledge alert:", error)
    return { error: "Failed to acknowledge alert." }
  }
}

/**
 * Updates the status of an alert. Only Creator or Admin can perform this.
 */
export async function updateAlertStatus(alertId: string, status: AlertStatus) {
  const session = await verifySession()
  if (!session) throw new Error("Not authenticated")

  try {
    await assertAlertCreatorOrAdmin(alertId, session.userId, session.role as Role)

    // Immutable content rules restrict edits, but status transitions are allowed
    await prisma.alert.update({
      where: { id: alertId },
      data: { status }
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update alert status:", error)
    return { error: error.message || "Failed to update alert status." }
  }
}
