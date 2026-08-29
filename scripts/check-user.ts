import prisma from "../src/lib/prisma";

async function run() {
  const users = await prisma.user.findMany({ where: { role: 'TEACHER' } });
  console.log('Teachers:', users.map(u => u.email));
  const admin = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  console.log('Admins:', admin.map(u => u.email));
  const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });
  console.log('Students:', students.map(u => u.email).slice(0, 5));
}
run();
