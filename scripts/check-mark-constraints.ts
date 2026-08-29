import prisma from '../src/lib/prisma'

async function checkMarkConstraints() {
  console.log("Checking for Mark unique constraint violations...")
  console.log("Old constraint: (studentId, subjectId, examType)")
  console.log("New constraint: (studentId, subjectId, examType, academicSessionId)")
  console.log("")

  // Check for duplicates under the OLD constraint (session-agnostic)
  const allMarks = await prisma.mark.findMany({
    select: { id: true, studentId: true, subjectId: true, examType: true, academicSessionId: true }
  })

  console.log(`Total marks in DB: ${allMarks.length}`)

  // Group by the OLD key
  const oldKeyMap = new Map<string, string[]>()
  for (const m of allMarks) {
    const key = `${m.studentId}|${m.subjectId}|${m.examType}`
    if (!oldKeyMap.has(key)) oldKeyMap.set(key, [])
    oldKeyMap.get(key)!.push(m.id)
  }

  const oldDuplicates = [...oldKeyMap.entries()].filter(([, ids]) => ids.length > 1)
  console.log(`Duplicates under OLD constraint (studentId, subjectId, examType): ${oldDuplicates.length}`)
  if (oldDuplicates.length > 0) {
    console.log("These are marks that exist for same student/subject/examType across sessions:")
    for (const [key, ids] of oldDuplicates) {
      const parts = key.split("|")
      const marks = await prisma.mark.findMany({
        where: { id: { in: ids } },
        include: { student: { include: { user: true } }, subject: true, academicSession: true }
      })
      console.log(`  ${parts[2]} - Subject: ${marks[0]?.subject.name} - Student: ${marks[0]?.student.user.name}`)
      for (const mark of marks) {
        console.log(`    → Mark ID: ${mark.id}, Score: ${mark.score}, Session: ${mark.academicSession?.name ?? "NULL"}`)
      }
    }
  }

  // Group by the NEW key
  const newKeyMap = new Map<string, string[]>()
  for (const m of allMarks) {
    const key = `${m.studentId}|${m.subjectId}|${m.examType}|${m.academicSessionId ?? "NULL"}`
    if (!newKeyMap.has(key)) newKeyMap.set(key, [])
    newKeyMap.get(key)!.push(m.id)
  }

  const newDuplicates = [...newKeyMap.entries()].filter(([, ids]) => ids.length > 1)
  console.log(`\nDuplicates under NEW constraint (studentId, subjectId, examType, academicSessionId): ${newDuplicates.length}`)
  if (newDuplicates.length > 0) {
    console.log("CRITICAL: These duplicates would FAIL the new constraint:")
    for (const [key, ids] of newDuplicates) {
      console.log(`  Key: ${key} → IDs: ${ids.join(", ")}`)
    }
    console.log("\n⚠️  Migration cannot proceed safely. Please deduplicate these marks first.")
    process.exit(1)
  } else {
    console.log("✅ No duplicates under new constraint. Safe to apply migration.")
  }

  // Check enrollments
  const allEnrollments = await prisma.studentEnrollment.findMany({
    select: { id: true, studentId: true, academicSessionId: true }
  })
  console.log(`\nTotal StudentEnrollments: ${allEnrollments.length}`)

  const enrollKeyMap = new Map<string, string[]>()
  for (const e of allEnrollments) {
    const key = `${e.studentId}|${e.academicSessionId}`
    if (!enrollKeyMap.has(key)) enrollKeyMap.set(key, [])
    enrollKeyMap.get(key)!.push(e.id)
  }
  const enrollDups = [...enrollKeyMap.entries()].filter(([, ids]) => ids.length > 1)
  if (enrollDups.length > 0) {
    console.log(`⚠️  ${enrollDups.length} students have multiple enrollment records per session (will be fixed by removing @@unique constraint)`)
  } else {
    console.log(`✅ All students have exactly 1 enrollment per session — safe to remove @@unique constraint`)
  }
}

checkMarkConstraints()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
