import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { verifySession } from "@/lib/auth/session"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()

  if (!session?.userId) {
    redirect('/login')
  }

  if (session.needsPasswordChange) {
    redirect('/change-password')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      teacher: {
        include: {
          classes: { select: { id: true } }
        }
      }
    }
  })

  const isClassTeacher = dbUser?.role === "TEACHER" && !!dbUser.teacher?.classes?.length;

  if (!dbUser) {
    redirect('/login')
  }

  let settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }, include: { activeSession: true } })
  if (!settings) {
    settings = await prisma.schoolSettings.create({
      data: {
        id: "default",
      },
      include: {
        activeSession: true
      }
    })
  }

  const schoolName = settings?.schoolName || "EduManage Academy"
  const activeSessionName = settings?.activeSession?.name || "No Active Session"

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <Sidebar role={dbUser.role} schoolName={schoolName} isClassTeacher={isClassTeacher} />
      </div>
      <div className="flex flex-col">
        <Header userName={dbUser.name || dbUser.email} role={dbUser.role} academicSession={activeSessionName} schoolName={schoolName} isClassTeacher={isClassTeacher} />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
