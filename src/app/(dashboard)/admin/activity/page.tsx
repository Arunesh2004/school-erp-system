import prisma from "@/lib/prisma"
import { ShieldAlert, Activity } from "lucide-react"

export default async function AdminActivityPage() {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      actor: true
    },
    take: 100 // Limit to recent 100 logs
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-800 text-white rounded-lg shadow-sm">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit & Activity Log</h1>
          <p className="text-slate-500 text-sm">Monitor critical system events and user actions.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            Recent Activity (Last 100)
          </h2>
        </div>
        
        <div className="divide-y divide-slate-100">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No activity logs recorded yet.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-xs font-bold text-slate-600">
                  {log.actor?.name?.substring(0, 2).toUpperCase() || log.actor?.email.substring(0, 2).toUpperCase() || "NA"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                    <p className="text-sm font-medium text-slate-900">
                      {log.actor?.name || log.actor?.email} <span className="text-slate-500 font-normal">performed</span> {log.action.replace(/_/g, ' ')}
                    </p>
                    <time className="text-xs text-slate-400 whitespace-nowrap">
                      {log.createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </time>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {log.entityType}
                    </span>
                    {log.details && (
                      <span className="text-xs text-slate-500 truncate">{log.details}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
