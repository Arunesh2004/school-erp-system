import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { getClassTeacherAssignments } from "@/lib/auth/teacher-authorization"
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

  const selectedDateStr = searchParams.date || new Date().toISOString().split('T')[0]
  const selectedDate = new Date(selectedDateStr)
  selectedDate.setHours(0, 0, 0, 0) // midnight UTC for db query

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (!activeSessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Session</h2>
        <p className="text-slate-500 max-w-md">An administrator must set an active academic session before attendance can be managed.</p>
      </div>
    )
  }

  // Find Homeroom Classes via ClassTeacherAssignment
  const classAssignments = await getClassTeacherAssignments(teacherUser.teacher.id, activeSessionId)
  const classIds = classAssignments.map(a => a.classId)

  const homeroomClasses = await prisma.class.findMany({
    where: { id: { in: classIds } },
  })

  // Enhance classes with their ACTIVE enrolled students
  const classesWithStudents = await Promise.all(homeroomClasses.map(async (cls) => {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        classId: cls.id,
        academicSessionId: activeSessionId,
        status: "ACTIVE"
      },
      include: {
        student: {
          include: {
            user: true,
            attendance: {
              where: {
                date: selectedDate,
                academicSessionId: activeSessionId
              }
            }
          }
        }
      },
      orderBy: { student: { user: { name: 'asc' } } }
    })
    
    // Map enrollment relation into the legacy `students` array shape expected by the UI component
    return {
      ...cls,
      students: enrollments.map(e => e.student)
    }
  }))

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

      {classesWithStudents.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-500 shadow-sm">
          You are not currently assigned as a homeroom teacher for any classes.
        </div>
      ) : (
        classesWithStudents.map((cls) => (
          <TeacherAttendanceTable 
            key={cls.id} 
            classData={cls as any} 
            selectedDate={selectedDateStr} 
            activeSessionId={activeSessionId}
          />
        ))
      )}
    </div>
  )
}
