import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GraduationCap, History, Lock, Calendar } from "lucide-react"
import { PdfExportWrapper } from "@/components/dashboard/pdf-export-wrapper"
import { Badge } from "@/components/ui/badge"

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B"
  if (percentage >= 60) return "C"
  if (percentage >= 50) return "D"
  return "F"
}

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

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }, include: { activeSession: true } })
  const schoolName = settings?.schoolName || "EduManage Academy"
  const activeSessionName = settings?.activeSession?.name || "2025-2026"
  const principalName = settings?.principalName || "Principal"
  const address = settings?.schoolAddress || "Education City"

  // We fetch all marks for the current active session. Historical marks are preserved in the snapshot.
  const marks = await prisma.mark.findMany({
    where: { 
      studentId: student.id,
      status: "PUBLISHED"
      // Note: If marks don't have session, we just assume they are for the active session.
    },
    include: { subject: true },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-12">
      {academicRecords.map((record, index) => {
        const isCurrentSession = record.academicSession === activeSessionName
        const isFinalized = record.status === "FINALIZED"
        
        // For the current session, we show dynamic marks. For historical, we just show the snapshot summary.
        const showDetailedMarks = isCurrentSession && marks.length > 0
        
        const finalPercent = record.finalPercentage ?? 0
        const finalGrade = record.finalGrade ?? "N/A"
        const attendancePercent = record.attendancePercentage ?? "N/A"
        const remarks = record.teacherRemarks || "No remarks provided."

        const today = isFinalized && record.finalizedAt ? 
          new Date(record.finalizedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 
          new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

        return (
          <PdfExportWrapper key={record.id} filename={`${studentUser.name?.replace(/\s+/g, '_')}_${record.academicSession}_Marksheet.pdf`} targetId={`marksheet-${record.id}`}>
            <Card id={`marksheet-${record.id}`} className={`shadow-lg border-slate-200 bg-white print:shadow-none print:border-none overflow-hidden max-w-4xl mx-auto ${isFinalized ? 'border-orange-200' : ''}`}>
              
              {isFinalized && (
                <div className="bg-orange-50 px-4 py-2 text-orange-800 text-sm font-medium flex items-center justify-center gap-2 print:hidden">
                  <Lock className="w-4 h-4" /> This is a finalized historical academic record and cannot be modified.
                </div>
              )}

              {/* School Header */}
              <div className="bg-slate-900 text-white p-8 text-center print:bg-white print:text-black print:border-b-2 print:border-slate-900">
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-full print:border-2 print:border-black">
                    <GraduationCap className="h-10 w-10 text-slate-900 print:text-black" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold tracking-tight uppercase mb-1">{schoolName}</h1>
                <p className="text-slate-300 print:text-slate-600 text-sm tracking-widest uppercase">{address}</p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="bg-slate-800 print:bg-slate-100 print:text-black text-slate-200 px-6 py-2 rounded-full text-sm font-semibold tracking-wider uppercase border border-slate-700 print:border-slate-300">
                    Official Academic Transcript
                  </div>
                  <div className="bg-slate-800 print:bg-slate-100 print:text-black text-slate-200 px-6 py-2 rounded-full text-sm font-semibold tracking-wider uppercase border border-slate-700 print:border-slate-300">
                    Session: {record.academicSession}
                  </div>
                </div>
              </div>

              <CardContent className="p-8 print:p-0 pt-8 print:pt-8">
                {/* Student Info Block */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-12 mb-10 p-6 bg-slate-50 rounded-xl border border-slate-100 print:bg-transparent print:border-none print:p-0 print:mb-8">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Student Name</span>
                    <span className="text-lg font-bold text-slate-900">{studentUser.name}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</span>
                    <span className="text-lg font-medium text-slate-800">{isFinalized ? "Finalized" : "Published"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Class / Homeroom</span>
                    <span className="text-lg font-medium text-slate-800">{student.class?.name || "Unassigned"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Date of Issue</span>
                    <span className="text-lg font-medium text-slate-800">{today}</span>
                  </div>
                </div>

                {/* Subjects Table - Only for current session if not finalized or if we don't have separate marks per session */}
                {showDetailedMarks && (
                  <div className="mb-10 rounded-xl border border-slate-200 overflow-hidden print:rounded-none print:border-black">
                    <Table>
                      <TableHeader className="bg-slate-100 print:bg-slate-200">
                        <TableRow className="print:border-b-2 print:border-black">
                          <TableHead className="font-bold text-slate-700 py-4">Subject</TableHead>
                          <TableHead className="font-bold text-slate-700 py-4 text-center">Max</TableHead>
                          <TableHead className="font-bold text-slate-700 py-4 text-center">Obtained</TableHead>
                          <TableHead className="font-bold text-slate-700 py-4 text-center">%</TableHead>
                          <TableHead className="font-bold text-slate-700 py-4 text-center">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marks.map((mark) => {
                          const markPercentage = (mark.score / mark.maxScore) * 100;
                          const markGrade = calculateGrade(markPercentage);
                          return (
                            <TableRow key={mark.id} className="print:border-b print:border-slate-300">
                              <TableCell className="font-bold text-slate-800">{mark.subject.name}</TableCell>
                              <TableCell className="text-center font-medium text-slate-600">{mark.maxScore}</TableCell>
                              <TableCell className="text-center font-bold text-slate-900">{mark.score}</TableCell>
                              <TableCell className="text-center font-medium text-slate-700">{markPercentage.toFixed(1)}%</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-sm font-bold print:bg-transparent print:text-black`}>
                                  {markGrade}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Overall Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  <div className="md:col-span-2 bg-slate-50 rounded-xl p-6 border border-slate-100 print:bg-transparent print:border-black print:rounded-none">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Teacher Remarks</h3>
                    <div className="text-slate-600 italic whitespace-pre-wrap">
                      {remarks}
                    </div>
                  </div>
                  <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col justify-center items-center text-center print:bg-white print:text-black print:border-2 print:border-black print:rounded-none shadow-lg">
                    <span className="text-sm font-medium text-slate-300 print:text-slate-600 uppercase tracking-widest mb-2">Final Result</span>
                    <div className="text-5xl font-black mb-1">{finalGrade}</div>
                    <div className="text-xl font-medium text-slate-300 print:text-slate-800">{finalPercent}%</div>
                    {isFinalized && <div className="text-sm text-slate-400 mt-2">Attendance: {attendancePercent}%</div>}
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-8 mt-24 pt-8 border-t border-slate-200 print:border-black text-center print:mt-32">
                  <div>
                    <div className="border-b border-slate-300 print:border-black w-3/4 mx-auto mb-2"></div>
                    <span className="text-sm font-medium text-slate-600">Class Teacher</span>
                  </div>
                  <div className="relative">
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24 border-4 border-slate-200 print:border-slate-400 rounded-full flex items-center justify-center opacity-30 transform -rotate-12">
                      <span className="text-xs font-bold uppercase text-slate-500">Official Seal</span>
                    </div>
                  </div>
                  <div>
                    <div className="border-b border-slate-300 print:border-black w-3/4 mx-auto mb-2"></div>
                    <span className="text-sm font-medium text-slate-600">{principalName}</span>
                    <div className="text-xs text-slate-500 uppercase mt-1">Principal</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PdfExportWrapper>
        )
      })}

      {academicRecords.length === 0 && (
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
