import prisma from "../src/lib/prisma";

async function clean() {
  console.log("Cleaning phase12-test.db duplicates...");
  
  // Find duplicates (studentId + academicSessionId) that have multiple ACTIVE statuses
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { status: 'ACTIVE' }
  });
  
  const map = new Map<string, string[]>();
  for (const e of enrollments) {
    const key = `${e.studentId}_${e.academicSessionId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e.id);
  }
  
  for (const [key, ids] of map.entries()) {
    if (ids.length > 1) {
      // Keep the first, delete the rest
      const toDelete = ids.slice(1);
      await prisma.studentEnrollment.deleteMany({ where: { id: { in: toDelete } }});
      console.log(`Deleted ${toDelete.length} duplicates for ${key}`);
    }
  }

  // Also Phase 10 created new users/classes with 'HTTP-' prefix or 's10A_'
  await prisma.class.deleteMany({ where: { name: { startsWith: 'HTTP-' } }});
  await prisma.class.deleteMany({ where: { name: { in: ['10-A-Phase10', '10-B-Phase10'] } }});
  console.log("Cleaned test classes");
}

clean();
