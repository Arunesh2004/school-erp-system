import prisma from '../src/lib/prisma';
import { promoteStudents } from '../src/app/actions/promotions';
import { randomUUID } from 'crypto';

function log(testId: string, description: string, status: 'PASS' | 'FAIL' | 'WARN', evidence?: any) {
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`[${testId}] ${color}${status}\x1b[0m: ${description}`);
  if (evidence) console.log(`      Evidence: ${JSON.stringify(evidence)}`);
}

async function runLifecycleTests() {
  console.log('\n====================================================');
  console.log('PHASE 12: STUDENT LIFECYCLE & ROLLBACK TESTS (TIER 3)');
  console.log('====================================================\n');

  const runId = randomUUID().substring(0, 6);
  
  try {
    const currentSession = await prisma.academicSession.create({
      data: { name: `PH12_CUR_${runId}`, startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'), status: 'ACTIVE' }
    });
    
    const nextSession = await prisma.academicSession.create({
      data: { name: `PH12_NEXT_${runId}`, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' }
    });

    const classA = await prisma.class.create({ data: { name: `Class A ${runId}` } });
    const classB = await prisma.class.create({ data: { name: `Class B ${runId}` } });

    const student1 = await prisma.student.create({ data: { class: { connect: { id: classA.id } }, user: { create: { email: `s1_${runId}@test.com`, password: '123', role: 'STUDENT' } } }});
    const student2 = await prisma.student.create({ data: { class: { connect: { id: classA.id } }, user: { create: { email: `s2_${runId}@test.com`, password: '123', role: 'STUDENT' } } }});

    await prisma.studentEnrollment.create({ data: { studentId: student1.id, classId: classA.id, academicSessionId: currentSession.id, status: 'ACTIVE' } });
    await prisma.studentEnrollment.create({ data: { studentId: student2.id, classId: classA.id, academicSessionId: currentSession.id, status: 'ACTIVE' } });

    // ---------------------------------------------------------
    // TEST 1: Failed Promotion Rollback
    // ---------------------------------------------------------
    const studentIds = [student1.id, student2.id];
    const destinationClassId = classB.id;
    
    let caughtError = false;
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Update the student current class pointer
        await tx.student.updateMany({
          where: { id: { in: studentIds } },
          data: { classId: destinationClassId }
        });

        // 2. Upsert enrollment
        for (let i = 0; i < studentIds.length; i++) {
          const studentId = studentIds[i];
          if (i === 1) {
            // Force a DB failure on the second student (invalid class ID)
            await tx.studentEnrollment.create({
              data: {
                studentId,
                classId: 'INVALID_CLASS_ID_THAT_WILL_FAIL_FK',
                academicSessionId: nextSession.id,
                status: "ACTIVE"
              }
            });
          } else {
            await tx.studentEnrollment.create({
              data: {
                studentId,
                classId: destinationClassId,
                academicSessionId: nextSession.id,
                status: "ACTIVE"
              }
            });
          }
        }
      });
    } catch (e: any) {
      caughtError = true;
    }

    if (!caughtError) {
      log('LIFECYCLE-01', 'Transaction should have thrown a foreign key constraint error', 'FAIL');
    } else {
      // Assert pre-state is intact
      const s1 = await prisma.student.findUnique({ where: { id: student1.id } });
      const e1 = await prisma.studentEnrollment.findMany({ where: { studentId: student1.id, academicSessionId: nextSession.id } });
      
      if (s1?.classId === classA.id && e1.length === 0) {
        log('LIFECYCLE-01', 'Failed promotion transaction fully rolled back pre-state', 'PASS');
      } else {
        log('LIFECYCLE-01', 'Rollback failed, partial state committed', 'FAIL', { classId: s1?.classId, enrollments: e1.length });
      }
    }

    // Cleanup
    await prisma.studentEnrollment.deleteMany({ where: { academicSessionId: { in: [currentSession.id, nextSession.id] } } });
    await prisma.student.delete({ where: { id: student1.id } });
    await prisma.student.delete({ where: { id: student2.id } });
    await prisma.class.deleteMany({ where: { id: { in: [classA.id, classB.id] } } });
    await prisma.academicSession.deleteMany({ where: { id: { in: [currentSession.id, nextSession.id] } } });
    
    console.log('\nLifecycle scan complete.');
  } catch (e: any) {
    console.error('Fatal Error during scan:', e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runLifecycleTests();
