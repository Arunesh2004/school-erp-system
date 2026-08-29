"use client"

import { useState, useTransition, useEffect } from "react"
import { Class } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPromotionEligibility, promoteStudents, PromotionStudentData } from "@/app/actions/promotions"
import { toast } from "sonner"
import { ArrowRight, AlertTriangle, UserCheck, UserX, UserMinus, ShieldCheck } from "lucide-react"

export function PromotionEngine({ classes, activeSessionId }: { classes: Class[], activeSessionId: string }) {
  const [sourceClassId, setSourceClassId] = useState("")
  const [destClassId, setDestClassId] = useState("")
  const [students, setStudents] = useState<PromotionStudentData[]>([])
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  
  // Confirm State
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  useEffect(() => {
    if (!sourceClassId) {
      setStudents([])
      setSelectedStudents(new Set())
      return
    }

    startTransition(async () => {
      try {
        const data = await getPromotionEligibility(sourceClassId)
        setStudents(data)
        // Auto-select eligible students
        const eligibleIds = data.filter(s => s.eligibility === "ELIGIBLE").map(s => s.id)
        setSelectedStudents(new Set(eligibleIds))
      } catch (err: any) {
        toast.error(err.message || "Failed to load eligibility data")
      }
    })
  }, [sourceClassId])

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStudents(next)
  }

  const handlePromote = () => {
    if (!destClassId) {
      toast.error("Please select a destination class.")
      return
    }
    if (selectedStudents.size === 0) {
      toast.error("No students selected for promotion.")
      return
    }
    if (confirmText !== "FINALIZE") {
      toast.error("You must type FINALIZE to confirm.")
      return
    }

    startTransition(async () => {
      try {
        await promoteStudents(Array.from(selectedStudents), destClassId, activeSessionId)
        toast.success(`Successfully promoted ${selectedStudents.size} students.`)
        
        // Refresh data
        setSourceClassId("")
        setDestClassId("")
        setIsConfirming(false)
        setConfirmText("")
      } catch (err: any) {
        toast.error(err.message || "Failed to promote students.")
      }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* Configuration */}
      <div className="bg-white border rounded-xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Source Class (Current)</Label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={sourceClassId} 
            onChange={e => setSourceClassId(e.target.value)}
          >
            <option value="">Select Class...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Destination Class (Next Year)</Label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={destClassId} 
            onChange={e => setDestClassId(e.target.value)}
          >
            <option value="">Select Class...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Student List */}
      {sourceClassId && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Promotion Eligibility ({students.length} Students)</h2>
            <div className="text-sm text-slate-500">
              Selected: <span className="font-bold text-slate-900">{selectedStudents.size}</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <input 
                      type="checkbox" 
                      checked={students.length > 0 && selectedStudents.size === students.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudents(new Set(students.map(s => s.id)))
                        else setSelectedStudents(new Set())
                      }}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Failed Subjects</th>
                  <th className="px-4 py-3">Record Status</th>
                  <th className="px-4 py-3">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox"
                        checked={selectedStudents.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {s.name}
                      <div className="text-xs text-slate-500">{s.rollNumber || "No Roll"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.attendancePercentage < 75 ? "text-red-600 font-medium" : "text-green-600"}>
                        {s.attendancePercentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.failedSubjectCount > 0 ? "text-red-600 font-medium" : "text-slate-600"}>
                        {s.failedSubjectCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={
                        s.recordStatus === "FINALIZED" ? "bg-slate-100 text-slate-700" :
                        s.recordStatus === "PUBLISHED" ? "bg-green-50 text-green-700 border-green-200" :
                        "bg-orange-50 text-orange-700 border-orange-200"
                      }>
                        {s.recordStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {s.eligibility === "ELIGIBLE" ? (
                        <span className="flex items-center text-green-600 font-medium"><UserCheck className="w-4 h-4 mr-1" /> Eligible</span>
                      ) : s.eligibility === "NOT_ELIGIBLE" ? (
                        <span className="flex items-center text-red-600 font-medium"><UserX className="w-4 h-4 mr-1" /> Not Eligible</span>
                      ) : (
                        <span className="flex items-center text-orange-600 font-medium"><UserMinus className="w-4 h-4 mr-1" /> Review Reqd</span>
                      )}
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No students found in the selected source class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
            <div className="text-sm text-slate-500 max-w-lg">
              <p className="font-medium text-slate-700 mb-1">Promotion Workflow:</p>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>Historical enrollment and marks are preserved in the current session.</li>
                <li>A new StudentEnrollment is created for the next session.</li>
                <li>The student's current class pointer is safely updated.</li>
              </ul>
              {students.filter(s => s.eligibility !== "ELIGIBLE").length > 0 && (
                <span className="flex items-center text-orange-600 mt-2 font-medium">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Some students require review.
                </span>
              )}
            </div>
            
            {isConfirming ? (
              <div className="flex items-center gap-3 bg-red-50 p-2 rounded-lg border border-red-100">
                <span className="text-sm font-medium text-red-700 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Type FINALIZE to promote {selectedStudents.size} students
                </span>
                <Input 
                  value={confirmText} 
                  onChange={e => setConfirmText(e.target.value)} 
                  placeholder="FINALIZE"
                  className="w-32 h-8"
                />
                <Button 
                  size="sm" 
                  variant="destructive" 
                  disabled={isPending || confirmText !== "FINALIZE"}
                  onClick={handlePromote}
                >
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsConfirming(false); setConfirmText(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => setIsConfirming(true)} 
                disabled={isPending || selectedStudents.size === 0 || !destClassId}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Promote Selected Students <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
