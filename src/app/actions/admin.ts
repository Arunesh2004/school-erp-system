"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { studentSchema, teacherSchema, classSchema, subjectSchema } from "@/lib/validations"

export async function createStudent(formData: FormData) {
  const data = Object.fromEntries(formData.entries())
  const parsed = studentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  
  try {
    const password = await bcrypt.hash("Student@12345", 10)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          password,
          role: "STUDENT",
        }
      })
      await tx.student.create({
        data: {
          userId: user.id,
          classId: parsed.data.classId,
        }
      })
    })
    revalidatePath("/admin/students")
    return { success: true }
  } catch (error) {
    return { error: "Failed to create student. Email might already exist." }
  }
}

export async function createTeacher(formData: FormData) {
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
  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath("/admin/students")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete student." }
  }
}

export async function deleteTeacher(id: string) {
  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath("/admin/teachers")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete teacher." }
  }
}

export async function deleteClass(id: string) {
  try {
    await prisma.class.delete({ where: { id } })
    revalidatePath("/admin/classes")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete class." }
  }
}

export async function deleteSubject(id: string) {
  try {
    await prisma.subject.delete({ where: { id } })
    revalidatePath("/admin/subjects")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete subject." }
  }
}

export async function assignClassTeacher(teacherId: string, classId: string) {
  try {
    // Validate inputs
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    const targetClass = await prisma.class.findUnique({ where: { id: classId } })

    if (!teacher || !targetClass) {
      return { error: "Teacher or Class not found." }
    }

    // Step 1: Remove teacher from any previously assigned classes
    await prisma.class.updateMany({
      where: { teacherId },
      data: { teacherId: null }
    })

    // Step 2: Assign selected class
    await prisma.class.update({
      where: { id: classId },
      data: { teacherId }
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

