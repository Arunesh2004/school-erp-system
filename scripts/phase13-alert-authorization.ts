import prisma from "../src/lib/prisma"
import { resolveAndAuthorizeAlertTargets } from "../src/lib/auth/alert-authorization"
import * as assert from "assert"
import { v4 as uuidv4 } from "uuid"

async function run() {
  console.log("Starting Phase 13 Alert Authorization Tests...")
  
  // Create isolated test scope
  const testId = uuidv4().substring(0, 8)
  
  const adminUser = await prisma.user.create({ data: { name: `Admin ${testId}`, email: `admin_${testId}@test.com`, role: "ADMIN", password: "hash" } })
  
  const classTeacherUser = await prisma.user.create({ data: { name: `CT ${testId}`, email: `ct_${testId}@test.com`, role: "TEACHER", password: "hash" } })
  const classTeacher = await prisma.teacher.create({ data: { userId: classTeacherUser.id } })

  const subjectTeacherUser = await prisma.user.create({ data: { name: `ST ${testId}`, email: `st_${testId}@test.com`, role: "TEACHER", password: "hash" } })
  const subjectTeacher = await prisma.teacher.create({ data: { userId: subjectTeacherUser.id } })

  const session = await prisma.academicSession.create({ data: { name: `Session ${testId}`, startDate: new Date(), endDate: new Date(), status: "ACTIVE" } })
  
  const assignedClass = await prisma.class.create({ data: { name: `Assigned Class ${testId}` } })
  const otherClass = await prisma.class.create({ data: { name: `Other Class ${testId}` } })
  
  const subject = await prisma.subject.create({ data: { name: `Subject ${testId}`, code: `SUBJ_${testId}` } })

  // Assignments
  await prisma.classTeacherAssignment.create({ data: { teacherId: classTeacher.id, classId: assignedClass.id, academicSessionId: session.id, isActive: true } })
  await prisma.teachingAssignment.create({ data: { teacherId: subjectTeacher.id, subjectId: subject.id, classId: assignedClass.id, academicSessionId: session.id, isActive: true } })

  // Students
  const student1User = await prisma.user.create({ data: { name: `S1 ${testId}`, email: `s1_${testId}@test.com`, role: "STUDENT", password: "hash" } })
  const student1 = await prisma.student.create({ data: { userId: student1User.id } })
  await prisma.studentEnrollment.create({ data: { studentId: student1.id, classId: assignedClass.id, academicSessionId: session.id, status: "ACTIVE" } })

  const student2User = await prisma.user.create({ data: { name: `S2 ${testId}`, email: `s2_${testId}@test.com`, role: "STUDENT", password: "hash" } })
  const student2 = await prisma.student.create({ data: { userId: student2User.id } })
  await prisma.studentEnrollment.create({ data: { studentId: student2.id, classId: otherClass.id, academicSessionId: session.id, status: "ACTIVE" } })

  console.log("--- Executing Authorization Boundaries ---")

  try {
    // TEST 1: Admin Global Alert
    const t1 = await resolveAndAuthorizeAlertTargets(adminUser.id, "ADMIN", { targetType: "GLOBAL" }, session.id)
    assert.ok(t1.length > 0, "Admin should resolve global targets")
    console.log("✅ Admin Global targeting passed.")

    // TEST 2: Admin specific student
    const t2 = await resolveAndAuthorizeAlertTargets(adminUser.id, "ADMIN", { targetType: "SPECIFIC_STUDENTS", studentIds: [student1User.id] }, session.id)
    assert.strictEqual(t2.length, 1, "Admin should resolve 1 student")
    console.log("✅ Admin Specific Student targeting passed.")

    // TEST 3: Class Teacher assigned class
    const t3 = await resolveAndAuthorizeAlertTargets(classTeacherUser.id, "TEACHER", { targetType: "SPECIFIC_CLASSES", classIds: [assignedClass.id] }, session.id)
    assert.ok(t3.length > 0, "Class Teacher should resolve their assigned class")
    console.log("✅ Class Teacher assigned class targeting passed.")

    // TEST 4: Class Teacher unauthorized class
    try {
      await resolveAndAuthorizeAlertTargets(classTeacherUser.id, "TEACHER", { targetType: "SPECIFIC_CLASSES", classIds: [otherClass.id] }, session.id)
      throw new Error("Should have failed")
    } catch (e: any) {
      assert.match(e.message, /Authorization denied/i, "Class teacher cannot target unauthorized class")
      console.log("✅ Class Teacher unauthorized class properly rejected.")
    }

    // TEST 5: Class Teacher forged cross-class student ID
    try {
      await resolveAndAuthorizeAlertTargets(classTeacherUser.id, "TEACHER", { targetType: "SPECIFIC_STUDENTS", studentIds: [student2User.id] }, session.id)
      throw new Error("Should have failed")
    } catch (e: any) {
      assert.match(e.message, /Authorization denied/i, "Class teacher cannot target unauthorized student")
      console.log("✅ Class Teacher forged student ID properly rejected (All-or-Nothing).")
    }

    // TEST 6: Class Teacher mixed valid and invalid targets (All-or-Nothing)
    try {
      await resolveAndAuthorizeAlertTargets(classTeacherUser.id, "TEACHER", { 
        targetType: "SPECIFIC_STUDENTS", 
        studentIds: [student1User.id, student2User.id] 
      }, session.id)
      throw new Error("Should have failed")
    } catch (e: any) {
      assert.match(e.message, /Authorization denied/i, "Mixed valid/invalid targets must be entirely rejected")
      console.log("✅ Mixed Valid+Invalid targets completely rejected.")
    }

    // TEST 7: Subject Teacher Denied
    try {
      await resolveAndAuthorizeAlertTargets(subjectTeacherUser.id, "TEACHER", { targetType: "SPECIFIC_CLASSES", classIds: [assignedClass.id] }, session.id)
      throw new Error("Should have failed")
    } catch (e: any) {
      assert.match(e.message, /Authorization denied/i, "Subject Teacher cannot create alerts")
      console.log("✅ Subject Teacher properly denied alert creation.")
    }

    // TEST 8: Student Denied
    try {
      await resolveAndAuthorizeAlertTargets(student1User.id, "STUDENT", { targetType: "GLOBAL" }, session.id)
      throw new Error("Should have failed")
    } catch (e: any) {
      assert.match(e.message, /Authorization denied/i, "Student cannot create alerts")
      console.log("✅ Student properly denied alert creation.")
    }

    console.log("🎉 All Phase 13 Authorization tests passed successfully!")
  } catch (error: any) {
    console.error("❌ Test Failed:", error.message || error)
    process.exit(1)
  }
}
run().finally(() => prisma.$disconnect())
