import { verifySession } from "@/lib/auth/session"
import prisma from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { StudentHubViewer } from "@/components/dashboard/learning-hub/student-hub-viewer"

export default async function StudentNotesSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const session = await verifySession()
  if (!session || session.role !== "STUDENT") redirect("/login")

  const { subjectId } = await params

  const student = await prisma.student.findUnique({
    where: { userId: session.userId }
  })
  
  if (!student) redirect("/login")

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (!activeSessionId) {
    return <div className="p-4 text-red-600">No active academic session.</div>
  }

  // Authorize student enrollment for active session
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId: student.id,
      academicSessionId: activeSessionId,
      status: "ACTIVE"
    },
    include: {
      class: {
        include: {
          subjects: {
            where: { id: subjectId }
          }
        }
      }
    }
  })

  if (!enrollment || enrollment.class.subjects.length === 0) {
    notFound() // Student is not authorized for this subject or it doesn't exist
  }

  const subject = enrollment.class.subjects[0]

  // Fetch only PUBLISHED content for this subject
  const chapters = await prisma.learningChapter.findMany({
    where: { 
      subjectId: subject.id,
      academicSessionId: activeSessionId,
      status: "PUBLISHED"
    },
    orderBy: { order: 'asc' },
    include: {
      topics: {
        where: { status: "PUBLISHED" },
        orderBy: { order: 'asc' },
        include: {
          pdfs: { where: { status: "PUBLISHED" }, orderBy: { order: 'asc' } },
          videos: { where: { status: "PUBLISHED" }, orderBy: { order: 'asc' } },
          explanation: { where: { status: "PUBLISHED" } }
        }
      }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/student/learning-hub" className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
          <p className="text-muted-foreground text-sm">Learning Materials</p>
        </div>
      </div>

      <StudentHubViewer chapters={chapters} activeSessionId={activeSessionId} />
    </div>
  )
}
