"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { upsertMark } from "@/app/actions/teacher"

export function MarkForm({
  students,
  subjects,
  existingMark
}: {
  students: { id: string, name: string | null }[],
  subjects: { id: string, name: string }[],
  existingMark?: { studentId: string, subjectId: string, examType: string, score: number, status: string }
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    const formData = new FormData(e.currentTarget)
    
    // Status depends on the submit button pressed
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement
    formData.append("status", submitter.value)

    startTransition(async () => {
      const res = await upsertMark(formData)
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button variant={existingMark ? "outline" : "default"} size={existingMark ? "sm" : "default"} onClick={() => setOpen(true)}>
        {existingMark ? "Edit Mark" : "Enter New Mark"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingMark ? "Edit Mark" : "Enter New Mark"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studentId">Student</Label>
            <Select name="studentId" defaultValue={existingMark?.studentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subjectId">Subject</Label>
            <Select name="subjectId" defaultValue={existingMark?.subjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="examType">Exam Type</Label>
            <Select name="examType" defaultValue={existingMark?.examType || "Midterm"}>
              <SelectTrigger>
                <SelectValue placeholder="Select exam type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Midterm">Midterm</SelectItem>
                <SelectItem value="Final">Final</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="score">Score (out of 100)</Label>
            <Input id="score" name="score" type="number" min="0" max="100" defaultValue={existingMark?.score} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 w-full pt-4">
            <Button type="submit" name="action" value="DRAFT" disabled={isPending} variant="secondary" className="w-full">
              Save as Draft
            </Button>
            <Button type="submit" name="action" value="PUBLISHED" disabled={isPending} className="w-full">
              Publish
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
