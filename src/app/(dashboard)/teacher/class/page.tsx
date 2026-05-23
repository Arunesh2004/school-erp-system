import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import { Users, Percent, Award, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function ClassTeacherPage() {
  const session = await verifySession()
  if (!session?.userId) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { teacher: true }
  })

  if (dbUser?.role !== "TEACHER" || !dbUser.teacher) {
    redirect('/login')
  }

  // Detect Class Ownership
  const teacherClass = await prisma.class.findFirst({
    where: { teacherId: dbUser.teacher.id },
    include: {
      students: {
        select: {
          id: true,
          rollNumber: true,
          user: { select: { name: true, email: true } },
          attendance: { select: { status: true } },
          marks: { select: { score: true, maxScore: true } }
        },
        orderBy: { user: { name: 'asc' } }
      }
    }
  })

  if (!teacherClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
          <Users className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Not a Class Teacher</h2>
        <p className="text-slate-500 max-w-md">
          You are not currently assigned as a class teacher for any class. If you believe this is an error, please contact the administrator.
        </p>
      </div>
    )
  }

  // Calculate Aggregates
  let totalAttendanceRecords = 0
  let totalPresent = 0
  let totalScore = 0
  let totalMaxScore = 0

  const studentsWithStats = teacherClass.students.map((student: {
    id: string;
    rollNumber: string | null;
    user: { name: string | null; email: string };
    attendance: { status: string }[];
    marks: { score: number; maxScore: number }[];
  }) => {
    // Attendance
    const studentTotalAttendance = student.attendance.length
    const studentPresent = student.attendance.filter((a: { status: string }) => a.status === 'PRESENT').length
    const studentAttendancePercent = studentTotalAttendance > 0 
      ? Math.round((studentPresent / studentTotalAttendance) * 100) 
      : 0

    totalAttendanceRecords += studentTotalAttendance
    totalPresent += studentPresent

    // Marks
    const studentTotalScore = student.marks.reduce((sum: number, m: { score: number }) => sum + m.score, 0)
    const studentTotalMax = student.marks.reduce((sum: number, m: { maxScore: number }) => sum + m.maxScore, 0)
    const studentGradePercent = studentTotalMax > 0 
      ? Math.round((studentTotalScore / studentTotalMax) * 100) 
      : 0

    totalScore += studentTotalScore
    totalMaxScore += studentTotalMax

    return {
      ...student,
      attendancePercent: studentAttendancePercent,
      gradePercent: studentGradePercent
    }
  })

  const classAttendanceAvg = totalAttendanceRecords > 0 
    ? Math.round((totalPresent / totalAttendanceRecords) * 100) 
    : 0
  const classPerformanceAvg = totalMaxScore > 0 
    ? Math.round((totalScore / totalMaxScore) * 100) 
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Class: {teacherClass.name}</h1>
        <p className="text-sm text-slate-500">Overview and student management for your assigned homeroom class.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Students</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{teacherClass.students.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Class Attendance Avg</CardTitle>
            <Percent className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{classAttendanceAvg}%</div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Class Performance Avg</CardTitle>
            <Award className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{classPerformanceAvg}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-800">Student Directory</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Roll No.</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Overall Grade</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentsWithStats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No students are enrolled in this class yet.
                </TableCell>
              </TableRow>
            ) : (
              studentsWithStats.map((student) => (
                <TableRow key={student.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-600">
                    {student.rollNumber || <span className="italic text-slate-400">N/A</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{student.user.name || "Unknown"}</span>
                      <span className="text-xs text-slate-500">{student.user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${student.attendancePercent >= 75 ? 'bg-green-500' : student.attendancePercent >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${student.attendancePercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{student.attendancePercent}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${student.gradePercent >= 75 ? 'bg-blue-500' : student.gradePercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${student.gradePercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{student.gradePercent}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link 
                      href={`/teacher/class/student/${student.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-blue-600 hover:text-blue-700 hover:bg-blue-50"}
                    >
                      View <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
