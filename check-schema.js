const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  const settings = await prisma.$queryRawUnsafe(`PRAGMA table_info(SchoolSettings)`);
  console.log(settings);
}

checkSchema().catch(console.error).finally(() => prisma.$disconnect());
