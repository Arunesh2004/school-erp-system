import prisma from "../prisma"
import { getClassTeacherClassIds } from "./teacher-authorization"
import { Role } from "@prisma/client"

export type AlertTargetPayload = {
  targetType: "GLOBAL" | "ALL_TEACHERS" | "ALL_STUDENTS" | "SPECIFIC_CLASSES" | "SPECIFIC_STUDENTS"
  classIds?: string[]
  studentIds?: string[]
}

/**
 * Validates whether the given user (with active role) can create an alert
 * for the specified target payload in the current academic session.
 * 
 * Returns an array of validated target User IDs if successful, or throws an error.
 */
export async function resolveAndAuthorizeAlertTargets(
  userId: string,
  role: Role,
  payload: AlertTargetPayload,
  academicSessionId: string
): Promise<string[]> {
  // 1. ADMIN AUTHORIZATION
  if (role === "ADMIN") {
    return resolveAdminTargets(payload, academicSessionId)
  }

  // 2. TEACHER AUTHORIZATION (Class Teachers only)
  if (role === "TEACHER") {
    return resolveTeacherTargets(userId, payload, academicSessionId)
  }

  // 3. OTHERS
  throw new Error("Authorization denied: You do not have permission to create alerts.")
}

/**
 * Resolves targets for ADMIN (Global Authority).
 */
async function resolveAdminTargets(
  payload: AlertTargetPayload,
  academicSessionId: string
): Promise<string[]> {
  const targetIds = new Set<string>()

  if (payload.targetType === "GLOBAL") {
    const users = await prisma.user.findMany({ select: { id: true } })
    users.forEach(u => targetIds.add(u.id))
  } 
  else if (payload.targetType === "ALL_TEACHERS") {
    const teachers = await prisma.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true }
    })
    teachers.forEach(t => targetIds.add(t.id))
  }
  else if (payload.targetType === "ALL_STUDENTS") {
    const students = await prisma.studentEnrollment.findMany({
      where: { academicSessionId, status: "ACTIVE" },
      include: { student: true }
    })
    students.forEach(e => targetIds.add(e.student.userId))
  }
  else if (payload.targetType === "SPECIFIC_CLASSES") {
    if (!payload.classIds || payload.classIds.length === 0) {
      throw new Error("Validation failed: No classes specified.")
    }
    const students = await prisma.studentEnrollment.findMany({
      where: {
        classId: { in: payload.classIds },
        academicSessionId,
        status: "ACTIVE"
      },
      include: { student: true }
    })
    students.forEach(e => targetIds.add(e.student.userId))
  }
  else if (payload.targetType === "SPECIFIC_STUDENTS") {
    if (!payload.studentIds || payload.studentIds.length === 0) {
      throw new Error("Validation failed: No students specified.")
    }
    const students = await prisma.studentEnrollment.findMany({
      where: {
        student: { userId: { in: payload.studentIds } },
        academicSessionId,
        status: "ACTIVE"
      },
      include: { student: true }
    })
    students.forEach(e => targetIds.add(e.student.userId))
  }

  return Array.from(targetIds)
}

/**
 * Resolves targets for TEACHER (Restricted to Class Teacher scope).
 */
async function resolveTeacherTargets(
  userId: string,
  payload: AlertTargetPayload,
  academicSessionId: string
): Promise<string[]> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } })
  if (!teacher) {
    throw new Error("Authorization denied: Teacher profile not found.")
  }

  // Get canonical assigned class IDs for this session
  const authorizedClassIds = await getClassTeacherClassIds(teacher.id, academicSessionId)
  
  if (authorizedClassIds.length === 0) {
    throw new Error("Authorization denied: You are not assigned as a Class Teacher in the current session.")
  }

  const targetIds = new Set<string>()

  if (payload.targetType === "SPECIFIC_CLASSES") {
    if (!payload.classIds || payload.classIds.length === 0) {
      throw new Error("Validation failed: No classes specified.")
    }

    // ALL-OR-NOTHING validation
    const hasUnauthorizedClass = payload.classIds.some(id => !authorizedClassIds.includes(id))
    if (hasUnauthorizedClass) {
      throw new Error("Authorization denied: You can only target classes you are actively assigned to as Class Teacher.")
    }

    const students = await prisma.studentEnrollment.findMany({
      where: {
        classId: { in: payload.classIds },
        academicSessionId,
        status: "ACTIVE"
      },
      include: { student: true }
    })
    students.forEach(e => targetIds.add(e.student.userId))
  }
  else if (payload.targetType === "SPECIFIC_STUDENTS") {
    if (!payload.studentIds || payload.studentIds.length === 0) {
      throw new Error("Validation failed: No students specified.")
    }

    // Validate every student is actively enrolled in one of the teacher's assigned classes
    const validEnrollments = await prisma.studentEnrollment.findMany({
      where: {
        student: { userId: { in: payload.studentIds } },
        classId: { in: authorizedClassIds },
        academicSessionId,
        status: "ACTIVE"
      },
      include: { student: true }
    })

    const validUserIds = new Set(validEnrollments.map(e => e.student.userId))
    const hasUnauthorizedStudent = payload.studentIds.some(id => !validUserIds.has(id))
    
    // ALL-OR-NOTHING validation
    if (hasUnauthorizedStudent) {
      throw new Error("Authorization denied: One or more selected students are not in your assigned classes.")
    }

    validEnrollments.forEach(e => targetIds.add(e.student.userId))
  }
  else {
    throw new Error(`Authorization denied: Teachers cannot create alerts with targetType ${payload.targetType}.`)
  }

  return Array.from(targetIds)
}

/**
 * Asserts the current user is the recipient of the given alert ID.
 */
export async function assertAlertRecipient(alertId: string, userId: string): Promise<void> {
  const recipient = await prisma.alertRecipient.findUnique({
    where: { alertId_userId: { alertId, userId } }
  })

  if (!recipient) {
    throw new Error("Authorization denied: You are not a recipient of this alert.")
  }
}

/**
 * Asserts the current user is the creator of the given alert ID (or an Admin).
 */
export async function assertAlertCreatorOrAdmin(alertId: string, userId: string, role: Role): Promise<void> {
  if (role === "ADMIN") return

  const alert = await prisma.alert.findUnique({
    where: { id: alertId }
  })

  if (!alert) {
    throw new Error("Alert not found.")
  }

  if (alert.creatorId !== userId) {
    throw new Error("Authorization denied: You do not have permission to manage this alert.")
  }
}
