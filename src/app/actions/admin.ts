"use server"

import crypto from "crypto"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { studentSchema, teacherSchema, classSchema, subjectSchema } from "@/lib/validations"
import { verifySession } from "@/lib/auth/session"

export async function createStudent(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  const data = Object.fromEntries(formData.entries())
  const parsed = studentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  
  try {
    const password = await bcrypt.hash("Student@12345", 10)
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
    const activeSessionId = settings?.activeSessionId

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          password,
          role: "STUDENT",
          mustChangePassword: true,
        }
      })
      const student = await tx.student.create({
        data: {
          userId: user.id,
          classId: parsed.data.classId,
        }
      })

      if (activeSessionId && parsed.data.classId) {
        await tx.studentEnrollment.create({
          data: {
            studentId: student.id,
            classId: parsed.data.classId,
            academicSessionId: activeSessionId
          }
        })
      }
    })
    revalidatePath("/admin/students")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create student. Email might already exist." }
  }
}

export async function createTeacher(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  const data = Object.fromEntries(formData.entries())
  const parsed = teacherSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  
  try {
    const password = await bcrypt.hash("Teacher@12345", 10)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          password,
          role: "TEACHER",
          mustChangePassword: true,
        }
      })
      await tx.teacher.create({
        data: {
          userId: user.id,
        }
      })
    })
    revalidatePath("/admin/teachers")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create teacher. Email might already exist." }
  }
}

export async function createClass(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  const data = Object.fromEntries(formData.entries())
  const parsed = classSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  
  try {
    await prisma.class.create({
      data: {
        name: parsed.data.name,
        teacherId: parsed.data.teacherId || null,
      }
    })
    revalidatePath("/admin/classes")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create class. Name might already exist." }
  }
}

export async function createSubject(formData: FormData) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  const data = Object.fromEntries(formData.entries())
  const parsed = subjectSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  
  try {
    await prisma.subject.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        teacherId: parsed.data.teacherId || null,
      }
    })
    revalidatePath("/admin/subjects")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create subject. Code or Name might already exist." }
  }
}

export async function deleteStudent(id: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath("/admin/students")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete student." }
  }
}

export async function deleteTeacher(id: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath("/admin/teachers")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete teacher." }
  }
}

export async function deleteClass(id: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    await prisma.class.delete({ where: { id } })
    revalidatePath("/admin/classes")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete class." }
  }
}

export async function deleteSubject(id: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    await prisma.subject.delete({ where: { id } })
    revalidatePath("/admin/subjects")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete subject." }
  }
}

export async function assignClassTeacher(teacherId: string, classId: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
    const activeSessionId = settings?.activeSessionId
    if (!activeSessionId) return { error: "No active academic session." }

    // Validate inputs
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    const targetClass = await prisma.class.findUnique({ where: { id: classId } })

    if (!teacher || !targetClass) {
      return { error: "Teacher or Class not found." }
    }

    // Use a transaction to ensure integrity
    await prisma.$transaction(async (tx) => {
      // 1. Deactivate any existing class teacher for this class in this session
      await tx.classTeacherAssignment.updateMany({
        where: { classId, academicSessionId: activeSessionId, isActive: true },
        data: { isActive: false, endedAt: new Date() }
      })

      // 2. Deactivate any existing class teacher assignments for THIS teacher in this session
      // (Optional business rule: one teacher can only be class teacher for one class)
      await tx.classTeacherAssignment.updateMany({
        where: { teacherId, academicSessionId: activeSessionId, isActive: true },
        data: { isActive: false, endedAt: new Date() }
      })

      // 3. Create the new active assignment
      await tx.classTeacherAssignment.create({
        data: {
          teacherId,
          classId,
          academicSessionId: activeSessionId,
          isActive: true
        }
      })

      // 4. Update legacy `Class.teacherId` for backward compatibility/display
      await tx.class.updateMany({
        where: { teacherId },
        data: { teacherId: null } // clear old
      })
      await tx.class.update({
        where: { id: classId },
        data: { teacherId }
      })
    })

    revalidatePath("/admin/teachers")
    revalidatePath("/teacher/class", "layout")
    revalidatePath("/teacher", "layout")
    revalidatePath("/student", "layout")
    
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "Failed to assign class teacher." }
  }
}

