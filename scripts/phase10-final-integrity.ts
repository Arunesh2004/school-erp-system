import prisma from "../src/lib/prisma"

async function main() {
  console.log("==========================================")
  console.log("PHASE 10: FINAL PRE-PRODUCTION INTEGRITY CHECK")
  console.log("==========================================\n")

  let errors = 0
  let warnings = 0

  // 1. Check for duplicate enrollments in the same session
  console.log("[1] Checking for duplicate enrollments in the same session...")
  const enrollments = await prisma.studentEnrollment.findMany({
    include: { student: { include: { user: true } }, academicSession: true }
  })
  
  const enrollmentMap = new Map<string, number>()
  for (const e of enrollments) {
    const key = `${e.studentId}_${e.academicSessionId}`
    enrollmentMap.set(key, (enrollmentMap.get(key) || 0) + 1)
  }

  let dupEnrollments = 0
  for (const [key, count] of enrollmentMap.entries()) {
    if (count > 1) {
      console.log(`❌ ERROR: Duplicate enrollment found: ${key} (Count: ${count})`)
      errors++
      dupEnrollments++
    }
  }
  if (dupEnrollments === 0) console.log("✅ Passed: No duplicate enrollments found.")

  // 2. Check for missing default school settings
  console.log("\n[2] Checking for default school settings and active session...")
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" }, include: { activeSession: true } })
  if (!settings) {
    console.log("❌ ERROR: Missing default school settings!")
    errors++
  } else if (!settings.activeSessionId) {
    console.log("⚠️ WARNING: No active session is currently set.")
    warnings++
  } else {
    console.log(`✅ Passed: Active session is "${settings.activeSession?.name}"`)
  }

  // 3. Check for finalized records with unpublished marks
  console.log("\n[3] Checking for finalized records with unpublished marks...")
  const finalizedRecords = await prisma.studentAcademicRecord.findMany({
    where: { status: "FINALIZED" },
    include: { student: { include: { user: true, marks: true } } }
  })

  let invalidFinalized = 0
  for (const record of finalizedRecords) {
    // Only check marks for the SAME academic session
    const sessionMarks = record.student.marks.filter(m => m.academicSessionId === record.academicSessionId)
    const hasUnpublished = sessionMarks.some(m => m.status !== "PUBLISHED")
    if (hasUnpublished) {
      console.log(`❌ ERROR: Finalized record for ${record.student.user.name} has unpublished marks!`)
      errors++
      invalidFinalized++
    }
  }
  if (invalidFinalized === 0) console.log("✅ Passed: All finalized records have consistent mark states.")

  // 4. Check for marks without academicSessionId
  console.log("\n[4] Checking for marks without academicSessionId...")
  const orphanMarks = await prisma.mark.count({ where: { academicSessionId: null } })
  if (orphanMarks > 0) {
    console.log(`❌ ERROR: Found ${orphanMarks} marks missing an academicSessionId!`)
    errors++
  } else {
    console.log("✅ Passed: All marks are correctly associated with an academic session.")
  }

  // 5. Check for attendance without academicSessionId
  console.log("\n[5] Checking for attendance without academicSessionId...")
  const orphanAttendance = await prisma.attendance.count({ where: { academicSessionId: null } })
  if (orphanAttendance > 0) {
    console.log(`❌ ERROR: Found ${orphanAttendance} attendance records missing an academicSessionId!`)
    errors++
  } else {
    console.log("✅ Passed: All attendance records are correctly associated with an academic session.")
  }

  // 6. Check users with default passwords
  console.log("\n[6] Checking for users with default passwords (Security warning)...")
  const bcrypt = require("bcryptjs")
  // Only check a sample since hashing is slow
  const sampleUsers = await prisma.user.findMany({ take: 50 })
  let defaultPasswords = 0
  for (const u of sampleUsers) {
    const isStudentDefault = await bcrypt.compare("Student@12345", u.password)
    const isTeacherDefault = await bcrypt.compare("Teacher@12345", u.password)
    const isAdminDefault = await bcrypt.compare("Admin@12345", u.password)
    if (isStudentDefault || isTeacherDefault || isAdminDefault) {
      defaultPasswords++
    }
  }
  if (defaultPasswords > 0) {
    console.log(`⚠️ WARNING: Found ${defaultPasswords}/${sampleUsers.length} sampled users with default passwords. (Expected in testing, requires change in production)`)
    warnings++
  } else {
    console.log("✅ Passed: Sampled users have custom passwords.")
  }

  // 7. Check for unassigned students
  console.log("\n[7] Checking for unassigned students...")
  const unassignedStudents = await prisma.student.count({ where: { classId: null } })
  if (unassignedStudents > 0) {
    console.log(`⚠️ WARNING: Found ${unassignedStudents} students without an assigned class (Archived/Withdrawn).`)
    warnings++
  } else {
    console.log("✅ Passed: All students are assigned to a class.")
  }


  console.log("\n==========================================")
  console.log(`INTEGRITY CHECK COMPLETE`)
  console.log(`Errors: ${errors}`)
  console.log(`Warnings: ${warnings}`)
  console.log("==========================================\n")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
