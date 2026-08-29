import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GraduationCap, Lock, ArrowLeft, Trophy, CheckCircle2 } from "lucide-react"
import { PdfExportWrapper } from "@/components/dashboard/pdf-export-wrapper"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B"
  if (percentage >= 60) return "C"
  if (percentage >= 50) return "D"
  return "F"
}

export default async function ReportCardPage({ params }: { params: Promise<{ recordId: string }> }) {
  const resolvedParams = await params;
  const session = await verifySession()
  if (session?.role !== "STUDENT") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Unauthorized</h2>
          <p className="text-slate-500 mt-2">You must be logged in as a student to view this page.</p>
        </div>
      </div>
    )
  }

  const recordId = resolvedParams.recordId

  const record = await prisma.studentAcademicRecord.findUnique({
    where: { id: recordId },
    include: {
      student: { include: { user: true, class: true } },
      academicSession: true,
      enrollment: { include: { class: true } }
    }
  })

  if (!record || record.student.userId !== session.userId) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Record Not Found</h2>
          <p className="text-slate-500 mt-2">The requested academic record could not be found or you do not have permission to view it.</p>
        </div>
        <Link href="/student/results" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
        </Link>
      </div>
    )
  }

  // Calculate Class Rank dynamically
  const peerRecords = await prisma.studentAcademicRecord.findMany({
    where: {
      classId: record.classId,
      academicSessionId: record.academicSessionId,
      status: { in: ["PUBLISHED", "FINALIZED"] }
    },
    orderBy: {
      finalPercentage: 'desc'
    },
    select: { id: true, finalPercentage: true }
  })

  const rankIndex = peerRecords.findIndex(r => r.id === record.id)
  const classRank = rankIndex !== -1 ? rankIndex + 1 : 'N/A'
  const totalStudents = peerRecords.length

  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
  const schoolName = settings?.schoolName || "EduManage Academy"
  const principalName = settings?.principalName || "Principal"
  const address = settings?.schoolAddress || "Education City"

  // Fetch Marks
  const marks = await prisma.mark.findMany({
    where: { 
      studentId: record.studentId,
      academicSessionId: record.academicSessionId,
      status: "PUBLISHED"
    },
    include: { subject: true },
    orderBy: { subject: { name: 'asc' } }
  })

  const isFinalized = record.status === "FINALIZED"
  const finalPercent = record.finalPercentage ?? 0
  const finalGrade = record.finalGrade ?? "N/A"
  const attendancePercent = record.attendancePercentage ?? "N/A"
  const remarks = record.teacherRemarks || "No remarks provided."

  // Promotion Logic: Simple heuristic based on finalized status and passing grade
  const isPassing = finalPercent >= 40 && (record.failedSubjectCount || 0) === 0
  const promotionStatus = isFinalized 
    ? (isPassing ? "PROMOTED" : "RETAINED")
    : "PENDING"

  const today = isFinalized && record.finalizedAt 
    ? new Date(record.finalizedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4 print:hidden">
        <Link href="/student/results" className={buttonVariants({ variant: "outline", size: "sm" }) + " bg-white"}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Link>
      </div>

      <PdfExportWrapper filename={`${record.student.user.name?.replace(/\s+/g, '_')}_${record.academicSession.name}_Report_Card.pdf`} targetId={`marksheet-${record.id}`}>
        <Card id={`marksheet-${record.id}`} className={`shadow-xl border-slate-200 bg-white print:shadow-none print:border-none overflow-hidden ${isFinalized ? 'border-indigo-200' : ''}`}>
          
          {isFinalized && (
            <div className="bg-indigo-50 px-4 py-2 text-indigo-800 text-sm font-medium flex items-center justify-center gap-2 print:hidden">
              <Lock className="w-4 h-4" /> This official academic record has been finalized and securely locked.
            </div>
          )}

          {/* Premium School Header */}
          <div className="bg-slate-900 text-white p-10 text-center relative print:bg-white print:text-black print:border-b-4 print:border-slate-900">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] print:hidden"></div>
            
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-full shadow-lg print:border-2 print:border-black mb-6">
                <GraduationCap className="h-12 w-12 text-slate-900 print:text-black" />
              </div>
              <h1 className="text-4xl font-black tracking-tight uppercase mb-2 font-serif">{schoolName}</h1>
              <p className="text-slate-300 print:text-slate-600 text-sm tracking-widest uppercase font-medium">{address}</p>
              
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="bg-slate-800/80 backdrop-blur-sm print:bg-slate-100 print:text-black text-white px-8 py-2.5 rounded-full text-sm font-bold tracking-wider uppercase border border-slate-700 print:border-slate-300">
                  Official Academic Transcript
                </div>
                <div className="bg-indigo-600/90 backdrop-blur-sm print:bg-slate-100 print:text-black text-white px-8 py-2.5 rounded-full text-sm font-bold tracking-wider uppercase border border-indigo-500 print:border-slate-300">
                  Session: {record.academicSession.name}
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-10 print:p-0 pt-10 print:pt-10">
            {/* Student Info Block */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 mb-12 p-8 bg-slate-50/80 rounded-2xl border border-slate-200/60 print:bg-transparent print:border-none print:p-0 print:mb-10">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Student Name</span>
                <span className="text-lg font-black text-slate-900">{record.student.user.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Roll Number</span>
                <span className="text-lg font-bold text-slate-800">{record.student.rollNumber || "N/A"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Class / Homeroom</span>
                <span className="text-lg font-bold text-slate-800">{record.enrollment?.class?.name || record.student.class?.name || "Unassigned"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date of Issue</span>
                <span className="text-lg font-bold text-slate-800">{today}</span>
              </div>
            </div>

            {/* Subjects Table */}
            <div className="mb-12 rounded-2xl border border-slate-200 overflow-hidden print:rounded-none print:border-2 print:border-black shadow-sm print:shadow-none">
              <Table>
                <TableHeader className="bg-slate-100/80 print:bg-slate-200 border-b border-slate-200 print:border-black">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-extrabold text-slate-800 py-5 uppercase tracking-wider text-xs">Subject</TableHead>
                    <TableHead className="font-extrabold text-slate-800 py-5 text-center uppercase tracking-wider text-xs">Max Marks</TableHead>
                    <TableHead className="font-extrabold text-slate-800 py-5 text-center uppercase tracking-wider text-xs">Marks Obtained</TableHead>
                    <TableHead className="font-extrabold text-slate-800 py-5 text-center uppercase tracking-wider text-xs">Percentage</TableHead>
                    <TableHead className="font-extrabold text-slate-800 py-5 text-center uppercase tracking-wider text-xs">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marks.map((mark, idx) => {
                    const markPercentage = (mark.score / mark.maxScore) * 100;
                    const markGrade = calculateGrade(markPercentage);
                    const isEven = idx % 2 === 0;
                    return (
                      <TableRow key={mark.id} className={`print:border-b print:border-slate-300 hover:bg-slate-50 ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <TableCell className="font-bold text-slate-900 py-4">{mark.subject.name}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-500 py-4">{mark.maxScore}</TableCell>
                        <TableCell className="text-center font-black text-slate-900 py-4">{mark.score}</TableCell>
                        <TableCell className="text-center font-bold text-slate-700 py-4">{markPercentage.toFixed(1)}%</TableCell>
                        <TableCell className="text-center py-4">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black ${
                            markGrade.includes('A') ? 'bg-emerald-100 text-emerald-800' : 
                            markGrade.includes('B') ? 'bg-blue-100 text-blue-800' :
                            markGrade.includes('C') ? 'bg-yellow-100 text-yellow-800' :
                            markGrade.includes('D') ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          } print:bg-transparent print:text-black`}>
                            {markGrade}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Performance Summary & Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-16">
              
              {/* Remarks Section */}
              <div className="md:col-span-7 flex flex-col gap-8">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm print:border-black print:rounded-none">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 print:border-slate-300 pb-3">Class Teacher Remarks</h3>
                  <div className="text-slate-700 italic font-medium leading-relaxed whitespace-pre-wrap">
                    &quot;{remarks}&quot;
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm print:bg-transparent print:border-black print:rounded-none flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-1">Attendance Record</h3>
                    <p className="text-sm font-medium text-slate-600">Total present days across the academic session</p>
                  </div>
                  <div className="text-3xl font-black text-slate-900">{attendancePercent}%</div>
                </div>
              </div>

              {/* Final Result Block */}
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="bg-slate-900 text-white rounded-2xl p-8 flex flex-col justify-center items-center text-center print:bg-white print:text-black print:border-4 print:border-black print:rounded-none shadow-xl h-full relative overflow-hidden">
                  
                  {/* Decorative element */}
                  <div className="absolute -right-6 -top-6 opacity-10 print:hidden">
                    <Trophy className="w-32 h-32" />
                  </div>
                  
                  <span className="text-xs font-bold text-slate-400 print:text-slate-500 uppercase tracking-widest mb-4 relative z-10">Overall Result</span>
                  <div className="text-6xl font-black mb-2 relative z-10">{finalGrade}</div>
                  <div className="text-2xl font-bold text-slate-300 print:text-slate-700 relative z-10">{finalPercent}%</div>
                  
                  <div className="w-full h-px bg-slate-800 print:bg-slate-300 my-6 relative z-10"></div>
                  
                  <div className="grid grid-cols-2 w-full gap-4 relative z-10">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class Rank</span>
                      <span className="text-xl font-black text-white print:text-black">{classRank} <span className="text-sm font-medium text-slate-500">/ {totalStudents}</span></span>
                    </div>
                    <div className="flex flex-col items-center border-l border-slate-800 print:border-slate-300 pl-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
                      <span className={`text-sm font-black mt-1 px-3 py-1 rounded-full ${
                        promotionStatus === "PROMOTED" ? "bg-emerald-500/20 text-emerald-400 print:text-black print:border print:border-black" : 
                        promotionStatus === "RETAINED" ? "bg-red-500/20 text-red-400 print:text-black print:border print:border-black" : 
                        "bg-slate-800 text-slate-300 print:text-black print:border print:border-black"
                      }`}>
                        {promotionStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Signatures */}
            <div className="grid grid-cols-3 gap-12 mt-16 pt-16 border-t-2 border-slate-100 print:border-black text-center relative">
              <div className="flex flex-col items-center justify-end">
                <div className="border-b-2 border-slate-300 print:border-black w-full mb-3"></div>
                <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Class Teacher</span>
              </div>
              
              <div className="relative flex justify-center items-center">
                <div className="absolute -top-10 w-32 h-32 border-[6px] border-indigo-100 print:border-slate-400 rounded-full flex flex-col items-center justify-center opacity-40 transform -rotate-12 bg-white print:bg-transparent shadow-sm print:shadow-none">
                  <CheckCircle2 className="w-8 h-8 text-indigo-300 print:text-slate-500 mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 print:text-slate-500 text-center leading-tight">Official<br/>Seal</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-end">
                <div className="border-b-2 border-slate-300 print:border-black w-full mb-3"></div>
                <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">{principalName}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Principal</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </PdfExportWrapper>
    </div>
  )
}
