"use client"

import { useState, useTransition } from "react"
import { assignClassTeacher } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function AssignClassModal({
  teacherId,
  teacherName,
  assignedClassId,
  classes
}: {
  teacherId: string
  teacherName: string
  assignedClassId: string | null
  classes: { id: string, name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedClassId, setSelectedClassId] = useState<string>(assignedClassId || "")

  const handleAssign = () => {
    if (!selectedClassId) {
      toast.error("Please select a class.")
      return
    }

    startTransition(async () => {
      const res = await assignClassTeacher(teacherId, selectedClassId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Class successfully assigned to ${teacherName}`)
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button variant={assignedClassId ? "outline" : "default"} size="sm">
            {assignedClassId ? "Change Class" : "Assign Class"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Class Teacher</DialogTitle>
          <DialogDescription>
            Select a class to assign to {teacherName}. This will automatically replace any existing assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="" disabled>Select Class...</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={isPending || !selectedClassId || selectedClassId === assignedClassId}>
              {isPending ? "Assigning..." : "Assign Class"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
