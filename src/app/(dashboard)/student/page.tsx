import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileText, Percent, Award, TrendingUp, BookOpen, CalendarDays } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { StudentCharts } from "@/components/dashboard/student-charts"
import { RecentNotices } from "@/components/dashboard/recent-notices"

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B"
  if (percentage >= 60) return "C"
  if (percentage >= 50) return "D"
  return "F"
}

export default async function StudentDashboard() {
  const session = await verifySession()
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId || "none"

  const studentUser = await prisma.user.findUnique({
    where: { id: session?.userId },
    include: { 
      student: { 
        include: { 
          class: true,
          attendance: {
            where: { academicSessionId: activeSessionId }
          }
        } 
      } 
    }
  })
  
  if (!studentUser?.student) return <div>Unauthorized</div>

  const marks = await prisma.mark.findMany({
    where: { 
      studentId: studentUser.student.id,
      status: "PUBLISHED",
      academicSessionId: activeSessionId
    },
    include: { subject: true },
    orderBy: { updatedAt: 'desc' }
  })

  const totalScore = marks.reduce((sum, mark) => sum + mark.score, 0)
  const maxPossible = marks.reduce((sum, mark) => sum + mark.maxScore, 0)
  const percentageStr = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : "0.0"
  const percentage = parseFloat(percentageStr)
  const grade = maxPossible > 0 ? calculateGrade(percentage) : "N/A"

  const recentMarks = marks.slice(0, 4)

  const marksData = marks.map(m => ({
    subject: m.subject.name,
    score: m.score,
    maxScore: m.maxScore,
    percentage: Number(((m.score / m.maxScore) * 100).toFixed(1))
  }))

  // Attendance logic
  const attendance = studentUser.student.attendance
  const totalDays = attendance.length
  const presentDays = attendance.filter(a => a.status === "PRESENT").length
  const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "N/A"


  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome back, {studentUser.name}. Class: {studentUser.student.class?.name || "Unassigned"}</p>
        </div>
        <Link href="/student/results" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm inline-flex items-center gap-2">
          <FileText className="w-4 h-4" />
          View Full Marksheet
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-indigo-50 to-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Overall Performance</CardTitle>
            <div className="h-8 w-8 bg-indigo-200 rounded-full flex items-center justify-center">
              <Percent className="h-4 w-4 text-indigo-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">{percentageStr}%</div>
            <p className="text-xs text-indigo-700 mt-1">Cumulative average</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Current Grade</CardTitle>
            <div className="h-8 w-8 bg-purple-200 rounded-full flex items-center justify-center">
              <Award className="h-4 w-4 text-purple-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{grade}</div>
            <p className="text-xs text-purple-700 mt-1">Based on {percentageStr}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Attendance Rate</CardTitle>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-green-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{attendancePercentage}%</div>
            <p className="text-xs text-slate-500 mt-1">{presentDays} / {totalDays} days present</p>
          </CardContent>
        </Card>
      </div>
    
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
        {marksData.length > 0 ? (
          <StudentCharts marksData={marksData} />
        ) : (
          <Card className="shadow-sm border-slate-200 flex items-center justify-center min-h-[300px]">
            <div className="text-center text-slate-500">
              <TrendingUp className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p>No performance data available yet.</p>
            </div>
          </Card>
        )}

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Recent Results</CardTitle>
            <CardDescription>Your latest subject scores</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {recentMarks.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No recent results.
              </div>
            ) : (
              recentMarks.map(mark => {
                const markPercentage = (mark.score / mark.maxScore) * 100;
                let colorClass = "bg-blue-600";
                if (markPercentage >= 80) colorClass = "bg-green-500";
                else if (markPercentage < 50) colorClass = "bg-red-500";

                return (
                  <div key={mark.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{mark.subject.name}</span>
                      <span className="text-slate-500 font-medium">{mark.score} / {mark.maxScore}</span>
                    </div>
                    <Progress value={markPercentage} indicatorColor={colorClass} className="h-2" />
                  </div>
                )
              })
            )}
            {recentMarks.length > 0 && (
              <div className="pt-2 text-center">
                <Link href="/student/results" className="text-sm text-blue-600 hover:underline">
                  View all results
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <RecentNotices role="STUDENT" />
      </div>
    </div>
  </div>
)
}
