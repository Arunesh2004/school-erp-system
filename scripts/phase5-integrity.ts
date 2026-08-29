import prisma from '../src/lib/prisma'

async function main() {
  console.log("Starting Read-Only Production Integrity Audit...\n")

  const counts = {
    Student: await prisma.student.count(),
    Class: await prisma.class.count(),
    Teacher: await prisma.teacher.count(),
    User: await prisma.user.count(),
    Mark: await prisma.mark.count(),
    Attendance: await prisma.attendance.count(),
    StudentAcademicRecord: await prisma.studentAcademicRecord.count(),
    SchoolSettings: await prisma.schoolSettings.count(),
    AcademicSession: await prisma.academicSession.count(),
    StudentEnrollment: await prisma.studentEnrollment.count(),
  }

  console.log("--- TABLE COUNTS ---")
  console.table(counts)

  console.log("\n--- ORPHAN CHECKS ---")
  
  // 1. Orphaned StudentEnrollment
  const orphanEnrollments = await prisma.studentEnrollment.count({
    where: { OR: [{ studentId: "" }, { academicSessionId: "" }, { classId: "" }] }
  })
  console.log(`Orphaned StudentEnrollment (missing relations): ${orphanEnrollments}`)

  // 2. Duplicate StudentEnrollment
  const enrollments = await prisma.studentEnrollment.groupBy({
    by: ['studentId', 'academicSessionId'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } }
  })
  console.log(`Duplicate StudentEnrollment (same student/session): ${enrollments.length}`)

  // 3. Marks without session
  const marksNoSession = await prisma.mark.count({
    where: { academicSessionId: null }
  })
  console.log(`Marks without academicSessionId: ${marksNoSession}`)

  // 4. Attendance without session
  const attNoSession = await prisma.attendance.count({
    where: { academicSessionId: null }
  })
  console.log(`Attendance without academicSessionId: ${attNoSession}`)

  // 5. Academic Records without enrollment
  const recordsNoEnrollment = await prisma.studentAcademicRecord.count({
    where: { enrollmentId: null }
  })
  console.log(`Academic records without enrollmentId: ${recordsNoEnrollment}`)

  console.log("\nAudit Complete.")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
