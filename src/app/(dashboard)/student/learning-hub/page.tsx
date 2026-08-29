import { verifySession } from "@/lib/auth/session"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

export default async function StudentLearningHubIndex() {
  const session = await verifySession()
  if (!session || session.role !== "STUDENT") redirect("/login")

  const student = await prisma.student.findUnique({
    where: { userId: session.userId }
  })
  
  if (!student) redirect("/login")

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (!activeSessionId) {
    return <div className="p-4 text-red-600">No active academic session.</div>
  }

  // Find student enrollment for active session
  const enrollmentMeta = await prisma.studentEnrollment.findFirst({
    where: {
      studentId: student.id,
      academicSessionId: activeSessionId,
      status: "ACTIVE"
    }
  });

  if (!enrollmentMeta) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 border rounded-md">
        You are not enrolled in any class for the current academic session.
      </div>
    )
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      id: enrollmentMeta.id
    },
    include: {
      class: {
        include: {
          subjects: {
            include: {
              learningChapters: {
                where: { 
                  academicSessionId: activeSessionId,
                  status: "PUBLISHED",
                  OR: [
                    { classId: null },
                    { classId: enrollmentMeta.classId }
                  ]
                }
              }
            }
          }
        }
      }
    }
  })

  if (!enrollment) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 border rounded-md">
        You are not enrolled in any class for the current academic session.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learning Hub</h1>
        <p className="text-muted-foreground">Access your published notes, videos, and interactive explanations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrollment.class.subjects.map(subject => {
          return (
            <Link href={`/student/learning-hub/${subject.id}`} key={subject.id}>
              <Card className="hover:border-blue-500 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-md text-blue-700">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    {subject.name}
                  </CardTitle>
                  <CardDescription>Code: {subject.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium text-slate-600">
                    {subject.learningChapters.length} {subject.learningChapters.length === 1 ? 'Published Chapter' : 'Published Chapters'}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
        {enrollment.class.subjects.length === 0 && (
          <div className="col-span-full text-center p-8 text-slate-500 border border-dashed rounded-md">
            No subjects assigned to your class yet.
          </div>
        )}
      </div>
    </div>
  )
}
