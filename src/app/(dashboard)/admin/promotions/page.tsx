import prisma from "@/lib/prisma"
import { PromotionEngine } from "./promotion-engine"
import { ArrowUpRight } from "lucide-react"

export default async function PromotionsPage() {
  const classes = await prisma.class.findMany({
    orderBy: { name: 'asc' }
  })

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const activeSessionId = settings?.activeSessionId

  if (!activeSessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Session</h2>
        <p className="text-slate-500 max-w-md">An administrator must set an active academic session before promoting students.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
          <ArrowUpRight className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Promotion Engine</h1>
          <p className="text-slate-500 text-sm">Safely promote students to the next academic level.</p>
        </div>
      </div>

      <PromotionEngine classes={classes} activeSessionId={activeSessionId} />
    </div>
  )
}
