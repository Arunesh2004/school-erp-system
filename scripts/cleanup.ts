import prisma from '../src/lib/prisma';

async function cleanup() {
  console.log('Cleaning up test chapters...');
  const chapters = await prisma.learningChapter.findMany({
    where: {
      title: {
        startsWith: 'FINAL UPLOAD TEST'
      }
    }
  });

  console.log(`Found ${chapters.length} test chapters.`);
  for (const c of chapters) {
    await prisma.learningChapter.delete({
      where: { id: c.id }
    });
    console.log(`Deleted chapter ${c.id}`);
  }
  
  console.log('Cleanup complete.');
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
