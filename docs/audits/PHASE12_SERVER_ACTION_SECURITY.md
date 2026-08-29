# PHASE 12: SERVER ACTION SECURITY AUDIT

This document evaluates the structural security of every Server Action in the system across six critical dimensions: Authentication, Authorization, Ownership, Session Scope, Relationship Scope, and TOCTOU.

## Assessment Dimensions
1. **Authentication:** Is current user derived securely?
2. **Authorization:** Is role verified server-side?
3. **Ownership:** Does the caller own/manage the target entity?
4. **Session Scope:** Is the global active academic session validated?
5. **Relationship Scope:** Are entity relationships canonically validated (e.g. `TeachingAssignment`)?
6. **Mass Assignment:** Can unexpected inputs alter protected columns?

---

## 1. Teacher Actions (`src/app/actions/teacher.ts`)

| Action | Auth/Role | Ownership | Session Scope | Relationship Scope | Mass Assignment / TOCTOU |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `upsertMark` | 🟢 Verified (JWT `TEACHER`) | 🟢 Validated via `assertMarkEntryAuthorized` | 🟢 Validated | 🟢 `TeachingAssignment` | 🟢 Safe (Zod parsed schema, explicit upsert fields) |
| `bulkUpdateMarkStatus`| 🟢 Verified (JWT `TEACHER`) | 🟢 Explicit `where: { teacherId }` filter | 🟢 Checked against `StudentAcademicRecord` status | N/A (Ownership implicitly proves scope) | 🟢 Safe (Explicit `data: { status }` update) |

## 2. Attendance Actions (`src/app/actions/attendance.ts`)

| Action | Auth/Role | Ownership | Session Scope | Relationship Scope | Mass Assignment / TOCTOU |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `upsertAttendance` | 🟢 Verified (JWT `TEACHER` / `ADMIN`) | 🟢 Validated via `assertClassTeacherOwnership` | 🟢 Validated | 🟢 `ClassTeacherAssignment` | 🟢 Safe |
| `bulkMarkPresent` | 🟢 Verified | 🟢 Validated via `validateAttendanceRoster` | 🟢 Validated | 🟢 Enforces all students belong to the class | 🟢 Safe |

## 3. Notes & Learning Hub (`src/app/actions/notes.ts`)

| Action | Auth/Role | Ownership | Session Scope | Relationship Scope | Mass Assignment / TOCTOU |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `createChapter` | 🟢 Verified (`TEACHER`) | 🟢 Validated via `assertTeacherCanManageContent` | 🟢 Validated | 🟢 `TeachingAssignment` | 🟢 Safe |
| `updateChapter` | 🟢 Verified | 🟢 `where: { id, teacherId }` | 🟢 Validated | N/A (Ownership established) | 🟢 Safe |
| `createTopic` | 🟢 Verified | 🟢 Queries parent Chapter to verify `teacherId` | 🟢 Validated | N/A | 🟢 Safe |
| `updateTopic` | 🟢 Verified | 🟢 Deep relational check: `topic.chapter.teacherId` | 🟢 Validated | N/A | 🟢 Safe |
| `requestFileUploadUrl`| 🟢 Verified | 🟢 Deep relational check to `topic.chapter.teacherId` | 🟢 Validated | N/A | 🟢 Safe. S3 path server-generated. |
| `confirmFileUpload` | 🟢 Verified | 🟢 Verifies Topic ownership | 🟢 Validated | N/A | 🟢 Safe. S3 URL never exposed. |

## 4. Admin Promotions & Transfer (`src/app/actions/promotions.ts`, `admin.ts`)

| Action | Auth/Role | Ownership | Session Scope | Relationship Scope | Mass Assignment / TOCTOU |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `promoteStudents` | 🟢 Verified (`ADMIN`) | N/A (Admin is global) | 🟢 Uses `SchoolSettings.activeSessionId` | 🟢 Validates source/destination class IDs | 🟢 Safe. Complex $transaction guarantees integrity. |
| `transferStudent` | 🟢 Verified (`ADMIN`) | N/A | 🟢 Queries current session | 🟢 Validates source/destination class IDs | 🟢 Safe |

## 5. Generic Admin Mutations (`src/app/actions/admin.ts`)

| Action | Auth/Role | Ownership | Session Scope | Relationship Scope | Mass Assignment / TOCTOU |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `createStudent/Teacher`| 🟢 Verified (`ADMIN`) | N/A | N/A | 🟢 Safe | 🟢 Safe (Zod parsed schema, generates password hash server-side) |
| `deleteStudent/Teacher`| 🟢 Verified (`ADMIN`) | N/A | N/A | 🟢 Cascade deletes handle relationships safely | 🟢 Safe |
| `assignClassTeacher` | 🟢 Verified (`ADMIN`) | N/A | 🟢 Binds to active session | 🟢 Validates Teacher/Class existence | 🟢 Safe |
| `createTeachingAssignment` | 🟢 Verified (`ADMIN`) | N/A | 🟢 Binds to active session | 🟢 Validates Teacher/Subject/Class | 🟢 Safe |

## Summary

The Server Actions are structurally robust. There are no obvious Mass Assignment or Missing Authentication vulnerabilities. The complex access control relies completely on the `teacher-authorization.ts` and `session.ts` layers functioning correctly. If those layers pass the dynamic IDOR tests (Phase 3), the Server Actions are verified secure.
