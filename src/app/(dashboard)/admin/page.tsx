import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BookOpen, GraduationCap, Activity, CheckCircle, Clock } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AdminCharts } from "@/components/dashboard/admin-charts"

export default async function AdminDashboard() {
  const [
    totalStudents, 
    totalTeachers, 
    totalClasses, 
    totalSubjects,
    publishedMarksCount,
    draftMarksCount,
    recentMarks,
    allPublishedMarks,
    subjects
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.subject.count(),
    prisma.mark.count({ where: { status: 'PUBLISHED' } }),
    prisma.mark.count({ where: { status: 'DRAFT' } }),
    prisma.mark.findMany({
      take: 6,
      orderBy: { updatedAt: 'desc' },
      include: {
        student: { include: { user: true, class: true } },
        subject: true,
      }
    }),
    prisma.mark.findMany({ where: { status: 'PUBLISHED' }, include: { subject: true } }),
    prisma.subject.findMany()
  ])

  // Calculate Average School Performance
  let totalScore = 0
  let totalMaxScore = 0
  allPublishedMarks.forEach(mark => {
    totalScore += mark.score
    totalMaxScore += mark.maxScore
  })
  const averagePerformance = totalMaxScore > 0 ? ((totalScore / totalMaxScore) * 100).toFixed(1) : "0.0"

  // Calculate subject-wise averages for chart
  const marksBySubject = subjects.map(sub => {
    const subMarks = allPublishedMarks.filter(m => m.subjectId === sub.id)
    if (subMarks.length === 0) return { name: sub.name, average: 0 }
    
    const subTotal = subMarks.reduce((sum, m) => sum + m.score, 0)
    const subMax = subMarks.reduce((sum, m) => sum + m.maxScore, 0)
    return {
      name: sub.name,
      average: Number(((subTotal / subMax) * 100).toFixed(1))
    }
  }).filter(s => s.average > 0) // Only show subjects with marks

  const statusDistribution = [
    { name: 'Published', value: publishedMarksCount, color: '#10b981' },
    { name: 'Draft', value: draftMarksCount, color: '#f59e0b' }
  ].filter(s => s.value > 0)

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of academic performance and operations.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Students</CardTitle>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalStudents}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Teachers</CardTitle>
            <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalTeachers}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Academic Entities</CardTitle>
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalClasses} <span className="text-sm font-normal text-slate-500">Classes</span></div>
            <p className="text-xs text-slate-500 mt-1">{totalSubjects} Subjects</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">School Avg Performance</CardTitle>
            <div className="h-8 w-8 bg-blue-200 rounded-full flex items-center justify-center">
              <Activity className="h-4 w-4 text-blue-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{averagePerformance}%</div>
            <p className="text-xs text-blue-700 mt-1">Based on published marks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-slate-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Marks Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{publishedMarksCount}</p>
                <p className="text-xs font-medium text-slate-500">Published</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{draftMarksCount}</p>
                <p className="text-xs font-medium text-slate-500">Drafts Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {marksBySubject.length > 0 && statusDistribution.length > 0 && (
        <AdminCharts marksBySubject={marksBySubject} statusDistribution={statusDistribution} />
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Recent Marks Activity</h2>
        </div>
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[250px]">Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMarks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No recent marks activity.
                  </TableCell>
                </TableRow>
              ) : (
                recentMarks.map((mark) => (
                  <TableRow key={mark.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                          {(mark.student.user.name || "NA").substring(0, 2).toUpperCase()}
                        </div>
                        {mark.student.user.name || "Unknown Student"}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{mark.student.class?.name || 'N/A'}</TableCell>
                    <TableCell className="text-slate-600">{mark.subject.name}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{mark.examType}</TableCell>
                    <TableCell className="text-right font-medium">
                      {mark.score} <span className="text-slate-400 text-xs">/ {mark.maxScore}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={mark.status === 'PUBLISHED' ? 'success' : 'warning'}>
                        {mark.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
