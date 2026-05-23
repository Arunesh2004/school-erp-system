"use client"

import { useState, useTransition } from "react"
import { AcademicSession } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSession, activateSession, archiveSession } from "@/app/actions/academic-sessions"
import { toast } from "sonner"
import { Archive, CheckCircle2, Play, Plus, AlertTriangle } from "lucide-react"

export function SessionManager({ initialSessions }: { initialSessions: AcademicSession[] }) {
  const [sessions, setSessions] = useState(initialSessions)
  const [isPending, startTransition] = useTransition()
  
  // Create Session State
  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Confirm State
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState("")

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startDate || !endDate) return

    startTransition(async () => {
      try {
        const newSess = await createSession({
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        })
        setSessions([newSess, ...sessions].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()))
        toast.success("Session created successfully. It is currently ARCHIVED.")
        setName("")
        setStartDate("")
        setEndDate("")
      } catch (err: any) {
        toast.error(err.message || "Failed to create session")
      }
    })
  }

  const handleActivate = (id: string) => {
    startTransition(async () => {
      try {
        await activateSession(id)
        toast.success("Session activated. The previous session has been archived.")
        setSessions(sessions.map(s => ({
          ...s,
          status: s.id === id ? "ACTIVE" : "ARCHIVED"
        })))
      } catch (err: any) {
        toast.error(err.message || "Failed to activate session")
      }
    })
  }

  const handleArchive = (id: string) => {
    if (confirmText !== "FINALIZE") {
      toast.error("You must type FINALIZE to confirm archiving.")
      return
    }

    startTransition(async () => {
      try {
        await archiveSession(id)
        toast.success("Session successfully archived.")
        setSessions(sessions.map(s => s.id === id ? { ...s, status: "ARCHIVED" } : s))
        setConfirmId(null)
        setConfirmText("")
      } catch (err: any) {
        toast.error(err.message || "Failed to archive session. Ensure no draft/unpublished records remain.")
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Create New Session */}
      <div className="bg-white border rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Plus className="h-5 w-5 text-indigo-500" />
          Create New Session
        </h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label>Session Name</Label>
            <Input required placeholder="e.g. 2026-2027" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700">
            Create Session
          </Button>
        </form>
      </div>

      {/* Session List */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Historical & Active Sessions</h2>
          <p className="text-sm text-slate-500">Only one session can be active at a time.</p>
        </div>
        <div className="divide-y">
          {sessions.map(s => (
            <div key={s.id} className={`p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${s.status === 'ACTIVE' ? 'bg-indigo-50/30' : ''}`}>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-lg text-slate-900">{s.name}</h3>
                  {s.status === "ACTIVE" ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ACTIVE
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-slate-500 flex items-center gap-1">
                      <Archive className="w-3 h-3" /> ARCHIVED
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {new Date(s.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - {new Date(s.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                {s.status === "ARCHIVED" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isPending}
                    onClick={() => handleActivate(s.id)}
                    className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Activate
                  </Button>
                )}

                {s.status === "ACTIVE" && confirmId !== s.id && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    disabled={isPending}
                    onClick={() => setConfirmId(s.id)}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Session
                  </Button>
                )}

                {confirmId === s.id && (
                  <div className="flex flex-col items-end gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
                      <AlertTriangle className="w-4 h-4" />
                      Type FINALIZE to archive
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={confirmText} 
                        onChange={(e) => setConfirmText(e.target.value)} 
                        className="w-32 h-8 border-red-200 focus-visible:ring-red-500" 
                        placeholder="FINALIZE"
                      />
                      <Button 
                        size="sm" 
                        variant="destructive"
                        disabled={isPending || confirmText !== "FINALIZE"}
                        onClick={() => handleArchive(s.id)}
                      >
                        Confirm
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => { setConfirmId(null); setConfirmText("") }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No academic sessions found. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
