import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

const adapter = new PrismaLibSql({ 
  url: process.env.DATABASE_URL || 'file:./dev.db',
  authToken: process.env.DATABASE_AUTH_TOKEN
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database with demo data...')

  const adminPassword = await bcrypt.hash('password123', 10)
  const teacherPassword = await bcrypt.hash('password123', 10)
  const studentPassword = await bcrypt.hash('password123', 10)

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.local' },
    update: { password: adminPassword },
    create: {
      email: 'admin@school.local',
      password: adminPassword,
      name: 'System Administrator',
      role: 'ADMIN',
    },
  })

  const teacher1User = await prisma.user.upsert({
    where: { email: 'teacher@school.local' },
    update: { password: teacherPassword },
    create: {
      email: 'teacher@school.local',
      password: teacherPassword,
      name: 'John Doe',
      role: 'TEACHER',
    },
  })

  const teacher2User = await prisma.user.upsert({
    where: { email: 'teacher2@school.local' },
    update: { password: teacherPassword },
    create: {
      email: 'teacher2@school.local',
      password: teacherPassword,
      name: 'Jane Smith',
      role: 'TEACHER',
    },
  })

  const teacher3User = await prisma.user.upsert({
    where: { email: 'teacher3@school.local' },
    update: { password: teacherPassword },
    create: {
      email: 'teacher3@school.local',
      password: teacherPassword,
      name: 'Robert Johnson',
      role: 'TEACHER',
    },
  })

  // 2. Create Teachers
  const teacher1 = await prisma.teacher.upsert({
    where: { userId: teacher1User.id },
    update: {},
    create: { userId: teacher1User.id },
  })

  const teacher2 = await prisma.teacher.upsert({
    where: { userId: teacher2User.id },
    update: {},
    create: { userId: teacher2User.id },
  })

  const teacher3 = await prisma.teacher.upsert({
    where: { userId: teacher3User.id },
    update: {},
    create: { userId: teacher3User.id },
  })

  // 3. Create Classes
  const classA = await prisma.class.upsert({
    where: { name: 'Grade 10 - A' },
    update: {},
    create: { name: 'Grade 10 - A', teacherId: teacher1.id },
  })

  const classB = await prisma.class.upsert({
    where: { name: 'Grade 10 - B' },
    update: {},
    create: { name: 'Grade 10 - B', teacherId: teacher2.id },
  })

  // 4. Create Subjects
  const mathSubject = await prisma.subject.upsert({
    where: { code: 'MATH10' },
    update: {},
    create: { 
      name: 'Mathematics', 
      code: 'MATH10', 
      teacher: { connect: { id: teacher1.id } },
      classes: { connect: [{ id: classA.id }, { id: classB.id }] }
    },
  })

  const scienceSubject = await prisma.subject.upsert({
    where: { code: 'SCI10' },
    update: {},
    create: { 
      name: 'Science', 
      code: 'SCI10', 
      teacher: { connect: { id: teacher2.id } },
      classes: { connect: [{ id: classA.id }, { id: classB.id }] }
    },
  })

  const historySubject = await prisma.subject.upsert({
    where: { code: 'HIS10' },
    update: {},
    create: { 
      name: 'History', 
      code: 'HIS10', 
      teacher: { connect: { id: teacher3.id } },
      classes: { connect: [{ id: classA.id }, { id: classB.id }] }
    },
  })

  // 5. Create Students and Marks
  const students = []
  for (let i = 1; i <= 10; i++) {
    const studentUser = await prisma.user.upsert({
      where: { email: `student${i === 1 ? '' : i}@school.local` },
      update: { password: studentPassword },
      create: {
        email: `student${i === 1 ? '' : i}@school.local`,
        password: studentPassword,
        name: `Student ${i}`,
        role: 'STUDENT',
      },
    })

    const student = await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        userId: studentUser.id,
        classId: i <= 5 ? classA.id : classB.id,
      },
    })
    students.push(student)

    // Assign marks for Midterm
    const subjects = [
      { subject: mathSubject, teacherId: teacher1.id },
      { subject: scienceSubject, teacherId: teacher2.id },
      { subject: historySubject, teacherId: teacher3.id },
    ]

    for (const { subject, teacherId } of subjects) {
      // Random score between 60 and 100
      const score = Math.floor(Math.random() * 41) + 60
      const isPublished = Math.random() > 0.3 // 70% published
      await prisma.mark.upsert({
        where: {
          studentId_subjectId_examType: {
            studentId: student.id,
            subjectId: subject.id,
            examType: 'Midterm',
          },
        },
        update: { score, status: isPublished ? 'PUBLISHED' : 'DRAFT' },
        create: {
          studentId: student.id,
          subjectId: subject.id,
          teacherId,
          examType: 'Midterm',
          score,
          maxScore: 100,
          status: isPublished ? 'PUBLISHED' : 'DRAFT',
        },
      })
    }
  }

  console.log('Seed completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
