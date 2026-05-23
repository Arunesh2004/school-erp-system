"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { verifySession } from "@/lib/auth/session"
import { logActivity } from "./logging"
import { z } from "zod"

const settingsSchema = z.object({
  schoolName: z.string().min(2, "School name is too short").max(100),
  schoolAddress: z.string().min(5, "Address is too short").max(200),
  contactNumber: z.string().min(5, "Contact number is too short").max(50),
  principalName: z.string().min(2, "Principal name is too short").max(100),
  email: z.string().email("Invalid email address"),
})

export async function updateSchoolSettings(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") {
    return { error: "Unauthorized" }
  }

  const data = Object.fromEntries(formData.entries())
  const parsed = settingsSchema.safeParse(data)
  
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.schoolSettings.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: {
        id: "default",
        ...parsed.data
      }
    })

    await logActivity("SETTINGS_UPDATED", "SchoolSettings", "default", "Updated global school branding and details.", session.userId)

    revalidatePath("/") // Revalidate everything to reflect new branding
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Failed to update school settings." }
  }
}
