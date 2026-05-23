import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SubjectForm } from "./subject-form"
import { DeleteSubjectButton } from "./delete-subject"
import { DataTableSearch } from "@/components/ui/data-table-search"
import { PaginationControls } from "@/components/ui/pagination-controls"

export default async function AdminSubjectsPage(
  props: { searchParams: Promise<{ q?: string, page?: string }> }
) {
  const searchParams = await props.searchParams
  const query = searchParams.q || ""
  const page = parseInt(searchParams.page || "1")
  const pageSize = 10

  const whereCondition: Prisma.SubjectWhereInput = {
    OR: [
      { name: { contains: query } },
      { code: { contains: query } }
    ]
  }

  const [subjects, totalItems, teachers] = await Promise.all([
    prisma.subject.findMany({
      where: whereCondition,
      include: {
        teacher: { include: { user: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subject.count({ where: whereCondition }),
    prisma.teacher.findMany({ include: { user: true }, orderBy: { user: { name: 'asc' } } })
  ])

  const mappedTeachers = (Array.isArray(teachers) ? teachers : []).map(t => ({ id: t.id, name: t.user.name }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manage Subjects</h1>
        <SubjectForm teachers={mappedTeachers} />
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-md shadow-sm border border-slate-200">
        <DataTableSearch placeholder="Search by name or code..." />
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Subject Teacher</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                  No subjects found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              subjects.map((subject) => (
                <TableRow key={subject.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-600">{subject.code}</TableCell>
                  <TableCell className="font-bold text-slate-800">{subject.name}</TableCell>
                  <TableCell className="text-slate-600">
                    {subject.teacher?.user.name || <span className="text-slate-400 italic">Unassigned</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteSubjectButton id={subject.id} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls totalItems={totalItems} pageSize={pageSize} currentPage={page} />
      </div>
    </div>
  )
}
