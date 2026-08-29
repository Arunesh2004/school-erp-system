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

  const isDefaultPassword = password === "Student@12345" || password === "Teacher@12345" || password === "Admin@12345"
  if (isDefaultPassword) {
    throw new Error("Cannot use a default password.")
  }

  const session = await verifySession()
  if (!session?.userId) {
    throw new Error("Unauthorized")
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: session.userId },
    data: { password: hashedPassword }
  })

  // Re-issue session without the needsPasswordChange flag
  await createSession(session.userId, session.role, false)

  if (session.role === "ADMIN") redirect("/admin")
  if (session.role === "TEACHER") redirect("/teacher")
  if (session.role === "STUDENT") redirect("/student")

  redirect("/")
}
