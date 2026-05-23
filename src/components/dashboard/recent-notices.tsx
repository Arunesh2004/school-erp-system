import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export async function RecentNotices({ role }: { role: "STUDENT" | "TEACHER" | "ALL" }) {
  const notices = await prisma.announcement.findMany({
    where: {
      OR: [
        { targetRoles: "ALL" },
        { targetRoles: role }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  return (
    <Card className="shadow-sm border-slate-200 h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          Recent Notices
        </CardTitle>
        <CardDescription>Latest updates from administration</CardDescription>
      </CardHeader>
      <CardContent>
        {notices.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-sm">
            No recent announcements.
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <div key={notice.id} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-semibold text-sm text-slate-900 leading-tight">
                    {notice.title}
                  </h4>
                  {notice.priority === "HIGH" && (
                    <Badge variant="destructive" className="h-4 text-[10px] px-1.5 min-w-[32px] justify-center">High</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1">{notice.content}</p>
                <div className="text-[10px] text-slate-400 mt-2 font-medium">
                  {notice.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
