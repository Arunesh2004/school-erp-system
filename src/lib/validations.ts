import { z } from "zod"

export const studentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  classId: z.string().min(1, "Class is required"),
})

export const teacherSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
})

export const classSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters"),
  teacherId: z.string().optional(),
})

export const subjectSchema = z.object({
  name: z.string().min(2, "Subject name must be at least 2 characters"),
  code: z.string().min(2, "Subject code must be at least 2 characters"),
  teacherId: z.string().optional(),
})

export const markSchema = z.object({
  score: z.coerce.number().min(0, "Score cannot be negative").max(100, "Score cannot exceed 100"),
  studentId: z.string().min(1, "Student is required"),
  subjectId: z.string().min(1, "Subject is required"),
  examType: z.string().min(1, "Exam type is required"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
})
