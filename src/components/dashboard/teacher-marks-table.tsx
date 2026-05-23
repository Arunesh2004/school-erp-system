"use client"

import { useState, useTransition } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { InlineMarkRow } from "./inline-mark-row"
import { bulkUpdateMarkStatus } from "@/app/actions/teacher"
import { toast } from "sonner"
import { Loader2, CheckCircle, Clock } from "lucide-react"

interface MarkData {
  id: string
  studentId: string
  subjectId: string
  examType: string
  score: number
  maxScore: number
  status: "DRAFT" | "PUBLISHED"
  student: { user: { name: string | null } }
  subject: { name: string }
}

export function TeacherMarksTable({ marks }: { marks: MarkData[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const handleToggleSelectAll = () => {
    if (selectedIds.size === marks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(marks.map(m => m.id)))
    }
  }

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleBulkAction = (status: "PUBLISHED" | "DRAFT") => {
    if (selectedIds.size === 0) return

    startTransition(async () => {
      const idsArray = Array.from(selectedIds)
      const result = await bulkUpdateMarkStatus(idsArray, status)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Successfully updated ${idsArray.length} marks to ${status}`)
        setSelectedIds(new Set()) // clear selection on success
      }
    })
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} row(s) selected
          </span>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="bg-white hover:bg-yellow-50 text-yellow-700 border-yellow-200"
              onClick={() => handleBulkAction("DRAFT")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
              Set to Draft
            </Button>
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleBulkAction("PUBLISHED")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Publish Selected
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[50px]">
                <input 
                  type="checkbox" 
                  checked={marks.length > 0 && selectedIds.size === marks.length}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Exam Type</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {marks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  No marks found. Use the Quick Entry form to add some.
                </TableCell>
              </TableRow>
            ) : (
              marks.map((mark) => (
                <InlineMarkRow 
                  key={mark.id} 
                  mark={mark} 
                  isSelected={selectedIds.has(mark.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
