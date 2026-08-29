import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function run() {
  const hashAdmin = await bcrypt.hash('TestAdmin@123', 10);
  const hashTeacher = await bcrypt.hash('TestTeacher@123', 10);
  const hashStudent = await bcrypt.hash('TestStudent@123', 10);
  
  // Clean up if exists
  await prisma.user.deleteMany({ where: { email: { in: ['admin1@test.com', 'teacher1@test.com', 'student1@test.com'] } } });

  // Create Admin
  await prisma.user.create({ data: { name: 'E2E Admin', email: 'admin1@test.com', role: 'ADMIN', password: hashAdmin } });

  // Create Session, Class, Subject
  const session = await prisma.academicSession.findFirst() || await prisma.academicSession.create({ data: { name: 'E2E Session', startDate: new Date(), endDate: new Date() }});
  
  // Make sure session is active
  await prisma.schoolSettings.upsert({
    where: { id: "default" },
    update: { activeSessionId: session.id },
    create: { id: "default", activeSessionId: session.id }
  });

  const cls = await prisma.class.create({ data: { name: 'E2E Class' } });
  const subject = await prisma.subject.create({ data: { name: 'E2E Subject', code: 'E2E-SUBJ', classes: { connect: { id: cls.id } } } });

  // Create Teacher
  const teacherUser = await prisma.user.create({ data: { name: 'E2E Teacher', email: 'teacher1@test.com', role: 'TEACHER', password: hashTeacher } });
  const teacher = await prisma.teacher.create({ data: { userId: teacherUser.id } });
  
  // Assign Teacher
  await prisma.teachingAssignment.create({ data: { teacherId: teacher.id, subjectId: subject.id, classId: cls.id, academicSessionId: session.id, isActive: true } });

  // Create Student
  const studentUser = await prisma.user.create({ data: { name: 'E2E Student', email: 'student1@test.com', role: 'STUDENT', password: hashStudent } });
  const student = await prisma.student.create({ data: { userId: studentUser.id, classId: cls.id } });
  await prisma.studentEnrollment.create({ data: { studentId: student.id, classId: cls.id, academicSessionId: session.id, status: 'ACTIVE' } });

  console.log('E2E Data Seeded successfully.');
}
run();
