import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function TeacherClassesPage() {
  const session = await verifySession()
  const teacherUser = await prisma.user.findUnique({
    where: { id: session?.userId },
    include: { teacher: true }
  })
  
  if (!teacherUser?.teacher) return <div>Unauthorized</div>

  const classes = await prisma.class.findMany({
    where: { teacherId: teacherUser.teacher.id },
    include: {
      students: {
        include: { user: true }
      }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Classes</h1>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
          You have not been assigned as a teacher for any class.
        </div>
      ) : (
        (Array.isArray(classes) ? classes : []).map((cls) => (
          <div key={cls.id} className="rounded-md border bg-card p-6">
            <h2 className="text-lg font-medium mb-4">{cls.name} - Students</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cls.students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                      No students found in this class.
                    </TableCell>
                  </TableRow>
                ) : (
                  (Array.isArray(cls.students) ? cls.students : []).map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.user.name || "Unknown Student"}</TableCell>
                      <TableCell>{student.user.email}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  )
}
