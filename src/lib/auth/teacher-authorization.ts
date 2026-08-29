/**
 * CANONICAL TEACHER AUTHORIZATION SERVICE
 *
 * This is the single source of truth for all teacher roster and permission checks.
 *
 * AUTHORIZATION CHAIN (from correction #10):
 *   Class Teacher role:
 *     ClassTeacherAssignment(isActive=true, sessionId) → Class → StudentEnrollment(ACTIVE, sessionId)
 *
 *   Subject Teacher role:
 *     TeachingAssignment(isActive=true, sessionId, subjectId, classId) → StudentEnrollment(ACTIVE, sessionId, classId)
 *
 * IMPORTANT: These functions query NEW canonical tables only.
 * Legacy fields (Class.teacherId, Subject.teacherId, Student.classId) are NOT used as security authority.
 *
 * SEPARATION PER CORRECTION #10:
 *   - Class teacher students vs Subject teacher students are intentionally separate helpers.
 *   - DO NOT use getTeacherAuthorizedStudents() as a catch-all across modules.
 *   - Each module must call the role-specific method appropriate to its context.
 */

import prisma from "@/lib/prisma"

// ============================================================
// SESSION HELPERS
// ============================================================

/**
 * Returns the active academic session, or null if none set.
 */
export async function getActiveAcademicSession() {
  const settings = await prisma.schoolSettings.findUnique({
    where: { id: "default" },
    include: { activeSession: true }
  })
  return settings?.activeSession ?? null
}

/**
 * Returns the active session ID, or throws if none configured.
 * Use this in mutations to ensure session-gate is always enforced.
 */
export async function requireActiveSessionId(): Promise<string> {
  const session = await getActiveAcademicSession()
  if (!session) throw new Error("No active academic session configured.")
  return session.id
}

// ============================================================
// CLASS TEACHER ROLE HELPERS
// (for Attendance and Class Teacher Dashboard — NOT for marks)
// ============================================================

/**
 * Returns all ACTIVE class teacher assignments for a teacher in the given session.
 * A teacher may be class teacher of multiple classes.
 */
export async function getClassTeacherAssignments(
  teacherId: string,
  academicSessionId: string
) {
  return prisma.classTeacherAssignment.findMany({
    where: { teacherId, academicSessionId, isActive: true },
    include: { class: true }
  })
}

/**
 * Returns the class IDs where the teacher is the ACTIVE class teacher this session.
 */
export async function getClassTeacherClassIds(
  teacherId: string,
  academicSessionId: string
): Promise<string[]> {
  const assignments = await getClassTeacherAssignments(teacherId, academicSessionId)
  return assignments.map(a => a.classId)
}

/**
 * Returns the exact student set authorized for the CLASS TEACHER ROLE.
 * These are students with ACTIVE enrollment in the teacher's assigned class(es).
 *
 * USE FOR: Attendance marking, Class dashboard, Student profile access, Report generation.
 * DO NOT USE FOR: Marks entry (use getStudentsForSubjectAssignment instead).
 */
export async function getStudentsForClassTeacherRole(
  teacherId: string,
  academicSessionId: string
) {
  const classIds = await getClassTeacherClassIds(teacherId, academicSessionId)
  if (classIds.length === 0) return []

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classId: { in: classIds },
      academicSessionId,
      status: "ACTIVE"
    },
    include: {
      student: { include: { user: true } },
      class: true
    }
  })
  return enrollments
}

/**
 * Asserts the teacher is the ACTIVE class teacher for the given class this session.
 * Throws a descriptive error if not.
 */
export async function assertClassTeacherOwnership(
  teacherId: string,
  classId: string,
  academicSessionId: string
): Promise<void> {
  const assignment = await prisma.classTeacherAssignment.findFirst({
    where: { teacherId, classId, academicSessionId, isActive: true }
  })
  if (!assignment) {
    throw new Error(
      "Authorization denied: You are not the active class teacher for this class in the current session."
    )
  }
}

/**
 * Asserts the given student has an ACTIVE enrollment in one of the teacher's classes this session.
 * Throws if not. Use for student profile access by class teacher.
 */
export async function assertStudentInClassTeacherRoster(
  teacherId: string,
  studentId: string,
  academicSessionId: string
): Promise<{ classId: string; enrollmentId: string }> {
  const classIds = await getClassTeacherClassIds(teacherId, academicSessionId)
  if (classIds.length === 0) {
    throw new Error("Authorization denied: You have no class assignments this session.")
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      studentId,
      classId: { in: classIds },
      academicSessionId,
      status: "ACTIVE"
    }
  })

  if (!enrollment) {
    throw new Error(
      "Authorization denied: This student is not enrolled in your class(es) for the current session."
    )
  }

  return { classId: enrollment.classId, enrollmentId: enrollment.id }
}

// ============================================================
// SUBJECT TEACHER ROLE HELPERS
// (for Marks entry and Subject Teacher Dashboard — NOT for attendance)
// ============================================================

/**
 * Returns all ACTIVE teaching assignments for a teacher this session.
 * Each assignment represents: teacher → subject → class → session.
 */
export async function getSubjectTeachingAssignments(
  teacherId: string,
  academicSessionId: string
) {
  return prisma.teachingAssignment.findMany({
    where: { teacherId, academicSessionId, isActive: true },
    include: { subject: true, class: true }
  })
}

/**
 * Returns the distinct class IDs where the teacher has active subject teaching assignments.
 */
export async function getSubjectTeacherClassIds(
  teacherId: string,
  academicSessionId: string
): Promise<string[]> {
  const assignments = await getSubjectTeachingAssignments(teacherId, academicSessionId)
  return [...new Set(assignments.map(a => a.classId))]
}

