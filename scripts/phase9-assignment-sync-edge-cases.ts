import { assertMarkEntryAuthorized, assertTeacherCanManageContent, assertClassTeacherOwnership, getClassTeacherClassIds } from '../src/lib/auth/teacher-authorization';
import prisma from '../src/lib/prisma';
import { randomUUID } from 'crypto';

const results: { layer: string; scenario: string; status: 'PASS' | 'FAIL' | 'BLOCKED'; detail: string }[] = [];

function log(layer: string, scenario: string, status: 'PASS' | 'FAIL' | 'BLOCKED', detail = '') {
  results.push({ layer, scenario, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} [${status}] [${layer}] ${scenario}${detail ? " — " + detail : ""}`);
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
async function createTestSession(name: string) {
  return await prisma.academicSession.create({
    data: { name, startDate: new Date(), endDate: new Date(Date.now() + 86400000 * 365) }
  });
}

async function createTestClass(name: string) {
  return await prisma.class.create({ data: { name } });
}

async function createTestSubject(name: string, classId: string) {
  return await prisma.subject.create({
    data: { name, code: `TEST-${randomUUID().substring(0,6)}`, classes: { connect: { id: classId } } }
  });
}

async function createTestTeacher(email: string) {
  const user = await prisma.user.create({
    data: { name: `Teacher ${email}`, email, role: 'TEACHER', password: 'hash' }
  });
  return await prisma.teacher.create({ data: { userId: user.id } });
}

async function createTestStudent(email: string, classId: string, sessionId: string) {
  const user = await prisma.user.create({
    data: { name: `Student ${email}`, email, role: 'STUDENT', password: 'hash' }
  });
  const student = await prisma.student.create({
    data: { userId: user.id, classId }
  });
  const enrollment = await prisma.studentEnrollment.create({
    data: { studentId: student.id, classId, academicSessionId: sessionId, status: 'ACTIVE' }
  });
  return { student, enrollment };
}

// ---------------------------------------------------------
// MAIN RUNNER
// ---------------------------------------------------------
async function runTests() {
  console.log('\n🏫 PHASE 9 — EDGE CASE SYNCHRONIZATION AND ISOLATION\n');
  
  // Create a clean testing sandbox
  const session1 = await createTestSession(`2024-Test-${randomUUID().substring(0,4)}`);
  const session2 = await createTestSession(`2025-Test-${randomUUID().substring(0,4)}`);
  
  const class10A = await createTestClass(`10A-Test-${randomUUID().substring(0,4)}`);
  const class10B = await createTestClass(`10B-Test-${randomUUID().substring(0,4)}`);
  const class11A = await createTestClass(`11A-Test-${randomUUID().substring(0,4)}`);
  
  const subjMath10 = await createTestSubject(`Math 10-Test-${randomUUID().substring(0,4)}`, class10A.id);
  // Also link Math to 10B
  await prisma.subject.update({ where: { id: subjMath10.id }, data: { classes: { connect: { id: class10B.id } } } });
  const subjPhys11 = await createTestSubject(`Phys 11-Test-${randomUUID().substring(0,4)}`, class11A.id);
  
  const teacherA = await createTestTeacher(`ta_${randomUUID()}@test.com`);
  const teacherB = await createTestTeacher(`tb_${randomUUID()}@test.com`);
  
  const { student: student10A } = await createTestStudent(`s10A_${randomUUID()}@test.com`, class10A.id, session1.id);
  const { student: student10B } = await createTestStudent(`s10B_${randomUUID()}@test.com`, class10B.id, session1.id);

  // ---------------------------------------------------------
  // LAYER 1: DATABASE INVARIANTS (Transactional boundaries)
  // ---------------------------------------------------------
  
  // L1: Transaction Rollback Student Transfer
  try {
    await prisma.$transaction(async (tx) => {
      // Deactivate old
      await tx.studentEnrollment.updateMany({
        where: { studentId: student10A.id, academicSessionId: session1.id },
        data: { status: 'TRANSFERRED' }
      });
      // Synthetic failure
      throw new Error("Synthetic Transfer Failure");
    });
  } catch (e: any) {
    // Expected to fail
  }
  
  const l1EnrollmentCheck = await prisma.studentEnrollment.findFirst({
    where: { studentId: student10A.id, academicSessionId: session1.id, status: 'ACTIVE' }
  });
  log('L1', 'Transfer Rollback preserves old active enrollment', l1EnrollmentCheck ? 'PASS' : 'FAIL');
  
  // ---------------------------------------------------------
  // LAYER 2: SERVICE / AUTHORIZATION INTEGRATION
  // ---------------------------------------------------------

  // Test A: Class/Section Isolation
  await prisma.classTeacherAssignment.create({
    data: { teacherId: teacherA.id, classId: class10A.id, academicSessionId: session1.id, isActive: true }
  });
  
  try {
    const classIds = await getClassTeacherClassIds(teacherA.id, session1.id);
    if (classIds.includes(class10A.id) && !classIds.includes(class10B.id)) {
      log('L2', 'Class Teacher of 10A isolated from 10B', 'PASS');
    } else {
      log('L2', 'Class Teacher of 10A isolated from 10B', 'FAIL', '10B leaked into results');
    }
  } catch (e: any) {
    log('L2', 'Class Teacher of 10A isolated from 10B', 'FAIL', e.message);
  }

  // Test B: Multi-Role Union
  await prisma.teachingAssignment.create({
    data: { teacherId: teacherA.id, subjectId: subjMath10.id, classId: class10A.id, academicSessionId: session1.id, isActive: true }
  });
  await prisma.teachingAssignment.create({
    data: { teacherId: teacherA.id, subjectId: subjPhys11.id, classId: class11A.id, academicSessionId: session1.id, isActive: true }
  });
  
  // Teacher A now class teacher 10A, math 10A, phys 11A.
  try {
    await assertMarkEntryAuthorized(teacherA.id, student10A.id, subjMath10.id, session1.id);
    log('L2', 'Multi-role teacher can access assigned subject', 'PASS');
  } catch (e: any) {
    log('L2', 'Multi-role teacher can access assigned subject', 'FAIL', e.message);
  }
  
  // Should FAIL to access Math 10B
  try {
    await assertMarkEntryAuthorized(teacherA.id, student10B.id, subjMath10.id, session1.id);
    log('L2', 'Multi-role teacher denied unassigned section (Math 10B)', 'FAIL', 'Unexpectedly authorized');
  } catch (e: any) {
    log('L2', 'Multi-role teacher denied unassigned section (Math 10B)', 'PASS');
  }

  // Test C: Class Teacher Reassignment (Stale Mutation)
  // Admin revokes 10A from Teacher A, gives to Teacher B
  await prisma.classTeacherAssignment.updateMany({
    where: { teacherId: teacherA.id, classId: class10A.id, academicSessionId: session1.id },
    data: { isActive: false, endedAt: new Date() }
  });
  await prisma.classTeacherAssignment.create({
    data: { teacherId: teacherB.id, classId: class10A.id, academicSessionId: session1.id, isActive: true }
  });

  try {
    await assertClassTeacherOwnership(teacherA.id, class10A.id, session1.id);
    log('L2', 'Stale Class Teacher Mutation Rejected', 'FAIL', 'Teacher A still authorized');
  } catch {
    log('L2', 'Stale Class Teacher Mutation Rejected', 'PASS');
  }
  
  // Test G & H: Promotion and Session Switch
  // Promote Student 10A to 11A in session 2
  const newEnrollment = await prisma.studentEnrollment.create({
    data: { studentId: student10A.id, classId: class11A.id, academicSessionId: session2.id, status: 'ACTIVE' }
  });
  // Teacher A tries to submit marks for session 2 Math 10A (which student is no longer in, and teacher doesn't teach in session 2)
  try {
    await assertMarkEntryAuthorized(teacherA.id, student10A.id, subjMath10.id, session2.id);
    log('L2', 'Cross-session mutation strictly denied', 'FAIL');
  } catch {
    log('L2', 'Cross-session mutation strictly denied', 'PASS');
  }

  // Check invariants
  const activeEnrolls = await prisma.studentEnrollment.count({
    where: { studentId: student10A.id, academicSessionId: session1.id, status: 'ACTIVE' }
  });
  log('L1', 'Global Invariant: No duplicate active enrollments', activeEnrolls === 1 ? 'PASS' : 'FAIL', `Count: ${activeEnrolls}`);

  // Summary
  console.log('\n--- Test Summary ---');
  let passCount = 0;
  for (const r of results) {
    if (r.status === 'PASS') passCount++;
  }
  console.log(`Passed ${passCount}/${results.length} Scenarios`);
  
  if (passCount !== results.length) {
    process.exit(1);
  }
}

runTests().finally(() => prisma.$disconnect());
