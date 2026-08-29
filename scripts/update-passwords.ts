import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function run() {
  const hashAdmin = await bcrypt.hash('TestAdmin@123', 10);
  const hashTeacher = await bcrypt.hash('TestTeacher@123', 10);
  const hashStudent = await bcrypt.hash('TestStudent@123', 10);
  
  await prisma.user.updateMany({ where: { email: { startsWith: 'admin' } }, data: { password: hashAdmin }});
  await prisma.user.updateMany({ where: { email: { startsWith: 'teacher' } }, data: { password: hashTeacher }});
  await prisma.user.updateMany({ where: { email: { startsWith: 'student' } }, data: { password: hashStudent }});
  console.log('Passwords updated');
}
run();
