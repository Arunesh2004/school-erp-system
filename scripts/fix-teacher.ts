import prisma from '../src/lib/prisma';

async function main() {
  const studentUser = await prisma.user.findUnique({
    where: {email: 'student1@test.com'}, 
    include: {
      student: {
        include: {
          class: {
            include: {
              subjects: true
            }
          }
        }
      }
    }
  }); 
  const teacherUser = await prisma.user.findUnique({
    where: {email: 'teacher1@test.com'}, 
    include: {teacher: true}
  }); 
  
  const studentFirstSubject = studentUser?.student?.class?.subjects[0];
  if (studentFirstSubject && teacherUser?.teacher) {
    await prisma.subject.update({
      where: { id: studentFirstSubject.id },
      data: { teacherId: teacherUser.teacher.id }
    });
    console.log('UPDATED SUBJECT TEACHER:', studentFirstSubject.id);
  } else {
    console.log('Could not update.');
  }
} 
main().finally(()=>prisma.$disconnect());
