import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { verifySession } from "@/lib/auth/session"
import { MarkForm } from "./mark-form"
import { TeacherMarksTable } from "@/components/dashboard/teacher-marks-table"
import { DataTableSearch } from "@/components/ui/data-table-search"
import { DataTableFilter } from "@/components/ui/data-table-filter"
import { PaginationControls } from "@/components/ui/pagination-controls"

export default async function TeacherMarksPage(
  props: { searchParams: Promise<{ q?: string, page?: string, subjectId?: string }> }
) {
  const session = await verifySession()
  const teacherUser = await prisma.user.findUnique({
    where: { id: session?.userId },
    include: { teacher: true }
  })
  
  if (!teacherUser?.teacher) return <div>Unauthorized</div>

  const searchParams = await props.searchParams
  const query = searchParams.q || ""
  const page = parseInt(searchParams.page || "1")
  const subjectId = searchParams.subjectId || "all"
  const pageSize = 10

  const teacherId = teacherUser.teacher.id

  const assignedSubjects = await prisma.subject.findMany({
    where: { teacherId },
  })

  // We find students from the classes that are connected to these assigned subjects
  const classesWithSubjects = await prisma.class.findMany({
    where: {
      subjects: { some: { teacherId } }
    },
    include: {
      students: { include: { user: true } }
    }
  })
  
  const students = Array.from(new Set(
    classesWithSubjects.flatMap(c => c.students).map(s => ({ id: s.id, name: s.user.name }))
  ))

  const whereCondition: Prisma.MarkWhereInput = {
    teacherId,
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
        <MarkForm students={students} subjects={assignedSubjects} />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-md shadow-sm border border-slate-200">
        <DataTableSearch placeholder="Search by student name..." />
        <DataTableFilter paramKey="subjectId" title="Subject" options={subjectOptions} />
      </div>

      <TeacherMarksTable marks={marks} />
      
      <div className="bg-white border rounded-md shadow-sm">
        <PaginationControls totalItems={totalItems} pageSize={pageSize} currentPage={page} />
      </div>
    </div>
  )
}
