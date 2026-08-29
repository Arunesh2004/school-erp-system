import prisma from '../src/lib/prisma';

async function main() {
  console.log('Cleaning up test data...');
  
  // Find test chapters
  const testChapters = await prisma.learningChapter.findMany({
    where: { title: { startsWith: 'FINAL UPLOAD TEST CHAPTER' } }
  });
  
  console.log(`Found ${testChapters.length} test chapters to delete.`);
  
  for (const chapter of testChapters) {
    // Delete associated topics (which cascade deletes PDFs/Videos/Explanations)
    await prisma.learningTopic.deleteMany({
      where: { chapterId: chapter.id }
    });
    
    // Delete the chapter
    await prisma.learningChapter.delete({
      where: { id: chapter.id }
    });
  }
  
  console.log('Cleanup complete.');
}

main().finally(() => prisma.$disconnect());
