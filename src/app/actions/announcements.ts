"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { verifySession } from "@/lib/auth/session"
import { logActivity } from "./logging"
import { z } from "zod"

const announcementSchema = z.object({
  title: z.string().min(3).max(100),
  content: z.string().min(5),
  targetRoles: z.string(), // "ALL", "STUDENT", "TEACHER"
  priority: z.enum(["NORMAL", "HIGH"]),
})

export async function createAnnouncement(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") {
    return { error: "Unauthorized" }
  }

  const data = Object.fromEntries(formData.entries())
  const parsed = announcementSchema.safeParse(data)
  
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    const announcement = await prisma.announcement.create({
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        targetRoles: parsed.data.targetRoles,
        priority: parsed.data.priority,
        authorId: session.userId,
      }
    })

    await logActivity("ANNOUNCEMENT_CREATED", "Announcement", announcement.id, `Created ${parsed.data.priority} notice: ${parsed.data.title}`, session.userId)

    revalidatePath("/")
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Failed to publish announcement" }
  }
}

export async function deleteAnnouncement(id: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    await prisma.announcement.delete({ where: { id } })
    await logActivity("ANNOUNCEMENT_DELETED", "Announcement", id, null, session.userId)
    revalidatePath("/")
    return { success: true }
  } catch (err) {
    return { error: "Failed to delete announcement" }
  }
}
