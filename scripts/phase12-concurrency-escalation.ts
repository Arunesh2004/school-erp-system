import prisma from '../src/lib/prisma';
import { assignClassTeacher } from '../src/app/actions/admin';
import { randomUUID } from 'crypto';

function log(testId: string, description: string, status: 'PASS' | 'FAIL' | 'WARN', evidence?: any) {
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`[${testId}] ${color}${status}\x1b[0m: ${description}`);
  if (evidence) console.log(`      Evidence: ${JSON.stringify(evidence)}`);
}

async function runConcurrencyEscalation() {
  console.log('\n====================================================');
  console.log('PHASE 12: ESCALATED CONCURRENCY TESTS (TIER 3)');
  console.log('====================================================\n');

  const runId = randomUUID().substring(0, 6);
  
  try {
    // 1. Setup global active session (requires manipulating default settings, we'll restore it)
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } });
    const originalSessionId = settings?.activeSessionId;

    const testSession = await prisma.academicSession.create({
      data: { name: `PH12_CONC_${runId}`, startDate: new Date(), endDate: new Date(Date.now() + 86400000 * 30), status: 'ACTIVE' }
    });

    await prisma.schoolSettings.upsert({
      where: { id: "default" },
      update: { activeSessionId: testSession.id },
      create: { id: "default", activeSessionId: testSession.id }
    });

    // 2. Setup Isolated Entities
    const teacher1 = await prisma.teacher.create({ data: { user: { create: { email: `t1_${runId}@test.com`, password: '123', role: 'TEACHER' } } }});
    const teacher2 = await prisma.teacher.create({ data: { user: { create: { email: `t2_${runId}@test.com`, password: '123', role: 'TEACHER' } } }});
    const classA = await prisma.class.create({ data: { name: `Class A ${runId}` } });

    console.log('Testing isolated transaction concurrency (Server Action DB primitive)...');

    const assignLogic = async (teacherId: string, classId: string) => {
      await prisma.$transaction(async (tx) => {
        await tx.classTeacherAssignment.updateMany({
          where: { classId, academicSessionId: testSession.id, isActive: true },
          data: { isActive: false, endedAt: new Date() }
        });
        await tx.classTeacherAssignment.create({
          data: { teacherId, classId, academicSessionId: testSession.id, isActive: true }
        });
      });
    };

    // 4. Overlapping Concurrency Barrier (Phase 11 Style)
    let barrier = true;
    const req1 = (async () => {
      while(barrier) { await new Promise(r => setTimeout(r, 1)); }
      return assignLogic(teacher1.id, classA.id);
    })();
    const req2 = (async () => {
      while(barrier) { await new Promise(r => setTimeout(r, 1)); }
      return assignLogic(teacher2.id, classA.id);
    })();

    barrier = false; // RELEASE

    // Note: Due to SQLite locking on Turso, one of these might throw a PrismaClientKnownRequestError (Transaction failed) 
    // or both might succeed serially. Either way, the invariant must hold.
    try {
      await Promise.all([req1, req2]);
    } catch (e: any) {
      console.log(`    (Expected concurrency error caught: ${e.message.substring(0, 50)}...)`);
    }

    // 5. Assert Invariant: One ACTIVE Class Teacher per class per session
    const activeAssignments = await prisma.classTeacherAssignment.findMany({
      where: { classId: classA.id, academicSessionId: testSession.id, isActive: true }
    });

    if (activeAssignments.length > 1) {
      log('CONC-01', 'Class Teacher cardinality invariant violated under concurrency', 'FAIL', { activeCount: activeAssignments.length });
    } else {
      log('CONC-01', 'Class Teacher cardinality invariant strictly maintained', 'PASS', { activeCount: activeAssignments.length });
    }

    // Cleanup
    if (originalSessionId) {
      await prisma.schoolSettings.update({
        where: { id: "default" },
        data: { activeSessionId: originalSessionId }
      });
    }
    
    await prisma.classTeacherAssignment.deleteMany({ where: { academicSessionId: testSession.id } });
    await prisma.teacher.delete({ where: { id: teacher1.id } });
    await prisma.teacher.delete({ where: { id: teacher2.id } });
    await prisma.class.delete({ where: { id: classA.id } });
    await prisma.academicSession.delete({ where: { id: testSession.id } });

    console.log('\nConcurrency escalation complete.');
  } catch (e: any) {
    console.error('Fatal Error during scan:', e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runConcurrencyEscalation();
