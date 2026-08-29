import { BellRing, CheckCircle, Clock, ShieldAlert } from "lucide-react"
import { getMyAlerts } from "@/app/actions/alert"
import { AlertInboxList } from "@/components/dashboard/alert-inbox-list"
import { CreateAlertForm } from "@/components/dashboard/create-alert-form"
import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { requireActiveSessionId } from "@/lib/auth/teacher-authorization"
import { Badge } from "@/components/ui/badge"

export default async function TeacherAlertsPage() {
  const session = await verifySession()
  const academicSessionId = await requireActiveSessionId()
  
  if (!session) return null;

  // Fetch teacher to get ID
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  
  let assignedClasses: { id: string, name: string }[] = []
  if (teacher) {
    const assignments = await prisma.classTeacherAssignment.findMany({
      where: { teacherId: teacher.id, academicSessionId, isActive: true },
      include: { class: true }
    })
    assignedClasses = assignments.map(a => ({ id: a.class.id, name: a.class.name }))
  }

  const activeAlerts = await getMyAlerts("ACTIVE")
  
  const myPublishedAlerts = await prisma.alert.findMany({
    where: { creatorId: session.userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { recipients: true } } }
  })

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alerts & Notifications</h1>
            <p className="text-slate-500 text-sm">View your inbox and manage alerts for your assigned classes.</p>
          </div>
        </div>
        {assignedClasses.length > 0 && (
          <CreateAlertForm isAdmin={false} assignedClasses={assignedClasses} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inbox Section */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">My Inbox</h2>
          <AlertInboxList initialAlerts={activeAlerts} />
        </div>

        {/* Published Alerts Section */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Published by Me</h2>
          
          <div className="space-y-4">
            {myPublishedAlerts.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-8 text-center text-slate-500 text-sm">
                You haven't published any alerts yet.
                {assignedClasses.length === 0 && <div className="mt-2 text-slate-400">Only Class Teachers can publish alerts.</div>}
              </div>
            ) : (
              myPublishedAlerts.map((alert) => (
                <div key={alert.id} className="bg-white border rounded-xl shadow-sm p-5 relative overflow-hidden transition-all hover:shadow-md">
                  {alert.priority === "URGENT" && <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>}
                  
                  <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900">{alert.title}</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant={alert.status === "PUBLISHED" ? "default" : "secondary"}>
                        {alert.status}
                      </Badge>
                      {alert.requiresAcknowledgement && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <ShieldAlert className="h-3 w-3 mr-1" /> Ack Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-slate-600 text-sm line-clamp-2">{alert.message}</p>
                  
                  <div className="mt-3 flex items-center gap-4 text-xs font-medium text-slate-500 border-t pt-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {alert.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {alert._count.recipients} Recipients
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
