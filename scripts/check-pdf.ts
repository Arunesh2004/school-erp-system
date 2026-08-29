import prisma from '../src/lib/prisma';

async function main() {
  const pdfs = await prisma.learningPdf.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('LATEST PDF:', JSON.stringify(pdfs, null, 2));
}

main().finally(() => prisma.$disconnect());
