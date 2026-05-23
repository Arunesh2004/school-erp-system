import prisma from "@/lib/prisma"
import { SessionManager } from "./session-manager"
import { CalendarDays } from "lucide-react"

export default async function AcademicSessionPage() {
  const sessions = await prisma.academicSession.findMany({
    orderBy: { startDate: "desc" },
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Academic Sessions</h1>
          <p className="text-slate-500 text-sm">Manage the yearly academic lifecycle and archival process.</p>
        </div>
      </div>

      <SessionManager initialSessions={sessions} />
    </div>
  )
}
