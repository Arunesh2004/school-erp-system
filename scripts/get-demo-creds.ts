import prisma from '../src/lib/prisma';

async function getDemoCredentials() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } });
  const classTeacher = await prisma.teacher.findFirst({ 
    where: { classTeacherAssignments: { some: {} } },
    include: { user: { select: { email: true } } }
  });
  const subjectTeacher = await prisma.teacher.findFirst({ 
    where: { teachingAssignments: { some: {} } },
    include: { user: { select: { email: true } } }
  });
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' }, select: { email: true } });

  console.log({
    Admin: admin?.email,
    ClassTeacher: classTeacher?.user.email,
    SubjectTeacher: subjectTeacher?.user.email,
    Student: student?.email,
  });
}

getDemoCredentials().catch(console.error).finally(() => process.exit(0));
