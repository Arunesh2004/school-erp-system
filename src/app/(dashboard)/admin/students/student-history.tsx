"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { History } from "lucide-react"

type Enrollment = {
  id: string
  academicSession: { name: string }
  class: { name: string }
}

export function StudentHistoryDialog({ studentName, enrollments }: { studentName: string, enrollments: Enrollment[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600" onClick={() => setOpen(true)}>
        <History className="h-4 w-4 mr-1" /> History
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{studentName}'s Enrollment History</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {enrollments.length === 0 ? (
            <p className="text-sm text-slate-500">No enrollment history found.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-medium text-slate-600">Academic Session</th>
                    <th className="text-left p-2 font-medium text-slate-600">Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {enrollments.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="p-2">{e.academicSession.name}</td>
                      <td className="p-2">{e.class.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
