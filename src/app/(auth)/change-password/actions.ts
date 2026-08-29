"use server"

import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { verifySession, createSession } from "@/lib/auth/session"

export async function changePassword(formData: FormData) {
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.")
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.")
  }

  // Use verifySession(true) to allow accessing the session even if password change is required
  const session = await verifySession(true)
  if (!session?.userId) {
    throw new Error("Unauthorized")
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    throw new Error("User not found")
  }

  const isSamePassword = await bcrypt.compare(password, user.password)
  if (isSamePassword) {
    throw new Error("New password cannot be the same as the current temporary password.")
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: session.userId },
    data: { 
      password: hashedPassword,
      mustChangePassword: false
    }
  })

  // Re-issue session without the needsPasswordChange flag
  await createSession(session.userId, session.role, false)

  if (session.role === "ADMIN") redirect("/admin")
  if (session.role === "TEACHER") redirect("/teacher")
  if (session.role === "STUDENT") redirect("/student")

  redirect("/")
}
