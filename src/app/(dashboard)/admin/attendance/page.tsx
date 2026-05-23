import prisma from "@/lib/prisma"
import { CalendarDays, Users, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function AdminAttendancePage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all attendance for today
  const todaysAttendance = await prisma.attendance.findMany({
    where: { date: today },
    include: { class: true, student: { include: { user: true } } }
  })

  const totalMarked = todaysAttendance.length
  const present = todaysAttendance.filter(a => a.status === "PRESENT").length
  const absent = todaysAttendance.filter(a => a.status === "ABSENT").length
  const late = todaysAttendance.filter(a => a.status === "LATE").length
  
  const presentPercentage = totalMarked > 0 ? ((present / totalMarked) * 100).toFixed(1) : "0.0"

  // Class wise breakdown
  const classes = await prisma.class.findMany({ include: { students: true } })
  const classBreakdown = classes.map(cls => {
    const clsAttendance = todaysAttendance.filter(a => a.classId === cls.id)
    const clsPresent = clsAttendance.filter(a => a.status === "PRESENT").length
    return {
      name: cls.name,
      total: cls.students.length,
      marked: clsAttendance.length,
      present: clsPresent,
      rate: clsAttendance.length > 0 ? ((clsPresent / clsAttendance.length) * 100).toFixed(1) : "N/A"
    }
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance Analytics</h1>
          <p className="text-slate-500 text-sm">Overview of school-wide daily attendance.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Overall Present Rate</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{presentPercentage}%</div>
            <p className="text-xs text-slate-500 mt-1">Based on today's marked attendance</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Absences</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{absent}</div>
            <p className="text-xs text-slate-500 mt-1">Students marked absent today</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Late</CardTitle>
            <CalendarDays className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{late}</div>
            <p className="text-xs text-slate-500 mt-1">Students marked late today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Class Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Marked / Total</TableHead>
                  <TableHead className="text-right">Present Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classBreakdown.map(cb => (
                  <TableRow key={cb.name}>
                    <TableCell className="font-medium">{cb.name}</TableCell>
                    <TableCell className="text-right">{cb.marked} / {cb.total}</TableCell>
                    <TableCell className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        cb.rate === "N/A" ? "bg-slate-100 text-slate-600" :
                        parseFloat(cb.rate) >= 90 ? "bg-green-100 text-green-700" :
                        parseFloat(cb.rate) >= 75 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {cb.rate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Recent Absences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todaysAttendance.filter(a => a.status === "ABSENT").slice(0, 5).map(a => (
                <div key={a.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{a.student.user.name}</p>
                    <p className="text-xs text-slate-500">{a.class.name}</p>
                  </div>
                  <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-md">Absent</span>
                </div>
              ))}
              {absent === 0 && (
                <div className="text-sm text-slate-500 text-center py-4">No absences recorded today.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
