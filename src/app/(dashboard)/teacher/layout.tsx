import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth/session"
import prisma from "@/lib/prisma"

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()

  if (!session?.userId) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
  })

  if (dbUser?.role !== "TEACHER") {
    if (dbUser?.role === "ADMIN") redirect('/admin')
    if (dbUser?.role === "STUDENT") redirect('/student')
    redirect('/login')
  }

  return <>{children}</>
}