/**
 * Returns the ACTIVE enrollment records (with students) for all classes where
 * the teacher has a TeachingAssignment for the given subject.
 *
 * USE FOR: Marks entry student list (shows students who can receive marks for this subject).
 * Each enrollment includes the class context for authorization verification.
 */
export async function getStudentsForSubjectAssignment(
  teacherId: string,
  subjectId: string,
  academicSessionId: string
) {
  // Find all classes where this teacher teaches this subject this session
  const assignments = await prisma.teachingAssignment.findMany({
    where: { teacherId, subjectId, academicSessionId, isActive: true }
  })
  const authorizedClassIds = assignments.map(a => a.classId)
  if (authorizedClassIds.length === 0) return []

  return prisma.studentEnrollment.findMany({
    where: {
      classId: { in: authorizedClassIds },
      academicSessionId,
      status: "ACTIVE"
    },
    include: {
      student: { include: { user: true } },
      class: true
    }
  })
}

/**
 * Asserts the teacher has an ACTIVE TeachingAssignment for subject+class+session.
 * Throws a descriptive error if not.
 *
 * USE FOR: Validating marks entry authorization.
 */
export async function assertTeachingAssignment(
  teacherId: string,
  subjectId: string,
  classId: string,
  academicSessionId: string
): Promise<void> {
  const assignment = await prisma.teachingAssignment.findFirst({
    where: { teacherId, subjectId, classId, academicSessionId, isActive: true }
  })
  if (!assignment) {
    throw new Error(
      "Authorization denied: You do not have an active teaching assignment for this subject in this class."
    )
  }
}

/**
 * Full marks authorization chain (Correction #4):
 *   Teacher → TeachingAssignment → Subject + Class + Session → StudentEnrollment → Student
 *
 * Validates:
 * 1. Student has ACTIVE enrollment in the session
 * 2. Teacher has ACTIVE TeachingAssignment for subject in student's enrolled class
 * 3. Session matches (prevents stale-session attacks)
 *
 * Returns the validated enrollment so callers can use the canonical classId.
 * Throws descriptive errors on any failure.
 */
export async function assertMarkEntryAuthorized(
  teacherId: string,
  studentId: string,
  subjectId: string,
  academicSessionId: string
): Promise<{ enrollmentId: string; classId: string }> {
  // Step 1: Verify student has ACTIVE enrollment in this session
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId, academicSessionId, status: "ACTIVE" }
  })
  if (!enrollment) {
    throw new Error(
      "Validation failed: Student has no active enrollment in the current session."
    )
  }

  // Step 2: Verify teacher has TeachingAssignment for this subject in this student's class
  const assignment = await prisma.teachingAssignment.findFirst({
    where: {
      teacherId,
      subjectId,
      classId: enrollment.classId,
      academicSessionId,
      isActive: true
    }
  })
  if (!assignment) {
    throw new Error(
      "Authorization denied: You do not have an active teaching assignment for this subject in this student's class."
    )
  }

  return { enrollmentId: enrollment.id, classId: enrollment.classId }
}

/**
 * Validates ALL student IDs in a bulk attendance submission.
 * Every student must be ACTIVE-enrolled in the specified class for this session.
 * This prevents forged or stale student IDs in bulk submissions.
 *
 * Returns an object containing:
 *   - validStudentIds: student IDs that passed validation
 *   - invalidStudentIds: any that failed (should cause rejection of entire batch)
 */
export async function validateAttendanceRoster(
  studentIds: string[],
  classId: string,
  academicSessionId: string
): Promise<{ validStudentIds: string[]; invalidStudentIds: string[] }> {
  if (studentIds.length === 0) return { validStudentIds: [], invalidStudentIds: [] }

  const validEnrollments = await prisma.studentEnrollment.findMany({
    where: {
      studentId: { in: studentIds },
      classId,
      academicSessionId,
      status: "ACTIVE"
    },
    select: { studentId: true }
  })

  const validSet = new Set(validEnrollments.map(e => e.studentId))
  const validStudentIds = studentIds.filter(id => validSet.has(id))
  const invalidStudentIds = studentIds.filter(id => !validSet.has(id))

  return { validStudentIds, invalidStudentIds }
}

// ============================================================
// LEARNING HUB HELPERS
// ============================================================

/**
 * Returns ACTIVE TeachingAssignments for a teacher in active session,
 * suitable for displaying their subjects on the Learning Hub index.
 * Scoped to class + subject — not global subject ownership.
 */
export async function getTeacherLearningHubAssignments(
  teacherId: string,
  academicSessionId: string
) {
  const assignments = await prisma.teachingAssignment.findMany({
    where: { teacherId, academicSessionId, isActive: true },
    include: { subject: true, class: true },
    orderBy: [{ subject: { name: 'asc' } }, { class: { name: 'asc' } }]
  })
  return assignments
}

/**
 * Asserts teacher has an active TeachingAssignment for the given subjectId in this session.
 * Used for protecting Learning Hub content management routes.
 * For class-scoped content, pass classId; for legacy null-classId content, pass undefined.
 */
export async function assertTeacherCanManageContent(
  teacherId: string,
  subjectId: string,
  academicSessionId: string,
  classId?: string
): Promise<void> {
  const where: any = { teacherId, subjectId, academicSessionId, isActive: true }
  if (classId) where.classId = classId

  const assignment = await prisma.teachingAssignment.findFirst({ where })
  if (!assignment) {
    throw new Error(
      "Authorization denied: You do not have a teaching assignment for this subject (or class) in the current session."
    )
  }
}
