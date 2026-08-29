import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth/session"
import prisma from "@/lib/prisma"

export default async function AdminLayout({
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

  if (dbUser?.role !== "ADMIN") {
    if (dbUser?.role === "TEACHER") redirect('/teacher')
    if (dbUser?.role === "STUDENT") redirect('/student')
    redirect('/login')
  }

  return <>{children}</>
}
