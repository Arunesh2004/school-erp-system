import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { verifySession } from "@/lib/auth/session"
import { MarkForm } from "./mark-form"
import { TeacherMarksTable } from "@/components/dashboard/teacher-marks-table"
import { DataTableSearch } from "@/components/ui/data-table-search"
import { DataTableFilter } from "@/components/ui/data-table-filter"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { getSubjectTeachingAssignments } from "@/lib/auth/teacher-authorization"

export default async function TeacherMarksPage(
  props: { searchParams: Promise<{ q?: string, page?: string, subjectId?: string }> }
) {
  const session = await verifySession()
  const teacherUser = await prisma.user.findUnique({
    where: { id: session?.userId },
    include: { teacher: true }
  })
  
  if (!teacherUser?.teacher) return <div>Unauthorized</div>

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (!activeSessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Session</h2>
        <p className="text-slate-500 max-w-md">An administrator must set an active academic session before marks can be managed.</p>
      </div>
    )
  }

  const searchParams = await props.searchParams
  const query = searchParams.q || ""
  const page = parseInt(searchParams.page || "1")
  const subjectId = searchParams.subjectId || "all"
  const pageSize = 10

  const teacherId = teacherUser.teacher.id

  const assignments = await getSubjectTeachingAssignments(teacherId, activeSessionId)
  
  // Extract unique subjects for the filter dropdown
  const assignedSubjectsMap = new Map()
  assignments.forEach(a => assignedSubjectsMap.set(a.subjectId, a.subject))
  const assignedSubjects = Array.from(assignedSubjectsMap.values())

  // Get unique class IDs the teacher has a teaching assignment for
  const authorizedClassIds = [...new Set(assignments.map(a => a.classId))]

  // Fetch ACTIVE students in these authorized classes
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classId: { in: authorizedClassIds },
      academicSessionId: activeSessionId,
      status: "ACTIVE"
    },
    include: {
      student: { include: { user: true } },
      class: true
    }
  })

  // Format students for the MarkForm dropdown
  const students = Array.from(new Set(
    enrollments.map(e => ({ id: e.student.id, name: `${e.student.user.name} (${e.class.name})` }))
  ))

  const whereCondition: Prisma.MarkWhereInput = {
    teacherId,
    academicSessionId: activeSessionId,
    student: {
      user: { name: { contains: query } }
    }
  }

  if (subjectId !== "all") {
    whereCondition.subjectId = subjectId
  }

  const [marks, totalItems] = await Promise.all([
    prisma.mark.findMany({
      where: whereCondition,
      include: {
        student: { include: { user: true } },
        subject: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mark.count({ where: whereCondition })
  ])

  const subjectOptions = assignedSubjects.map(s => ({ label: s.name, value: s.id }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manage Marks</h1>
          <p className="text-sm text-slate-500">Edit scores inline. Press Enter to save.</p>
        </div>
        <MarkForm students={students} subjects={assignedSubjects} activeSessionId={activeSessionId} />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-md shadow-sm border border-slate-200">
        <DataTableSearch placeholder="Search by student name..." />
        <DataTableFilter paramKey="subjectId" title="Subject" options={subjectOptions} />
      </div>

      <TeacherMarksTable marks={marks} activeSessionId={activeSessionId} />
      
      <div className="bg-white border rounded-md shadow-sm">
        <PaginationControls totalItems={totalItems} pageSize={pageSize} currentPage={page} />
      </div>
    </div>
  )
}
