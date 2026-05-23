"use client"

import { useState, useTransition } from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { upsertMark } from "@/app/actions/teacher"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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

interface InlineMarkRowProps {
  mark: MarkData
  isSelected: boolean
  onToggleSelect: (id: string) => void
}

export function InlineMarkRow({ mark, isSelected, onToggleSelect }: InlineMarkRowProps) {
  const [isPending, startTransition] = useTransition()
  
  // Local state for optimistic updates
  const [score, setScore] = useState(mark.score.toString())
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(mark.status)

  const handleSave = () => {
    const numScore = parseFloat(score)
    if (isNaN(numScore) || numScore < 0 || numScore > mark.maxScore) {
      toast.error(`Invalid score. Must be between 0 and ${mark.maxScore}`)
      setScore(mark.score.toString()) // revert
      return
    }

    if (numScore === mark.score && status === mark.status) {
      return // No changes
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append("studentId", mark.studentId)
      formData.append("subjectId", mark.subjectId)
      formData.append("examType", mark.examType)
      formData.append("score", numScore.toString())
      formData.append("status", status)

      const result = await upsertMark(formData)
      if (result.error) {
        toast.error(result.error)
        // Revert on error
        setScore(mark.score.toString())
        setStatus(mark.status)
      } else {
        toast.success("Mark updated successfully")
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur() // Remove focus
      handleSave()
    } else if (e.key === 'Escape') {
      setScore(mark.score.toString())
      e.currentTarget.blur()
    }
  }

  return (
    <TableRow className={`hover:bg-slate-50/50 ${isPending ? 'opacity-50' : ''}`}>
      <TableCell className="w-[50px]">
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggleSelect(mark.id)} 
          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
            {(mark.student.user.name || "NA").substring(0, 2).toUpperCase()}
          </div>
          {mark.student.user.name || "Unknown Student"}
        </div>
      </TableCell>
      <TableCell className="text-slate-600 font-medium">{mark.subject.name}</TableCell>
      <TableCell className="text-slate-600 text-sm">{mark.examType}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 max-w-[120px]">
          <Input 
            type="number" 
            value={score} 
            onChange={(e) => setScore(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            className="h-8 w-20 text-right font-medium"
            min={0}
            max={mark.maxScore}
          />
          <span className="text-xs text-slate-400">/ {mark.maxScore}</span>
        </div>
      </TableCell>
      <TableCell>
        <Select 
          value={status} 
          onValueChange={(val) => {
            if (!val) return
            const newStatus = val as "DRAFT" | "PUBLISHED"
            setStatus(newStatus)
            // Need to save immediately on status change
            startTransition(async () => {
              const formData = new FormData()
              formData.append("studentId", mark.studentId)
              formData.append("subjectId", mark.subjectId)
              formData.append("examType", mark.examType)
              formData.append("score", score)
              formData.append("status", newStatus)
              const result = await upsertMark(formData)
              if (result.error) {
                toast.error(result.error)
                setStatus(mark.status) // revert
              } else {
                toast.success(`Status updated to ${newStatus}`)
              }
            })
          }}
          disabled={isPending}
        >
          <SelectTrigger className={`h-8 w-[110px] text-xs font-semibold ${status === 'PUBLISHED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right w-[50px]">
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400 mx-auto" />}
      </TableCell>
    </TableRow>
  )
}
