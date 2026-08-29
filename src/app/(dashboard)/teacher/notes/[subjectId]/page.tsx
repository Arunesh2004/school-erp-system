import { verifySession } from "@/lib/auth/session"
import prisma from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { TeacherHubManager } from "@/components/dashboard/learning-hub/teacher-hub-manager"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { assertTeacherCanManageContent } from "@/lib/auth/teacher-authorization"

export default async function TeacherNotesSubjectPage({ params, searchParams }: { params: Promise<{ subjectId: string }>, searchParams: Promise<{ classId?: string }> }) {
  const session = await verifySession()
  if (!session || session.role !== "TEACHER") redirect("/login")

  const { subjectId } = await params
  const { classId } = await searchParams

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.userId }
  })
  
  if (!teacher) redirect("/login")

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (!activeSessionId) {
    return <div className="p-4 text-red-600">No active academic session.</div>
  }

  // Verify ownership
  try {
    await assertTeacherCanManageContent(teacher.id, subjectId, activeSessionId, classId)
  } catch (e) {
    notFound()
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
  })
  
  if (!subject) notFound()

  let classRecord = null
  if (classId) {
    classRecord = await prisma.class.findUnique({ where: { id: classId } })
  }

  const learningChapters = await prisma.learningChapter.findMany({
    where: { 
      subjectId: subject.id,
      academicSessionId: activeSessionId,
      classId: classId || null
    },
    orderBy: { order: 'asc' },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          pdfs: true,
          videos: true,
          explanation: true
        }
      }
    }
  })

  if (!subject) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teacher/notes" className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {subject.name} {classRecord ? `(${classRecord.name})` : ''}
          </h1>
          <p className="text-muted-foreground text-sm">Learning Hub Management</p>
        </div>
      </div>

      <TeacherHubManager 
        subjectId={subject.id} 
        activeSessionId={activeSessionId}
        initialChapters={learningChapters} 
        classId={classId}
      />
    </div>
  )
}
