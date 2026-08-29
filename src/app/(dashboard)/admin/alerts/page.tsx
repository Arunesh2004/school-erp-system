import prisma from "@/lib/prisma"
import { BellRing, ShieldAlert, CheckCircle, Clock } from "lucide-react"
import { CreateAlertForm } from "@/components/dashboard/create-alert-form"
import { Badge } from "@/components/ui/badge"

export default async function AdminAlertsPage() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { name: true } },
      _count: { select: { recipients: true } }
    }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alerts & Notifications</h1>
            <p className="text-slate-500 text-sm">Targeted priority notifications for specific users and classes.</p>
          </div>
        </div>
        <CreateAlertForm isAdmin={true} />
      </div>

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center">
            <BellRing className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No alerts created</h3>
            <p>Publish targeted alerts to specific roles or classes.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="bg-white border rounded-xl shadow-sm p-6 relative overflow-hidden transition-all hover:shadow-md">
              {alert.priority === "URGENT" && <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>}
              {alert.priority === "WARNING" && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>}
              {alert.priority === "NOTICE" && <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>}
              {alert.priority === "INFO" && <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>}

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-lg text-slate-900">{alert.title}</h3>
                  <Badge variant={
                    alert.status === "PUBLISHED" ? "default" :
                    alert.status === "CANCELLED" ? "destructive" : "secondary"
                  }>
                    {alert.status}
                  </Badge>
                  <Badge variant="outline" className="bg-slate-50 text-slate-600">
                    Target: {alert.targetType}
                  </Badge>
                  {alert.requiresAcknowledgement && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Requires Ack
                    </Badge>
                  )}
                </div>
              </div>
              
              <p className="text-slate-700 whitespace-pre-wrap text-sm">{alert.message}</p>
              
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 border-t pt-4">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {alert.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {alert._count.recipients} Recipients Targetted
                </div>
                <div>Created by: {alert.creator.name}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
