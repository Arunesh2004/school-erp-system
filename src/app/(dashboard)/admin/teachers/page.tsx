import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TeacherForm } from "./teacher-form"
import { DeleteTeacherButton } from "./delete-teacher"
import { DataTableSearch } from "@/components/ui/data-table-search"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { AssignClassModal } from "@/components/dashboard/assign-class-modal"
import { Badge } from "@/components/ui/badge"

export default async function AdminTeachersPage(
  props: { searchParams: Promise<{ q?: string, page?: string }> }
) {
  const searchParams = await props.searchParams
  const query = searchParams.q || ""
  const page = parseInt(searchParams.page || "1")
  const pageSize = 10

  const whereCondition: Prisma.TeacherWhereInput = {
    user: {
      name: { contains: query }
    }
  }

    const [teachers, totalItems, classes] = await Promise.all([
      prisma.teacher.findMany({
        where: whereCondition,
        include: {
          user: true,
          classes: true, // A teacher can be assigned as a class teacher
        },
        orderBy: { user: { name: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.teacher.count({ where: whereCondition }),
      prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
    ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manage Teachers</h1>
        <TeacherForm />
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-md shadow-sm border border-slate-200">
        <DataTableSearch placeholder="Search by name..." />
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Class Teacher</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-slate-500">
                  No teachers found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              (Array.isArray(teachers) ? teachers : []).map((teacher) => (
                <TableRow key={teacher.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{teacher.user.name || "Unknown Teacher"}</TableCell>
                  <TableCell className="text-slate-600">{teacher.user.email}</TableCell>
                  <TableCell>
                    {teacher.classes && teacher.classes.length > 0 ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">
                        {teacher.classes[0].name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 border-none">
                        Not Assigned
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <AssignClassModal 
                        teacherId={teacher.id} 
                        teacherName={teacher.user.name || "Unknown"} 
                        assignedClassId={teacher.classes && teacher.classes.length > 0 ? teacher.classes[0].id : null}
                        classes={classes}
                      />
                      <DeleteTeacherButton id={teacher.user.id} />
                    </div>
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
