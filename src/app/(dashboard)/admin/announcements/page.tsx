import prisma from "@/lib/prisma"
import { Bell } from "lucide-react"
import { AnnouncementForm } from "@/components/dashboard/announcement-form"
import { DeleteAnnouncementButton } from "@/components/dashboard/delete-announcement"
import { Badge } from "@/components/ui/badge"

export default async function AdminAnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Announcements</h1>
            <p className="text-slate-500 text-sm">Publish global notices and alerts.</p>
          </div>
        </div>
        <AnnouncementForm />
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-slate-500 shadow-sm">
            No announcements published yet.
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-white border rounded-xl shadow-sm p-6 relative overflow-hidden">
              {announcement.priority === "HIGH" && (
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              )}
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg text-slate-900">{announcement.title}</h3>
                  {announcement.priority === "HIGH" && (
                    <Badge variant="destructive" className="h-5">High Priority</Badge>
                  )}
                  <Badge variant="outline" className="bg-slate-50 text-slate-600 h-5">
                    Target: {announcement.targetRoles}
                  </Badge>
                </div>
                <DeleteAnnouncementButton id={announcement.id} />
              </div>
              <p className="text-slate-600 whitespace-pre-wrap text-sm mt-3">{announcement.content}</p>
              <div className="mt-4 text-xs text-slate-400 font-medium">
                Published: {announcement.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
