"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { bulkMarkPresent } from "@/app/actions/attendance"
import { InlineAttendanceRow } from "./inline-attendance-row"
import { toast } from "sonner"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Class, Student, User, Attendance } from "@prisma/client"

type StudentWithAttendance = Student & {
  user: User
  attendance: Attendance[]
}

type ClassWithStudents = Class & {
  students: StudentWithAttendance[]
}

export function TeacherAttendanceTable({ classData, selectedDate, activeSessionId }: { classData: ClassWithStudents, selectedDate: string, activeSessionId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(selectedDate)

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setDate(newDate)
    startTransition(() => {
      router.push(`/teacher/attendance?date=${newDate}`)
    })
  }

  const handleMarkAllPresent = () => {
    const studentIds = classData.students.map((s) => s.id)
    startTransition(async () => {
      const res = await bulkMarkPresent(classData.id, date, studentIds, activeSessionId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Marked all present for ${classData.name}`)
      }
    })
  }

  const attendanceCount = classData.students.filter((s) => s.attendance.length > 0).length

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header controls */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{classData.name}</h2>
          <p className="text-sm text-slate-500">{classData.students.length} Students | {attendanceCount} Marked Today</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Input 
            type="date" 
            value={date} 
            onChange={handleDateChange} 
            className="w-[160px] bg-white shadow-sm" 
            disabled={isPending}
          />
          <Button 
            onClick={handleMarkAllPresent} 
            disabled={isPending || classData.students.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Mark All Present
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[300px]">Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[300px]">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classData.students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                  No students assigned to this class.
                </TableCell>
              </TableRow>
            ) : (
              classData.students.map((student) => (
                <InlineAttendanceRow 
                  key={student.id} 
                  student={student} 
                  classId={classData.id} 
                  date={date} 
                  activeSessionId={activeSessionId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
