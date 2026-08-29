import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getClassTeacherClassIds } from "@/lib/auth/teacher-authorization"
import { Textarea } from "@/components/ui/textarea"
import { Printer, ShieldCheck, User, Save, BookOpen, AlertCircle, Calendar, Lock } from "lucide-react"
import { saveRemarks, publishReport, finalizeRecord } from "./actions"
import { PrintButton } from "./print-button"
import Link from "next/link"
import { revalidatePath } from "next/cache"

function getGradeFromPercentage(percentage: number) {
  if (percentage >= 90) return 'A'
  if (percentage >= 80) return 'B'
  if (percentage >= 70) return 'C'
  if (percentage >= 60) return 'D'
  return 'F'
}

export default async function StudentProfilePage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await verifySession()
  if (!session?.userId) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { teacher: true }
  })

  if (dbUser?.role !== "TEACHER" || !dbUser.teacher) {
    redirect('/login')
  }

  const studentId = params.id

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      class: true,
      marks: {
        include: { subject: true },
        orderBy: [{ subject: { name: 'asc' } }, { examType: 'asc' }]
      },
      attendance: true
    }
  })

  if (!student || !student.class) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
          <AlertCircle className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Student Not Found</h2>
        <p className="text-slate-500 max-w-md">
          The requested student could not be found or is not assigned to a class.
        </p>
      </div>
    )
  }

  const settings = await prisma.schoolSettings.findFirst({ include: { activeSession: true } })
  const academicSessionId = settings?.activeSessionId || ""

  // Strict Authorization: ONLY class teacher can view this profile
  const classIds = await getClassTeacherClassIds(dbUser.teacher.id, academicSessionId);
  if (!classIds.includes(student.class.id)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-50 p-6 rounded-full mb-4">
          <ShieldCheck className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md mb-4">
          You are not the assigned class teacher for {student.class.name} in the current session. Only the class teacher can view full academic profiles.
        </p>
        <Link href="/teacher/class">
          <Button variant="outline">Return to My Class</Button>
        </Link>
      </div>
    )
  }

  const academicSessionName = settings?.activeSession?.name || "2024-2025"

  const academicRecord = await prisma.studentAcademicRecord.findUnique({
    where: {
      studentId_academicSessionId: {
        studentId: student.id,
        academicSessionId: academicSessionId
      }
    }
  })

  // Calculations
  const recordStatus = academicRecord?.status || "DRAFT"
  const isPublished = recordStatus === "PUBLISHED"
  const isFinalized = recordStatus === "FINALIZED"

  // 1. Attendance
  const totalAttendance = student.attendance.length
  const totalPresent = student.attendance.filter(a => a.status === 'PRESENT').length
  const totalAbsent = student.attendance.filter(a => a.status === 'ABSENT').length
  const totalLate = student.attendance.filter(a => a.status === 'LATE').length
  
  // Treat LATE as half-present or full present? Standard is usually to count late as present for attendance %, but keep track of it. Let's count LATE as present for the denominator if we just use totalPresent + totalLate. But usually % = (Present + Excused) / Total. Let's keep it simple: just Present / Total.
  const attendancePercentage = totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0

  // 2. Marks
  const publishedMarks = student.marks.filter(m => m.status === 'PUBLISHED')
  const totalScore = publishedMarks.reduce((sum, m) => sum + m.score, 0)
  const totalMaxScore = publishedMarks.reduce((sum, m) => sum + m.maxScore, 0)
  const failedSubjectCount = publishedMarks.filter(m => (m.score / m.maxScore) * 100 < 50).length
  
  let finalPercentage = 0
  let finalGrade = "N/A"

  if ((isPublished || isFinalized) && academicRecord?.finalPercentage != null) {
    // If published, use the frozen snapshot
    finalPercentage = academicRecord.finalPercentage
    finalGrade = academicRecord.finalGrade || "N/A"
  } else {
    // If draft, calculate dynamically
    finalPercentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0
    finalGrade = totalMaxScore > 0 ? getGradeFromPercentage(finalPercentage) : "N/A"
  }

  // Server actions wrappers
  async function handleSaveRemarks(formData: FormData) {
    "use server"
    if (!student || !student.classId) return
    const remarks = formData.get("remarks") as string
    await saveRemarks(student.id, student.classId, academicSessionId, remarks, academicSessionId)
    revalidatePath(`/teacher/class/student/${student.id}`)
  }

  async function handlePublishReport(formData: FormData) {
    "use server"
    if (!student || !student.classId) return
    const remarks = formData.get("remarks") as string
    await publishReport(student.id, student.classId, academicSessionId, finalPercentage, finalGrade, remarks, academicSessionId)
    revalidatePath(`/teacher/class/student/${student.id}`)
  }

  async function handleFinalizeReport(formData: FormData) {
    "use server"
    if (!student || !student.classId) return
    const remarks = formData.get("remarks") as string
    const confirmation = formData.get("confirmation") as string
    
    if (confirmation !== "FINALIZE") {
      throw new Error("Must type FINALIZE to confirm.")
    }

    await finalizeRecord(
      student.id, 
      student.classId, 
      academicSessionId, 
      finalPercentage, 
      finalGrade, 
      attendancePercentage, 
      failedSubjectCount, 
      remarks,
      academicSessionId
    )
    revalidatePath(`/teacher/class/student/${student.id}`)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:pb-0">
      
      {isFinalized && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <Lock className="h-5 w-5 text-orange-600" />
          <p className="text-sm font-medium">This academic record is finalized and immutable. No further changes can be made.</p>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <Link href="/teacher/class" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            &larr; Back to Class
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Academic Profile</h1>
          <p className="text-sm text-slate-500">Comprehensive yearly academic record</p>
        </div>
        
        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Identity Section */}
        <Card className="md:col-span-1 border-slate-200 shadow-sm print:border-none print:shadow-none">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4 print:bg-transparent print:border-b-2 print:border-black">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 p-3 rounded-full print:hidden">
                <User className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">{student.user.name || "Unknown Student"}</CardTitle>
                <CardDescription>Roll No: {student.rollNumber || "N/A"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="text-slate-500">Class</div>
              <div className="font-medium text-right text-slate-900">{student.class.name}</div>
              
              <div className="text-slate-500">Academic Session</div>
              <div className="font-medium text-right text-slate-900">{academicSessionName}</div>
              
              <div className="text-slate-500">Attendance</div>
              <div className="font-medium text-right text-slate-900">
                <span className={attendancePercentage < 75 ? "text-red-600" : "text-green-600"}>
                  {attendancePercentage}%
                </span>
              </div>
              
              <div className="text-slate-500">Overall Percentage</div>
              <div className="font-medium text-right text-slate-900">{finalPercentage}%</div>
              
              <div className="text-slate-500">Final Grade</div>
              <div className="text-right">
                <Badge variant={isPublished ? "default" : "outline"} className={isPublished ? "bg-blue-600" : ""}>
                  {finalGrade}
                </Badge>
              </div>

              <div className="text-slate-500">Status</div>
              <div className="text-right">
                {isFinalized ? (
                  <Badge variant="default" className="bg-slate-800"><Lock className="w-3 h-3 mr-1" /> Finalized</Badge>
                ) : isPublished ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">Published</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">Draft</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          
          {/* 2. Attendance Analytics */}
          <Card className="border-slate-200 shadow-sm print:break-inside-avoid print:border-none print:shadow-none">
            <CardHeader className="pb-2 print:p-0 print:mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-500 print:hidden" />
                Attendance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-0">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 print:border-black">
                  <div className="text-2xl font-bold text-slate-900">{totalAttendance}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Days</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100 print:border-black">
                  <div className="text-2xl font-bold text-green-700">{totalPresent}</div>
                  <div className="text-xs text-green-600 uppercase tracking-wider mt-1">Present</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 print:border-black">
                  <div className="text-2xl font-bold text-red-700">{totalAbsent}</div>
                  <div className="text-xs text-red-600 uppercase tracking-wider mt-1">Absent</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 print:border-black">
                  <div className="text-2xl font-bold text-orange-700">{totalLate}</div>
                  <div className="text-xs text-orange-600 uppercase tracking-wider mt-1">Late</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Subject Performance Table */}
          <Card className="border-slate-200 shadow-sm print:break-inside-avoid print:border-none print:shadow-none">
            <CardHeader className="pb-2 print:p-0 print:mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-slate-500 print:hidden" />
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-0">
              <div className="border rounded-md overflow-hidden print:border-black">
                <Table>
                  <TableHeader className="bg-slate-50 print:bg-transparent">
                    <TableRow className="print:border-b-2 print:border-black">
                      <TableHead>Subject</TableHead>
                      <TableHead>Exam Type</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-right print:hidden">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.marks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                          No marks recorded for this student yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      student.marks.map((mark) => {
                        const percent = Math.round((mark.score / mark.maxScore) * 100)
                        const grade = getGradeFromPercentage(percent)
                        return (
                          <TableRow key={mark.id} className="print:border-b print:border-slate-300">
                            <TableCell className="font-medium text-slate-900">{mark.subject.name}</TableCell>
                            <TableCell className="text-slate-600">{mark.examType}</TableCell>
                            <TableCell className="text-right font-medium">
                              {mark.score} <span className="text-xs text-slate-400 font-normal">/ {mark.maxScore}</span>
                            </TableCell>
                            <TableCell className="text-right">{percent}%</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                grade === 'A' ? 'bg-green-100 text-green-700' :
                                grade === 'B' ? 'bg-blue-100 text-blue-700' :
                                grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                                grade === 'D' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                              } print:bg-transparent print:text-black`}>
                                {grade}
                              </span>
                            </TableCell>
                            <TableCell className="text-right print:hidden">
                              <Badge variant={mark.status === 'PUBLISHED' ? "default" : "secondary"} className={mark.status === 'PUBLISHED' ? "bg-slate-800" : ""}>
                                {mark.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 4. Teacher Remarks System */}
          <Card className="border-slate-200 shadow-sm print:break-inside-avoid print:border-none print:shadow-none">
            <CardHeader className="print:p-0 print:mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                Teacher Remarks
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-0">
              
              {isPublished || isFinalized ? (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-4 print:border-none print:bg-transparent print:p-0">
                  <p className="whitespace-pre-wrap text-slate-700 italic">
                    {academicRecord?.teacherRemarks || "No remarks provided."}
                  </p>
                  <p className="text-xs text-slate-400 mt-4 print:hidden">
                    Remarks are locked because this report has been {isFinalized ? "finalized" : "published"}.
                  </p>
                </div>
              ) : (
                <form action={handleSaveRemarks} className="space-y-4 print:hidden">
                  <Textarea 
                    name="remarks"
                    placeholder="Enter academic remarks for the final report..." 
                    defaultValue={academicRecord?.teacherRemarks || ""}
                    className="min-h-[120px] resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="submit" variant="outline" className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Remarks
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Publishing & Actions */}
          {!isFinalized && (
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-200 print:hidden">
              <form action={handlePublishReport}>
                <input type="hidden" name="remarks" value={academicRecord?.teacherRemarks || ""} />
                <Button 
                  type="submit" 
                  variant={isPublished ? "secondary" : "default"} 
                  className={isPublished ? "" : "bg-blue-600 hover:bg-blue-700"}
                  disabled={isPublished || student.marks.length === 0}
                >
                  {isPublished ? "Report Published" : "Publish Final Report"}
                </Button>
              </form>

              {isPublished && (
                <form action={handleFinalizeReport} className="flex items-center gap-2 bg-orange-50 p-2 rounded-md border border-orange-200">
                  <input type="hidden" name="remarks" value={academicRecord?.teacherRemarks || ""} />
                  <input 
                    name="confirmation" 
                    placeholder="Type FINALIZE" 
                    required 
                    className="h-9 px-3 rounded-md border border-orange-300 text-sm w-32"
                  />
                  <Button type="submit" variant="destructive" size="sm">
                    Finalize Record
                  </Button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
