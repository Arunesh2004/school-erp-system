import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { TeacherAttendanceTable } from "@/components/dashboard/teacher-attendance-table"
import { CalendarDays } from "lucide-react"

export default async function TeacherAttendancePage(
  props: { searchParams: Promise<{ date?: string }> }
) {
  const searchParams = await props.searchParams
  const session = await verifySession()
  
  const teacherUser = await prisma.user.findUnique({
    where: { id: session?.userId },
    include: { teacher: true }
  })
  
  if (!teacherUser?.teacher) return <div>Unauthorized</div>

  // Parse date from URL, or default to today
  const selectedDateStr = searchParams.date || new Date().toISOString().split('T')[0]
  const selectedDate = new Date(selectedDateStr)
  selectedDate.setHours(0, 0, 0, 0) // midnight UTC for db query

  // Find Homeroom Classes
  const homeroomClasses = await prisma.class.findMany({
    where: { teacherId: teacherUser.teacher.id },
    include: {
      students: {
        include: {
          user: true,
          attendance: {
            where: { date: selectedDate }
          }
        },
        orderBy: { user: { name: 'asc' } }
      }
    }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Attendance</h1>
          <p className="text-slate-500 text-sm">Manage attendance for your assigned homeroom classes.</p>
        </div>
      </div>

      {homeroomClasses.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-500 shadow-sm">
          You are not currently assigned as a homeroom teacher for any classes.
        </div>
      ) : (
        homeroomClasses.map((cls) => (
          <TeacherAttendanceTable 
            key={cls.id} 
            classData={cls} 
            selectedDate={selectedDateStr} 
          />
        ))
      )}
    </div>
  )
}
