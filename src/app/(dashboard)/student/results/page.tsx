import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { FileText, Calendar, ChevronRight, History } from "lucide-react"
import Link from "next/link"

export default async function StudentResultsPage() {
  const session = await verifySession()
  const studentUser = await prisma.user.findUnique({
    where: { id: session?.userId },
    include: { 
      student: {
        include: {
          class: true,
          academicRecords: {
            orderBy: { academicSession: 'desc' }
          }
        }
      } 
    }
  })
  
  if (!studentUser?.student) return <div>Unauthorized</div>

  const student = studentUser.student
  const academicRecords = student.academicRecords.filter(r => r.status === "PUBLISHED" || r.status === "FINALIZED")

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Academic Results</h1>
        <p className="text-slate-500">View and download your official report cards and marksheets.</p>
      </div>

      {academicRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {academicRecords.map((record) => {
            const isFinalized = record.status === "FINALIZED"
            
            return (
              <Card key={record.id} className="shadow-sm hover:shadow-md transition-shadow duration-200 border-slate-200 group flex flex-col h-full">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${isFinalized ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isFinalized ? "Finalized" : "Published"}
                    </span>
                  </div>
                  <CardTitle className="text-xl mt-4">Session {record.academicSession}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 mt-1">
                    <Calendar className="w-4 h-4" /> Class: {student.class?.name || "Unassigned"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <span className="text-sm text-slate-500">Percentage</span>
                      <span className="font-bold text-slate-900">{record.finalPercentage ?? 0}%</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <span className="text-sm text-slate-500">Grade</span>
                      <span className="font-bold text-indigo-700 text-lg">{record.finalGrade ?? "N/A"}</span>
                    </div>
                  </div>
                  
                  <Link 
                    href={`/student/results/${record.id}`}
                    className={buttonVariants({ variant: "default" }) + " w-full justify-between group-hover:bg-indigo-600 transition-colors"}
                  >
                    View Report Card
                    <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <History className="w-12 h-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">No Academic Records</h2>
          <p className="text-slate-500 max-w-md mt-2">
            You do not have any published or finalized academic records yet. They will appear here once your class teacher publishes them.
          </p>
        </div>
      )}
    </div>
  )
}
