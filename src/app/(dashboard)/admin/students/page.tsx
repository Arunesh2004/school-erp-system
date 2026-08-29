import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StudentForm } from "./student-form"
import { DeleteStudentButton } from "./delete-student"
import { StudentHistoryDialog } from "./student-history"
import { DataTableSearch } from "@/components/ui/data-table-search"
import { DataTableFilter } from "@/components/ui/data-table-filter"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { CsvExportButton } from "@/components/dashboard/csv-export-button"
import { exportAllStudents } from "@/app/actions/export"
import { ResetPasswordButton } from "@/components/dashboard/reset-password-button"

export default async function AdminStudentsPage(
  props: { searchParams: Promise<{ q?: string, page?: string, classId?: string }> }
) {
  const searchParams = await props.searchParams
  const query = searchParams.q || ""
  const page = parseInt(searchParams.page || "1")
  const classId = searchParams.classId || "all"
  const pageSize = 10

  const whereCondition: Prisma.StudentWhereInput = {
    user: {
      name: { contains: query }
    }
  }

  if (classId === "unassigned") {
    whereCondition.classId = null
  } else if (classId !== "all") {
    whereCondition.classId = classId
  }

  const [students, totalItems, classes] = await Promise.all([
    prisma.student.findMany({
      where: whereCondition,
      include: {
        user: true,
        class: true,
        enrollments: {
          include: { academicSession: true, class: true },
          orderBy: { academicSession: { startDate: 'desc' } }
        }
      },
      orderBy: { user: { name: 'asc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where: whereCondition }),
    prisma.class.findMany({ orderBy: { name: 'asc' } })
  ])

  const classOptions = [
    { label: "Unassigned", value: "unassigned" },
    ...(Array.isArray(classes) ? classes : []).map(c => ({ label: c.name, value: c.id }))
  ]

  const exportData = (Array.isArray(students) ? students : []).map(student => ({
    name: student.user.name,
    email: student.user.email,
    className: student.class?.name || "Unassigned",
    enrolledDate: new Date(student.user.createdAt).toLocaleDateString()
  }))

  const exportColumns = [
    { header: "Name", key: "name" },
    { header: "Email", key: "email" },
    { header: "Class", key: "className" },
    { header: "Enrolled Date", key: "enrolledDate" }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manage Students</h1>
        <div className="flex items-center gap-3">
          <CsvExportButton
            data={exportData as Record<string, unknown>[]}
            filename="Students_Export"
            columns={exportColumns}
            fetchAllAction={exportAllStudents.bind(null, classId) as any}
            label="Export All Students"
          />
          <StudentForm classes={classes} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-md shadow-sm border border-slate-200">
        <DataTableSearch placeholder="Search by name..." />
        <DataTableFilter paramKey="classId" title="Class" options={classOptions} />
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                  No students found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              (Array.isArray(students) ? students : []).map((student) => (
                <TableRow key={student.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{student.user.name || "Unknown Student"}</TableCell>
                  <TableCell className="text-slate-600">{student.user.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-700">
                      {student.class?.name || "Unassigned"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <StudentHistoryDialog studentName={student.user.name || "Unknown"} enrollments={student.enrollments} />
                    <ResetPasswordButton userId={student.user.id} userName={student.user.name || "Student"} />
                    <DeleteStudentButton id={student.user.id} />
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
