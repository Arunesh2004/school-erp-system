import prisma from "@/lib/prisma"
import { PromotionEngine } from "./promotion-engine"
import { ArrowUpRight } from "lucide-react"

export default async function PromotionsPage() {
  const classes = await prisma.class.findMany({
    orderBy: { name: 'asc' }
  })

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

      <PromotionEngine classes={classes} />
    </div>
  )
}
