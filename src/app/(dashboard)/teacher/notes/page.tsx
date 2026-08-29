import { verifySession } from '@/lib/auth/session'
import prisma from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTeacherLearningHubAssignments } from '@/lib/auth/teacher-authorization'

export default async function TeacherNotesIndex() {
  const session = await verifySession()
  if (!session || session.role !== 'TEACHER') redirect('/login')

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.userId }
  })

  if (!teacher) redirect('/login')

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }})
  const activeSessionId = settings?.activeSessionId

  let assignments: any[] = []
  if (activeSessionId) {
    assignments = await getTeacherLearningHubAssignments(teacher.id, activeSessionId)
  }

  // To count chapters, we map over assignments
  const assignmentsWithChapters = await Promise.all(assignments.map(async (a) => {
    const chapterCount = await prisma.learningChapter.count({
      where: {
        subjectId: a.subjectId,
        academicSessionId: activeSessionId!,
        classId: a.classId // respect class scope
      }
    })
    return { ...a, chapterCount }
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subject Learning Hub</h1>
        <p className="text-muted-foreground">Manage notes, videos, and interactive explanations for your subjects.</p>
      </div>

      {!activeSessionId && (
        <div className="bg-red-50 text-red-800 p-4 rounded-md border border-red-200">
          No active academic session found. Please contact an administrator.
        </div>
      )}

      {activeSessionId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignmentsWithChapters.map(assignment => {
            return (
              <Link href={`/teacher/notes/${assignment.subjectId}?classId=${assignment.classId}`} key={assignment.id}>
                <Card className="hover:border-blue-500 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-blue-100 p-2 rounded-md text-blue-700">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      {assignment.subject.name} ({assignment.class.name})
                    </CardTitle>
                    <CardDescription>Code: {assignment.subject.code}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium text-slate-600">
                      {assignment.chapterCount} {assignment.chapterCount === 1 ? 'Chapter' : 'Chapters'}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
          
          {assignmentsWithChapters.length === 0 && (
            <div className="col-span-full text-center p-8 bg-slate-50 border rounded-lg text-slate-500">
              You are not assigned to any subjects yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
