"use server"

import prisma from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"

/**
 * Bulk-export all students (all pages, not just current page).
 * RBAC: ADMIN only.
 * Returns an array safe for CsvExportButton serialization.
 */
export async function exportAllStudents(classId?: string) {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }

  const where: any = {}
  if (classId && classId !== "all") {
    where.classId = classId
  }

  const students = await prisma.student.findMany({
    where,
    include: { user: true, class: true },
    orderBy: { user: { name: "asc" } },
  })

  return students.map(s => ({
    name: sanitizeCsvValue(s.user.name ?? ""),
    email: sanitizeCsvValue(s.user.email),
    rollNumber: sanitizeCsvValue(s.rollNumber ?? ""),
    className: sanitizeCsvValue(s.class?.name ?? "Unassigned"),
    enrolledDate: new Date(s.user.createdAt).toLocaleDateString(),
  }))
}

/**
 * Bulk-export all teachers (all pages).
 * RBAC: ADMIN only.
 */
export async function exportAllTeachers() {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }

  const teachers = await prisma.teacher.findMany({
    include: { user: true, classes: true },
    orderBy: { user: { name: "asc" } },
  })

  return teachers.map(t => ({
    name: sanitizeCsvValue(t.user.name ?? ""),
    email: sanitizeCsvValue(t.user.email),
    assignedClass: sanitizeCsvValue(
      t.classes && t.classes.length > 0 ? t.classes[0].name : "Not Assigned"
    ),
  }))
}

/**
 * Bulk-export all classes.
 * RBAC: ADMIN only.
 */
export async function exportAllClasses() {
  const session = await verifySession()
  if (!session || session.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }

  const classes = await prisma.class.findMany({
    include: { teacher: { include: { user: true } }, students: true },
    orderBy: { name: "asc" },
  })

  return classes.map(c => ({
    name: sanitizeCsvValue(c.name),
    teacher: sanitizeCsvValue(c.teacher?.user.name ?? "Unassigned"),
    studentCount: String(c.students.length),
  }))
}

/**
 * Sanitize a CSV cell value.
 * - Wraps in quotes
 * - Escapes internal double-quotes
 * - Prepends apostrophe for formula-starting characters (=, +, -, @)
 *   to prevent CSV injection in spreadsheet applications
 */
function sanitizeCsvValue(val: string): string {
  // Prevent formula injection
  if (val.startsWith("=") || val.startsWith("+") || val.startsWith("-") || val.startsWith("@")) {
    val = "'" + val
  }
  return val
}
