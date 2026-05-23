"use client"

import { useState, useTransition } from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { upsertAttendance } from "@/app/actions/attendance"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Student, User, Attendance } from "@prisma/client"

type StudentWithAttendance = Student & {
  user: User
  attendance: Attendance[]
}

export function InlineAttendanceRow({ student, classId, date }: { student: StudentWithAttendance, classId: string, date: string }) {
  const [isPending, startTransition] = useTransition()
  
  const existingRecord = student.attendance[0]
  const [status, setStatus] = useState<"PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "">(existingRecord?.status || "")
  const [remarks, setRemarks] = useState<string>(existingRecord?.remarks || "")

  const handleStatusChange = (newStatus: string | null) => {
    if (!newStatus || newStatus === "") return
    const validStatus = newStatus as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
    setStatus(validStatus)
    saveChanges(validStatus, remarks)
  }

  const handleRemarksBlur = () => {
    if (status !== "") {
      saveChanges(status, remarks)
    }
  }

  const handleRemarksKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && status !== "") {
      e.currentTarget.blur()
    }
  }

  const saveChanges = (saveStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED", saveRemarks: string) => {
    startTransition(async () => {
      const result = await upsertAttendance({
        studentId: student.id,
        classId,
        date,
        status: saveStatus,
        remarks: saveRemarks
      })
      if (result.error) {
        toast.error(result.error)
        setStatus(existingRecord?.status || "") // Revert optimistically
      } else {
        toast.success(`Saved for ${student.user.name}`)
      }
    })
  }

  return (
    <TableRow className={`hover:bg-slate-50/50 ${isPending ? 'opacity-50' : ''}`}>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="text-slate-900">{student.user.name}</span>
          <span className="text-xs text-slate-500">{student.user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
            <SelectTrigger className="w-[140px] shadow-sm">
              <SelectValue placeholder="Mark Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRESENT">Present</SelectItem>
              <SelectItem value="ABSENT">Absent</SelectItem>
              <SelectItem value="LATE">Late</SelectItem>
              <SelectItem value="EXCUSED">Excused</SelectItem>
            </SelectContent>
          </Select>
          
          {status === "PRESENT" && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">P</Badge>}
          {status === "ABSENT" && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">A</Badge>}
          {status === "LATE" && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">L</Badge>}
          {status === "EXCUSED" && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">E</Badge>}
        </div>
      </TableCell>
      <TableCell>
        <Input 
          placeholder="Optional remarks..." 
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          onBlur={handleRemarksBlur}
          onKeyDown={handleRemarksKeyDown}
          disabled={isPending || status === ""}
          className="shadow-sm"
        />
      </TableCell>
    </TableRow>
  )
}
