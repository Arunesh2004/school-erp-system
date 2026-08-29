import prisma from '../src/lib/prisma';
import { assertMarkEntryAuthorized, validateAttendanceRoster, assertTeacherCanManageContent } from '../src/lib/auth/teacher-authorization';
import { randomUUID } from 'crypto';

function log(testId: string, description: string, status: 'PASS' | 'FAIL' | 'WARN', evidence?: any) {
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`[${testId}] ${color}${status}\x1b[0m: ${description}`);
  if (evidence) console.log(`      Evidence: ${JSON.stringify(evidence)}`);
}

async function assertRejects(promise: Promise<any>, expectedMsgIncludes: string) {
  try {
    await promise;
    return false;
  } catch (e: any) {
    if (e.message.includes(expectedMsgIncludes)) return true;
    console.error(`Expected rejection with "${expectedMsgIncludes}", but got: ${e.message}`);
    return false;
  }
}

async function runRoleIsolationTests() {
  console.log('\n====================================================');
  console.log('PHASE 12: ROLE ISOLATION & IDOR TESTS (TIER 3: Server Logic)');
  console.log('====================================================\n');

  const runId = randomUUID().substring(0, 6);
  
  try {
    // 1. Setup isolated namespace
    const session = await prisma.academicSession.create({
      data: { name: `PH12_SESS_${runId}`, startDate: new Date(), endDate: new Date(Date.now() + 86400000 * 30), status: 'ACTIVE' }
    });

    const teacherA = await prisma.teacher.create({ data: { user: { create: { email: `tA_${runId}@test.com`, password: '123', role: 'TEACHER' } } }});
    const teacherB = await prisma.teacher.create({ data: { user: { create: { email: `tB_${runId}@test.com`, password: '123', role: 'TEACHER' } } }});

    const classA = await prisma.class.create({ data: { name: `Class A ${runId}` } });
    const classB = await prisma.class.create({ data: { name: `Class B ${runId}` } });

    const subjectMath = await prisma.subject.create({ data: { name: `Math ${runId}`, code: `MATH_${runId}` } });
    const subjectScience = await prisma.subject.create({ data: { name: `Science ${runId}`, code: `SCI_${runId}` } });

    const studentA = await prisma.student.create({ data: { user: { create: { email: `sA_${runId}@test.com`, password: '123', role: 'STUDENT' } } }});
    const studentB = await prisma.student.create({ data: { user: { create: { email: `sB_${runId}@test.com`, password: '123', role: 'STUDENT' } } }});

    // Enrollments
    await prisma.studentEnrollment.create({ data: { studentId: studentA.id, classId: classA.id, academicSessionId: session.id, status: 'ACTIVE' } });
    await prisma.studentEnrollment.create({ data: { studentId: studentB.id, classId: classB.id, academicSessionId: session.id, status: 'ACTIVE' } });

    // Assignments
    // Teacher A teaches Math to Class A
    await prisma.teachingAssignment.create({ data: { teacherId: teacherA.id, subjectId: subjectMath.id, classId: classA.id, academicSessionId: session.id, isActive: true }});
    // Teacher B teaches Science to Class B
    await prisma.teachingAssignment.create({ data: { teacherId: teacherB.id, subjectId: subjectScience.id, classId: classB.id, academicSessionId: session.id, isActive: true }});

    // ---------------------------------------------------------
    // TEST 1: Cross-Class IDOR on Marks (Scenario A)
    // Teacher A tries to grade Student B in Math
    let passed = await assertRejects(
      assertMarkEntryAuthorized(teacherA.id, studentB.id, subjectMath.id, session.id),
      "You do not have an active teaching assignment for this subject in this student's class"
    );
    log('IDOR-01', 'Teacher cannot grade student in unauthorized class', passed ? 'PASS' : 'FAIL');

    // TEST 2: Cross-Subject IDOR on Marks (Scenario B)
    // Teacher A tries to grade Student A in Science
    passed = await assertRejects(
      assertMarkEntryAuthorized(teacherA.id, studentA.id, subjectScience.id, session.id),
      "You do not have an active teaching assignment for this subject in this student's class"
    );
    log('IDOR-02', 'Teacher cannot grade assigned student in unauthorized subject', passed ? 'PASS' : 'FAIL');

    // TEST 3: Authorized Happy Path
    // Teacher A grades Student A in Math
    await assertMarkEntryAuthorized(teacherA.id, studentA.id, subjectMath.id, session.id);
    log('IDOR-03', 'Teacher can grade authorized student and subject', 'PASS');

    // TEST 4: Attendance IDOR Validation
    // Teacher A tries to mark attendance for Student B in Class B (not assigned)
    const rosterCheck = await validateAttendanceRoster([studentB.id], classB.id, session.id);
    // wait, Teacher A's identity is verified upstream in `upsertAttendance` via `assertClassTeacherOwnership`
    // Let's test `assertClassTeacherOwnership` directly
    const { assertClassTeacherOwnership } = require('../src/lib/auth/teacher-authorization');
    passed = await assertRejects(
      assertClassTeacherOwnership(teacherA.id, classB.id, session.id),
      "You are not the active class teacher for this class"
    );
    log('IDOR-04', 'Teacher cannot claim attendance ownership for unauthorized class', passed ? 'PASS' : 'FAIL');

    // TEST 5: Learning Hub Content Creation IDOR
    // Teacher B tries to create a chapter for Math
    passed = await assertRejects(
      assertTeacherCanManageContent(teacherB.id, subjectMath.id, session.id, classB.id),
      "You do not have a teaching assignment for this subject"
    );
    log('IDOR-05', 'Teacher cannot manage notes for unauthorized subject', passed ? 'PASS' : 'FAIL');

    // Cleanup
    await prisma.studentEnrollment.deleteMany({ where: { academicSessionId: session.id } });
    await prisma.teachingAssignment.deleteMany({ where: { academicSessionId: session.id } });
    await prisma.student.delete({ where: { id: studentA.id } });
    await prisma.student.delete({ where: { id: studentB.id } });
    await prisma.teacher.delete({ where: { id: teacherA.id } });
    await prisma.teacher.delete({ where: { id: teacherB.id } });
    await prisma.subject.deleteMany({ where: { id: { in: [subjectMath.id, subjectScience.id] } } });
    await prisma.class.deleteMany({ where: { id: { in: [classA.id, classB.id] } } });
    await prisma.academicSession.delete({ where: { id: session.id } });
    
    console.log('\nRole isolation scan complete.');
  } catch (e: any) {
    console.error('Fatal Error during scan:', e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runRoleIsolationTests();
