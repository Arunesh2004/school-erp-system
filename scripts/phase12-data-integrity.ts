import prisma from '../src/lib/prisma';

function log(testId: string, description: string, status: 'PASS' | 'FAIL' | 'WARN', evidence?: any) {
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`[${testId}] ${color}${status}\x1b[0m: ${description}`);
  if (evidence) console.log(`      Evidence: ${JSON.stringify(evidence)}`);
}

async function runIntegrityScan() {
  console.log('\n====================================================');
  console.log('PHASE 12: DATABASE INTEGRITY & INVARIANT SCAN');
  console.log('====================================================\n');

  try {
    const activeSession = await prisma.schoolSettings.findUnique({
      where: { id: 'default' }
    });
    const activeSessionId = activeSession?.activeSessionId;

    if (!activeSessionId) {
      log('INIT', 'No global active session found', 'WARN');
    }

    const duplicateEnrollments = await prisma.$queryRaw<any[]>`
      SELECT studentId, academicSessionId, count(*) as c
      FROM StudentEnrollment
      WHERE status = 'ACTIVE'
      GROUP BY studentId, academicSessionId
      HAVING count(*) > 1
    `;
    
    if (duplicateEnrollments.length > 0) {
      log('INV-01', 'Exactly one ACTIVE enrollment per student per session', 'FAIL', duplicateEnrollments);
    } else {
      log('INV-01', 'Exactly one ACTIVE enrollment per student per session', 'PASS');
    }

    const duplicateClassTeachers = await prisma.$queryRaw<any[]>`
      SELECT classId, academicSessionId, count(*) as c
      FROM ClassTeacherAssignment
      WHERE isActive = true
      GROUP BY classId, academicSessionId
      HAVING count(*) > 1
    `;

    if (duplicateClassTeachers.length > 0) {
      log('INV-02', 'Exactly one ACTIVE Class Teacher per class per session', 'FAIL', duplicateClassTeachers);
    } else {
      log('INV-02', 'Exactly one ACTIVE Class Teacher per class per session', 'PASS');
    }

    const duplicateSubjectTeachers = await prisma.$queryRaw<any[]>`
      SELECT classId, subjectId, academicSessionId, count(*) as c
      FROM TeachingAssignment
      WHERE isActive = true
      GROUP BY classId, subjectId, academicSessionId
      HAVING count(*) > 1
    `;

    if (duplicateSubjectTeachers.length > 0) {
      log('INV-03', 'Exactly one ACTIVE Subject Teacher per class+subject per session', 'FAIL', duplicateSubjectTeachers);
    } else {
      log('INV-03', 'Exactly one ACTIVE Subject Teacher per class+subject per session', 'PASS');
    }

    const orphanedMarks = await prisma.$queryRaw<any[]>`
      SELECT m.id FROM Mark m
      LEFT JOIN Student s ON m.studentId = s.id
      LEFT JOIN Subject sub ON m.subjectId = sub.id
      WHERE s.id IS NULL OR sub.id IS NULL
    `;

    if (orphanedMarks.length > 0) {
      log('INV-04', 'No orphaned marks (Referential Integrity)', 'FAIL', { count: orphanedMarks.length });
    } else {
      log('INV-04', 'No orphaned marks (Referential Integrity)', 'PASS');
    }

    const duplicateMarks = await prisma.$queryRaw<any[]>`
      SELECT studentId, subjectId, examType, academicSessionId, count(*) as c
      FROM Mark
      GROUP BY studentId, subjectId, examType, academicSessionId
      HAVING count(*) > 1
    `;

    if (duplicateMarks.length > 0) {
      log('INV-05', 'No duplicate marks for same exam/session', 'FAIL', duplicateMarks);
    } else {
      log('INV-05', 'No duplicate marks for same exam/session', 'PASS');
    }

    console.log('\nIntegrity scan complete.');
  } catch (e: any) {
    console.error('Fatal Error during scan:', e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runIntegrityScan();
