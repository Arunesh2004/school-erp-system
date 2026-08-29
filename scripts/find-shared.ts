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
  const studentSubjects = studentUser?.student?.class?.subjects || []; 
  const sharedSubject = studentSubjects.find(s => s.teacherId === teacherUser?.teacher?.id); 
  console.log('SHARED SUBJECT ID:', sharedSubject?.id); 
} 
main().finally(()=>prisma.$disconnect());
