import prisma from '../src/lib/prisma'

async function main() {
  const teacherUser = await prisma.user.findUnique({
    where: {email: 'teacher1@test.com'}, 
    include: {teacher: true}
  });
  const subjectId = '13c25d70-c07a-497a-a3eb-17a1f77f109e';
  const subject = await prisma.subject.findUnique({ 
    where: { id: subjectId },
    include: { classes: true }
  });
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } });
  
  if (teacherUser?.teacher && subject && subject.classes.length > 0 && settings?.activeSessionId) {
    await prisma.teachingAssignment.create({
      data: {
        teacherId: teacherUser.teacher.id,
        subjectId: subject.id,
        classId: subject.classes[0].id,
        academicSessionId: settings.activeSessionId,
        isActive: true
      }
    });
    console.log('Successfully assigned teacher1 to subject', subjectId);
  } else {
    console.log('Failed to assign', { teacher: !!teacherUser, subject: !!subject, session: !!settings });
  }
}

main().finally(() => prisma.$disconnect());