export async function removeClassTeacherAssignment(assignmentId: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    const assignment = await prisma.classTeacherAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) return { error: "Assignment not found." }

    await prisma.$transaction(async (tx) => {
      await tx.classTeacherAssignment.update({
        where: { id: assignmentId },
        data: { isActive: false, endedAt: new Date() }
      })
      // Clear legacy
      if (assignment.isActive) {
        await tx.class.update({
          where: { id: assignment.classId },
          data: { teacherId: null }
        })
      }
    })

    revalidatePath("/admin/teachers")
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "Failed to remove assignment." }
  }
}

export async function createTeachingAssignment(teacherId: string, subjectId: string, classId: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
    const activeSessionId = settings?.activeSessionId
    if (!activeSessionId) return { error: "No active academic session." }

    await prisma.$transaction(async (tx) => {
      // Deactivate any existing assignment for this subject+class+session
      await tx.teachingAssignment.updateMany({
        where: { subjectId, classId, academicSessionId: activeSessionId, isActive: true },
        data: { isActive: false, endedAt: new Date() }
      })

      // Create new assignment
      await tx.teachingAssignment.create({
        data: {
          teacherId,
          subjectId,
          classId,
          academicSessionId: activeSessionId,
          isActive: true
        }
      })
    })

    revalidatePath("/admin/teachers")
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "Failed to create teaching assignment." }
  }
}

export async function removeTeachingAssignment(assignmentId: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    await prisma.teachingAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false, endedAt: new Date() }
    })
    revalidatePath("/admin/teachers")
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "Failed to remove assignment." }
  }
}

export async function transferStudent(studentId: string, newClassId: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "default" } })
    const activeSessionId = settings?.activeSessionId
    if (!activeSessionId) return { error: "No active academic session." }

    await prisma.$transaction(async (tx) => {
      // Find current active enrollment
      const currentEnrollment = await tx.studentEnrollment.findFirst({
        where: { studentId, academicSessionId: activeSessionId, status: "ACTIVE" }
      })

      if (currentEnrollment) {
        if (currentEnrollment.classId === newClassId) {
          throw new Error("Student is already in this class.")
        }
        // Deactivate old
        await tx.studentEnrollment.update({
          where: { id: currentEnrollment.id },
          data: { status: "TRANSFERRED" }
        })
      }

      // Create new active enrollment
      await tx.studentEnrollment.create({
        data: {
          studentId,
          classId: newClassId,
          academicSessionId: activeSessionId,
          status: "ACTIVE"
        }
      })

      // Update legacy classId
      await tx.student.update({
        where: { id: studentId },
        data: { classId: newClassId }
      })
    })

    revalidatePath("/admin/students")
    return { success: true }
  } catch (error: any) {
    console.error(error)
    return { error: error.message || "Failed to transfer student." }
  }
}

export async function resetUserPassword(userId: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") return { error: "Unauthorized" }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { error: "User not found." }
    
    // Generate a cryptographically secure one-time 10-character alphanumeric password
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let tempPasswordStr = ""
    for (let i = 0; i < 10; i++) {
      const randomIndex = crypto.randomInt(0, chars.length)
      tempPasswordStr += chars[randomIndex]
    }

    const password = await bcrypt.hash(tempPasswordStr, 10)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password,
        mustChangePassword: true,
      }
    })

    if (user.role === "STUDENT") revalidatePath("/admin/students")
    if (user.role === "TEACHER") revalidatePath("/admin/teachers")
    
    return { success: true, tempPassword: tempPasswordStr }
  } catch (error) {
    console.error(error)
    return { error: "Failed to reset password." }
  }
}

