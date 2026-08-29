process.env.DATABASE_URL = "file:./phase11-test.db"
process.env.DATABASE_AUTH_TOKEN = "" // local sqlite doesn't need auth

import prisma from '../src/lib/prisma'
import * as bcrypt from 'bcryptjs'

async function main() {
  console.log("Starting Scale Test Seed...")

  // Clean DB (order matters due to foreign keys)
  await prisma.activityLog.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.studentAcademicRecord.deleteMany()
  await prisma.studentEnrollment.deleteMany()
  await prisma.mark.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.student.deleteMany()
  await prisma.class.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.schoolSettings.deleteMany()
  await prisma.academicSession.deleteMany()
  await prisma.user.deleteMany()

  // 1. Create Academic Sessions
  const sessionPrev = await prisma.academicSession.create({
    data: {
      name: "2024-2025",
      startDate: new Date("2024-04-01"),
      endDate: new Date("2025-03-31"),
      status: "ARCHIVED"
    }
  })

  const sessionActive = await prisma.academicSession.create({
    data: {
      name: "2025-2026",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      status: "ACTIVE"
    }
  })

  await prisma.schoolSettings.create({
    data: {
      id: "default",
      schoolName: "Scale Test Academy",
      activeSessionId: sessionActive.id
    }
  })

  // 2. Create Admins
  const adminPassword = await bcrypt.hash("TestAdmin@123", 10)
  for (let i = 1; i <= 2; i++) {
    await prisma.user.create({
      data: {
        email: `admin${i}@test.com`,
        password: adminPassword,
        name: `Admin User ${i}`,
        role: "ADMIN"
      }
    })
  }

  // 3. Create Teachers (50 subject teachers, first 10 will also be class teachers)
  const teacherPassword = await bcrypt.hash("TestTeacher@123", 10)
  const teachers = []
  for (let i = 1; i <= 50; i++) {
    const t = await prisma.user.create({
      data: {
        email: `teacher${i}@test.com`,
        password: teacherPassword,
        name: `Teacher User ${i}`,
        role: "TEACHER",
        teacher: {
          create: {}
        }
      },
      include: { teacher: true }
    })
    teachers.push(t)
  }

  // 4. Create Classes (10 classes)
  const classes = []
  for (let i = 1; i <= 10; i++) {
    const classTeacher = teachers[i - 1].teacher!
    const c = await prisma.class.create({
      data: {
        name: `Class ${i}`,
        teacherId: classTeacher.id
      }
    })
    classes.push(c)
  }

  // 5. Create Subjects (Multiple per class)
  const subjects = []
  const subjectNames = ["Mathematics", "Science", "English", "History", "Geography"]
  for (let classObj of classes) {
    for (let subjIdx = 0; subjIdx < subjectNames.length; subjIdx++) {
      // distribute subjects among the 50 teachers
      const teacherObj = teachers[Math.floor(Math.random() * teachers.length)]
      const s = await prisma.subject.create({
        data: {
          name: `${subjectNames[subjIdx]} (${classObj.name})`,
          code: `SUB_${classObj.name.replace(' ', '')}_${subjIdx}`,
          teacherId: teacherObj.teacher!.id,
          classes: { connect: { id: classObj.id } }
        }
      })
      subjects.push(s)
    }
  }

  // 6. Create Students (500 students)
  const studentPassword = await bcrypt.hash("TestStudent@123", 10)
  const students = []
  
  // Batch inserts for performance
  console.log("Creating 500 students...")
  for (let i = 1; i <= 500; i++) {
    const targetClass = classes[i % classes.length]
    const u = await prisma.user.create({
      data: {
        email: `student${i}@test.com`,
        password: studentPassword,
        name: `Student User ${i}`,
        role: "STUDENT",
        student: {
          create: {
            classId: targetClass.id,
            rollNumber: `R${i}`
          }
        }
      },
      include: { student: true }
    })
    students.push({ ...u.student, targetClassId: targetClass.id })

    // Create current enrollment
    await prisma.studentEnrollment.create({
      data: {
        studentId: u.student!.id,
        classId: targetClass.id,
        academicSessionId: sessionActive.id
      }
    })

    // Randomly create historical data for ~50% of students
    if (Math.random() > 0.5) {
      const histClass = classes[(i + 1) % classes.length]
      
      const enrollment = await prisma.studentEnrollment.create({
        data: {
          studentId: u.student!.id,
          classId: histClass.id,
          academicSessionId: sessionPrev.id
        }
      })

      await prisma.studentAcademicRecord.create({
        data: {
          studentId: u.student!.id,
          classId: histClass.id,
          academicSessionId: sessionPrev.id,
          enrollmentId: enrollment.id,
          finalPercentage: 85,
          finalGrade: "A",
          attendancePercentage: 90,
          status: "FINALIZED"
        }
      })
    }
  }

  // 7. Seed some Marks and Attendance (for testing speed)
  console.log("Creating Marks and Attendance for a subset...")
  const targetSubj = subjects[0]
  for (let i = 0; i < 50; i++) {
    const student = students[i]
    if (student) {
      await prisma.mark.create({
        data: {
          studentId: student.id!,
          subjectId: targetSubj.id,
          teacherId: targetSubj.teacherId!,
          academicSessionId: sessionActive.id,
          score: Math.floor(Math.random() * 100),
          maxScore: 100,
          examType: "Midterm",
          status: "DRAFT"
        }
      })

      await prisma.attendance.create({
        data: {
          studentId: student.id!,
          classId: student.targetClassId,
          teacherId: teachers[0].teacher!.id,
          academicSessionId: sessionActive.id,
          date: new Date(),
          status: "PRESENT"
        }
      })
    }
  }

  console.log("Scale Test Seed completed.")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
