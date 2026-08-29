process.env.DATABASE_URL = "file:./phase11-test.db"
process.env.DATABASE_AUTH_TOKEN = ""

import prisma from '../src/lib/prisma'
import { upsertMark } from '../src/app/actions/teacher'
import { upsertAttendance } from '../src/app/actions/attendance'
import { promoteStudents } from '../src/app/actions/promotions'

async function simulateConcurrentMarks(studentId: string, subjectId: string, expectedSessionId: string) {
  console.log("Simulating Concurrent Mark Entry...")
  const formData1 = new FormData()
  formData1.append("studentId", studentId)
  formData1.append("subjectId", subjectId)
  formData1.append("examType", "Midterm")
  formData1.append("score", "85")
  formData1.append("status", "DRAFT")
  formData1.append("expectedSessionId", expectedSessionId)

  const formData2 = new FormData()
  formData2.append("studentId", studentId)
  formData2.append("subjectId", subjectId)
  formData2.append("examType", "Midterm")
  formData2.append("score", "90") // second concurrent edit
  formData2.append("status", "DRAFT")
  formData2.append("expectedSessionId", expectedSessionId)

  const results = await Promise.allSettled([
    upsertMark(formData1),
    upsertMark(formData2),
    upsertMark(formData1),
    upsertMark(formData2)
  ])

  const marks = await prisma.mark.findMany({
    where: { studentId, subjectId, examType: "Midterm" }
  })
  
  console.log(`- Marks created: ${marks.length} (Expected: 1)`)
  if (marks.length !== 1) throw new Error("Duplicate marks created!")
}

async function simulateStaleSession(studentId: string, subjectId: string) {
  console.log("Simulating Stale Session Mutation...")
  // The client thinks active session is "old-session-id"
  const staleSessionId = "old-session-id"
  
  const formData = new FormData()
  formData.append("studentId", studentId)
  formData.append("subjectId", subjectId)
  formData.append("examType", "Final")
  formData.append("score", "100")
  formData.append("status", "DRAFT")
  formData.append("expectedSessionId", staleSessionId)

  const result = await upsertMark(formData)
  console.log(`- Stale session result:`, result)
  if (!result.error || !result.error.includes("session has changed")) {
    throw new Error("Stale session was NOT blocked!")
  }
}

async function simulateConcurrentAttendance(studentId: string, classId: string, expectedSessionId: string) {
  console.log("Simulating Concurrent Attendance Entry...")
  const dateStr = new Date().toISOString().split('T')[0]
  const req1 = upsertAttendance({ studentId, classId, date: dateStr, status: "PRESENT", remarks: "", expectedSessionId })
  const req2 = upsertAttendance({ studentId, classId, date: dateStr, status: "ABSENT", remarks: "", expectedSessionId })
  
  await Promise.allSettled([req1, req2, req1])

  const attendance = await prisma.attendance.findMany({
    where: { studentId, classId, date: new Date(dateStr) }
  })

  console.log(`- Attendance records: ${attendance.length} (Expected: 1)`)
  if (attendance.length !== 1) throw new Error("Duplicate attendance created!")
}

async function simulateConcurrentPromotions(classId: string, fromSessionId: string, toSessionId: string, expectedSessionId: string) {
  console.log("Simulating Concurrent Promotion...")
  const formData = new FormData()
  formData.append("classId", classId)
  formData.append("fromSessionId", fromSessionId)
  formData.append("toSessionId", toSessionId)
  formData.append("expectedSessionId", expectedSessionId)

  // Double submit
  const results = await Promise.allSettled([
    promoteStudents('' as any, formData as any),
    promoteStudents('' as any, formData as any)
  ])

  // Count enrollments for this class in the new session
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { classId, academicSessionId: toSessionId }
  })

  // We don't know exact count, but we can check for duplicate studentId + academicSessionId
  const dupCheck = await prisma.studentEnrollment.groupBy({
    by: ['studentId', 'academicSessionId'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } }
  })

  console.log(`- Duplicate enrollments created: ${dupCheck.length} (Expected: 0)`)
  if (dupCheck.length > 0) throw new Error("Duplicate enrollments created during promotion!")
}

async function main() {
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }})
  const activeSessionId = settings!.activeSessionId!

  const student = await prisma.student.findFirst({ include: { class: true }})
  const subject = await prisma.subject.findFirst()
  const prevSession = await prisma.academicSession.findFirst({ where: { status: "ARCHIVED" }})

  await simulateConcurrentMarks(student!.id, subject!.id, activeSessionId)
  await simulateStaleSession(student!.id, subject!.id)
  await simulateConcurrentAttendance(student!.id, student!.classId!, activeSessionId)
  
  if (prevSession) {
    await simulateConcurrentPromotions(student!.classId!, prevSession.id, activeSessionId, activeSessionId)
  }

  console.log("Concurrency tests passed!")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
