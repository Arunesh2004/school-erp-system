import prisma from "@/lib/prisma"
import { SettingsForm } from "./settings-form"
import { Building2 } from "lucide-react"

export default async function AdminSettingsPage() {
  // Fetch existing or get defaults
  let settings = await prisma.schoolSettings.findUnique({
    where: { id: "default" }
  })

  // Provide initial defaults if not yet seeded
  if (!settings) {
    settings = {
      id: "default",
      schoolName: "EduManage Academy",
      schoolAddress: "123 Education Lane, Learning City",
      contactNumber: "+1 234 567 8900",
      principalName: "Dr. Jane Doe",
      email: "contact@edumanage.com",
      activeSessionId: null,
      updatedAt: new Date(),
    }
  }

  const activeSessionName = settings.activeSessionId 
    ? (await prisma.academicSession.findUnique({ where: { id: settings.activeSessionId } }))?.name 
    : "No Active Session";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-900 text-white rounded-lg">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Institutional Settings</h1>
          <p className="text-slate-500 text-sm">Manage your school's global branding and academic configuration.</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-slate-800">School Identity</h2>
          <p className="text-sm text-slate-500">This information will be displayed on all generated PDFs, marksheets, and official documents.</p>
        </div>
        <div className="p-6">
          <SettingsForm initialData={settings} activeSessionName={activeSessionName || "No Active Session"} />
        </div>
      </div>
    </div>
  )
}
