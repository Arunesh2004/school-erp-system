import { BellRing } from "lucide-react"
import { getMyAlerts } from "@/app/actions/alert"
import { AlertInboxList } from "@/components/dashboard/alert-inbox-list"

export default async function StudentAlertsPage() {
  const activeAlerts = await getMyAlerts("ACTIVE")

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
          <BellRing className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inbox</h1>
          <p className="text-slate-500 text-sm">Targeted alerts and notices from your teachers and school.</p>
        </div>
      </div>

      <AlertInboxList initialAlerts={activeAlerts} />
    </div>
  )
}
