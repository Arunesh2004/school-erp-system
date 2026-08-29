"use server"

import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createSession, deleteSession } from "@/lib/auth/session"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    return { error: "Invalid credentials." }
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return { error: "Invalid credentials." }
  }

  await createSession(user.id, user.role, user.mustChangePassword)

  if (user.mustChangePassword) redirect("/change-password")

  if (user.role === "ADMIN") redirect("/admin")
  if (user.role === "TEACHER") redirect("/teacher")
  if (user.role === "STUDENT") redirect("/student")

  redirect("/")
}

export async function logout() {
  await deleteSession()
  redirect("/login")
}
