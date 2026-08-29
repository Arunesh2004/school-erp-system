# DATA SYNCHRONIZATION & ROLE ISOLATION AUDIT REPORT
**School ERP — Phase 13 Critical Audit**
*Read-only analysis. No code modified.*

---

## 1. CURRENT RELATIONSHIP ARCHITECTURE

### Schema-Level Entity Map

```
User (email, role: ADMIN|TEACHER|STUDENT)
  ├── Teacher
  │    ├── Class[] (via Class.teacherId)          ← CLASS TEACHER ASSIGNMENT
  │    ├── Subject[] (via Subject.teacherId)       ← SUBJECT TEACHER ASSIGNMENT
  │    ├── Mark[] (marks given by this teacher)
  │    ├── Attendance[] (marked by this teacher)
  │    └── LearningChapter[] (content created)
  │
  └── Student
       ├── Class? (via Student.classId)            ← CURRENT CLASS POINTER (mutable)
       ├── Mark[]
       ├── Attendance[]
       ├── StudentAcademicRecord[]
       └── StudentEnrollment[]                     ← SESSION-SCOPED ENROLLMENT

Class
  ├── Teacher? (via Class.teacherId)               ← ONE HOMEROOM TEACHER MAX
  ├── Student[] (via Student.classId)              ← ALL-TIME class members
  ├── Subject[] (via _ClassToSubject join table)   ← MANY-TO-MANY
  ├── Attendance[]
  ├── StudentAcademicRecord[]
  └── StudentEnrollment[]

Subject
  ├── Teacher? (via Subject.teacherId)             ← ONE SUBJECT TEACHER MAX (GLOBALLY)
  ├── Class[] (many-to-many via _ClassToSubject)
  ├── Mark[]
  └── LearningChapter[]

AcademicSession
  ├── StudentEnrollment[]
  ├── Mark[]
  ├── Attendance[]
  ├── StudentAcademicRecord[]
  └── LearningChapter[]

StudentEnrollment
  ├── studentId + classId + academicSessionId      ← UNIQUE per student per session
  └── StudentAcademicRecord[]

Mark
  └── studentId + subjectId + examType            ← UNIQUE (no session in key!)
```

---

## 2. SINGLE-SOURCE-OF-TRUTH ANALYSIS

### 2.1 Student → Class membership

**Current State: DUAL-SOURCE — CRITICAL RISK**

There are **two** competing sources of truth for what class a student belongs to:

| Source | Field | Used For |
|--------|-------|----------|
| `Student.classId` | Global FK to `Class` | Attendance queries, Class Teacher view, Promotions |
| `StudentEnrollment` | Per-session record | Learning Hub, Report Cards |

**This means**:
- Attendance page reads students via `Student.classId` (no session scope on the join)
- Learning Hub uses `StudentEnrollment` for authorization (correct)
- If a student is promoted but `Student.classId` is not updated (or vice versa), the two sources diverge

### 2.2 Class Teacher Assignment

**Current State: SESSION-UNAWARE — HIGH RISK**

The class teacher assignment is stored as `Class.teacherId` — a simple nullable foreign key with **no session scope**.

```
Class { teacherId: String? }
```

There is **no table like**:
```
ClassTeacherAssignment { classId, teacherId, academicSessionId }
```

**Consequence**: Historical teacher assignments are completely overwritten on reassignment. The system has no memory of "who was class teacher in session 2025". The current teacher may differ from who taught during a historical session, but marks/attendance are still attributed to the class, not the session-era teacher.

### 2.3 Subject Teacher Assignment

**Current State: SESSION-UNAWARE AND GLOBAL — CRITICAL RISK**

The subject teacher assignment is: `Subject.teacherId` — **one teacher globally per subject, across all classes and all sessions**.

This means the system **cannot represent**:
```
Mathematics → Teacher A for 10-A
Mathematics → Teacher B for 10-B
Mathematics → Teacher C for 11-A
```

Currently **only one teacher can be assigned globally to a subject**. This is a fundamental architectural limitation.

The Class-Subject relationship is a many-to-many through `_ClassToSubject` (implicit Prisma join table), which has no teacherId or session.

### 2.4 Student Marks Authorization

**Current State: WEAK — HIGH RISK**

In `upsertMark()` (actions/teacher.ts lines 28-33):
```typescript
const subject = await prisma.subject.findUnique({ where: { id: parsed.data.subjectId } })
if (subject?.teacherId !== teacherId) {
  return { error: "You are not authorized..." }
}
```

This only checks: **"Is this teacher assigned to this global subject?"**

It does NOT check:
- Whether the **student** is in one of the classes that subject is assigned to
- Whether the student belongs to the **teacher's authorized class set**

A teacher could enter marks for a student from **any class** as long as they teach that subject globally.

---

## 3. CRITICAL RISKS DISCOVERED

### 🔴 CRITICAL RISK 1: One Subject Teacher Globally
**File**: `prisma/schema.prisma` line 91 — `Subject.teacherId`

**Problem**: A subject has exactly one teacher globally. Real schools have:
- Math → Teacher A for Class 10-A
- Math → Teacher B for Class 10-B

**Impact**: Cannot correctly model multi-section subject assignments.

### 🔴 CRITICAL RISK 2: Student Authorization Not Verified in Mark Entry
**File**: `src/app/actions/teacher.ts` lines 27-33

**Problem**: `upsertMark` only verifies the teacher is assigned to the subject. It does **not** verify that the `studentId` passed belongs to a class the teacher is authorized for.

**Attack scenario**: Teacher A (Math, 10-A) can enter marks for any student in the DB as long as they teach Math. They can set marks for a student in 10-B, 11-A etc.

### 🔴 CRITICAL RISK 3: Marks Page Shows Wrong Student Pool
**File**: `src/app/(dashboard)/teacher/marks/page.tsx` lines 46-57

```typescript
const classesWithSubjects = await prisma.class.findMany({
  where: { subjects: { some: { teacherId } } },
  include: { students: { include: { user: true } } }
})
```

**Problem**: This fetches all students from all classes that have ANY subject taught by this teacher — **without session filtering**. If a student transferred out last year but `Student.classId` hasn't been updated, they still appear.

### 🔴 CRITICAL RISK 4: Class Teacher Attendance Authorization Uses Global Class FK
**File**: `src/app/actions/attendance.ts` lines 22-25

```typescript
const cls = await prisma.class.findUnique({ where: { id: data.classId } })
if (cls?.teacherId !== teacherId) { return { error: "Unauthorized" } }
```

**Problem**: This correctly checks that the teacher is the homeroom teacher of the class. BUT — it uses the global `Class.teacherId` with no session awareness. If Teacher A was reassigned away from 10-A mid-year but still has a browser session open, Teacher A **can still mark attendance** until the server restarts the session check (which happens on every request, so this is actually OK server-side, but the underlying model has no session scope for the assignment itself).

### 🔴 CRITICAL RISK 5: Attendance Bulk-Mark Uses Student.classId Without Session
**File**: `src/app/actions/attendance.ts` lines 108-109

```typescript
const studentsInClass = await prisma.student.findMany({
  where: { id: { in: studentIds }, classId: classId }
})
```

**Problem**: Uses `Student.classId` (global current class) rather than `StudentEnrollment` to validate class membership. A student who was transferred out but has their `Student.classId` still pointing to the old class will still be included.

### 🔴 CRITICAL RISK 6: Class Teacher Page Uses Student.classId (No Session Filter)
**File**: `src/app/(dashboard)/teacher/class/page.tsx` lines 36-57

```typescript
const teacherClass = await prisma.class.findFirst({
  where: { teacherId: dbUser.teacher.id },
  include: {
    students: { /* NO where: { academicSessionId } */ }
  }
})
```

**Problem**: The student list for the class teacher is fetched by `Class → students` relation (i.e., `Student.classId === class.id`), without any `StudentEnrollment`-based session filtering. A student who was enrolled last year in this class, promoted, but somehow still has their `classId` pointing to the old class will appear incorrectly. More importantly, there is no session-scoped enrollment check at all.

### 🟡 MEDIUM RISK 7: Attendance Page Student List Not Session-Filtered
**File**: `src/app/(dashboard)/teacher/attendance/page.tsx` lines 36-52

The homeroom class is found correctly (`teacherId` check). But students come from `Class.students` relation (i.e., `Student.classId` FK), not from active-session `StudentEnrollment`. The attendance records themselves are filtered by `academicSessionId`, which is correct, but the **student roster** is not enrollment-scoped.

### 🟡 MEDIUM RISK 8: Promotion Action Updates Student.classId Only
**File**: `src/app/actions/promotions.ts` lines 101-125

After promoting students, the action:
1. ✅ Updates `Student.classId` to new destination
2. ✅ Creates `StudentEnrollment` for the *next* session

But it does **not** create a `StudentEnrollment` for the destination class in the *next* session if there's no `nextSession` (throws error). This is safe, but means promoted students are in limbo if no next session exists.

### 🟡 MEDIUM RISK 9: assignClassTeacher Removes Teacher From All Previous Classes
**File**: `src/app/actions/admin.ts` lines 197-207

```typescript
await prisma.class.updateMany({
  where: { teacherId },
  data: { teacherId: null }
})
```

**Problem**: A teacher can only be class teacher of ONE class at a time. This is enforced by clearing old assignments. But the schema does not have a unique constraint enforcing this — if `updateMany` is somehow bypassed, duplicate class-teacher assignments become possible.

### 🟡 MEDIUM RISK 10: Mark Unique Constraint Missing Academic Session
**File**: `prisma/schema.prisma` line 118

```
@@unique([studentId, subjectId, examType])
```

No `academicSessionId` in the unique key. This means a student cannot have both a Midterm mark in Math for 2025 and a Midterm mark in Math for 2026. **Historical marks for the same exam type will conflict across sessions**.

### 🟡 MEDIUM RISK 11: Subject Assigned to Classes via Implicit Join Table
**File**: `prisma/schema.prisma` lines 87-97 & 74-85

The `Subject ↔ Class` is a Prisma implicit many-to-many relation. There is no explicit join table with `academicSessionId` or `teacherId`. So:
- The same subject-class relationship persists across sessions with no historical tracking
- You cannot track "which teacher taught Math in 10-A in 2025 vs 2026"

### 🟢 WORKING CORRECTLY 12: Learning Hub Authorization
**File**: `src/app/(dashboard)/student/learning-hub/[subjectId]/page.tsx`

This is the best-authored authorization in the codebase. It correctly:
1. Looks up active session
2. Finds student's `StudentEnrollment` for that session
3. Verifies the subject belongs to the enrolled class
4. Only returns `PUBLISHED` content

### 🟢 WORKING CORRECTLY 13: Session Change Detection
The `expectedSessionId` pattern used in mark entry and attendance actions correctly rejects stale submissions when the active session changes.

---

## 4. ROLE DATA VISIBILITY MATRIX (ACTUAL vs REQUIRED)

| Feature | Admin | Class Teacher | Subject Teacher | Student |
|---------|-------|---------------|-----------------|---------|
| All students | ✅ Correct | ❌ Gets all students in class (no session filter) | ❌ Gets all students in subject-classes (no session filter) | N/A |
| Student roster | N/A | 🟡 Uses `Student.classId` not enrollment | 🔴 Uses class-subject join, no session | N/A |
| Marks entry | N/A | N/A | 🔴 No student-class validation | N/A |
| Attendance | N/A | 🟡 Uses `Student.classId` not enrollment | N/A | N/A |
| Learning Hub | N/A | N/A | N/A | ✅ Enrollment-scoped |
| Subject assignment | ✅ Global only | N/A | N/A | N/A |
| Cross-section isolation | ✅ | ✅ (class teacher sees only their class) | 🔴 Subject is global, no class isolation | ✅ |

---

## 5. EDGE CASE ANALYSIS

### Edge Case 1 — Teacher assigned to multiple classes
**Current Capability**: A teacher can only be class teacher of ONE class (enforced by `updateMany` clear). A subject teacher is globally assigned.

**Risk**: Cannot correctly support "Teacher A teaches Math in 10-A and 10-B". Subject teacher is always global.

**Verdict**: 🔴 Architecture does not support this use case.

### Edge Case 2 — Teacher is both Class Teacher and Subject Teacher
**Current State**: These are separate systems (`Class.teacherId` vs `Subject.teacherId`). No conflict enforced either way.

**Risk**: A teacher who is class teacher of 10-A and subject teacher of Math (global) will see ALL students from all classes linked to Math in their marks form, not just 10-A.

**Verdict**: 🔴 Marks form over-exposes student data across sections.

### Edge Case 3 — Teacher reassignment
**Admin reassigns teacher**: `Class.teacherId` updated immediately. Server always fetches fresh on each request — no caching issue.

**Risk**: Old teacher has zero server-side access after reassignment. ✅ This works correctly.
**Risk**: Historical marks still attribute to `teacherId` (old teacher). No retrospective cleanup. This is acceptable behavior.

**Verdict**: 🟢 Correctly handled from security perspective.

### Edge Case 4 — Student transfer
If admin changes `Student.classId`:
- Attendance page immediately shows student in new class ✅
- Class teacher page of old class still shows student until `classId` is updated ✅ (it's from `classId`)
- Class teacher page of new class shows student ✅
- Learning Hub: student still uses OLD enrollment until new `StudentEnrollment` created ❌

**There is no "transfer student" action in the admin panel** — the admin would need to both update `Student.classId` AND create a new `StudentEnrollment`. If only `classId` is updated, the Learning Hub breaks.

**Verdict**: 🔴 No student transfer workflow exists. Ad-hoc changes risk desync between `Student.classId` and `StudentEnrollment`.

### Edge Case 5 — Student promotion
**Promotion action** correctly:
- Updates `Student.classId` to new class ✅
- Creates new `StudentEnrollment` for next session ✅

**Risk**: Historical session data preserved because marks/attendance are session-scoped ✅

**Verdict**: 🟢 Promotion correctly handled.

### Edge Case 6 — Section confusion (10-A vs 10-B)
Because class name is globally unique (`@@unique`) and the system uses `classId` (UUID) not grade number, section confusion at the query level is not possible for correctly-written queries.

However, the subject-class many-to-many has no session scope, so if "Mathematics" is assigned to both 10-A and 10-B, and Teacher A teaches Mathematics globally, Teacher A's marks form will show ALL students from BOTH 10-A and 10-B.

**Verdict**: 🔴 For subject teachers with multi-section subjects.

### Edge Case 7 — Same subject taught by different teachers per class
**Current State**: IMPOSSIBLE. `Subject.teacherId` is a single FK. Only one teacher per subject globally.

**Verdict**: 🔴 Fundamental architecture limitation.

### Edge Case 8 — Teacher assignment removed
If admin removes a subject teacher (`Subject.teacherId = null`), the authorization check in `upsertMark` (`subject?.teacherId !== teacherId`) would fail for the old teacher's next request. ✅

**But**: If the teacher has an open browser tab, existing mark edit forms still show the student list rendered at page load time. A submitted form will be rejected by the server, but the UI doesn't reflect the change until refresh. ✅ (Server correctly rejects)

**Verdict**: 🟢 Server-side correctly handles this; client UI is stale but submissions rejected.

### Edge Case 9 — Duplicate assignments
Subject assignments: only one teacher per subject globally (unique FK). No duplicate possible.

Class teacher assignments: The `updateMany` pattern prevents duplicates via business logic, but there is **no database-level unique constraint** on `Class.teacherId` being globally unique per teacher. Multiple classes could theoretically point to the same teacherId (though the UI only sets one). No `@@unique([teacherId])` constraint.

**Verdict**: 🟡 Prevent at DB level is recommended.

### Edge Case 10 — Two Class Teachers per class
Currently the system allows at most ONE class teacher per class (via `Class.teacherId` scalar FK). If you try to assign a second teacher as class teacher of the same class using the current UI, the `updateMany` clears the first teacher's class assignment first and then assigns the new one. ✅

But: there is no unique constraint at the DB level preventing two classes from having the same teacher, and no constraint ensuring one teacher doesn't get manually assigned to two classes outside the UI.

**Verdict**: 🟡 Should add unique constraint `@unique` on `Class.teacherId` if single class teacher per class is the rule, OR introduce a proper `ClassTeacherAssignment` table with a unique constraint.

---

## 6. MISSING CONSTRAINTS

| Table | Missing Constraint | Risk |
|-------|-------------------|------|
| `Mark` | `@@unique([studentId, subjectId, examType])` needs `academicSessionId` added | Cross-session mark conflicts |
| `Class` | No unique constraint on `teacherId` | Multiple classes could share a teacher |
| `Subject` | Global single teacher — no per-class-per-session teaching assignment | Cannot model multi-section subjects |
| No `ClassTeacherAssignment` table | No session-scoped class teacher history | Cannot audit who was class teacher in past sessions |
| No `SubjectTeacherClassAssignment` table | No per-class, per-session subject teacher mapping | Cannot support Teacher A for 10-A, Teacher B for 10-B |
| `StudentEnrollment` | `@@unique([studentId, academicSessionId])` — no `classId` in unique key | A student could theoretically be enrolled in two classes in the same session (not currently enforced by UI but possible via code) |

---

## 7. CROSS-MODULE DEPENDENCY MAP

```
Admin assigns Subject Teacher
→ Subject.teacherId updated
→ Teacher Dashboard: ✅ (uses teacherId)
→ Marks Form Student List: 🔴 All students from all classes with that subject
→ Marks Entry Validation: 🔴 No student-class cross-check
→ Attendance: ❌ Not affected (attendance uses class teacher, not subject teacher)
→ Learning Hub (Teacher): 🔴 Notes tied to subjectId, not class — anyone enrolled in subject sees them regardless of class
→ Learning Hub (Student): ✅ Enrollment-scoped correctly
→ Report Cards: ✅ Session-scoped student records
→ CSV Exports: 🟡 Derived from marks/students which have the above issues
```

---

## 8. CHANGE IMPACT MATRIX (CURRENT STATE)

| Admin Action | Student Roster | Teacher Dashboard | Marks | Attendance | Notes/LHub | Reports |
|-------------|----------------|-------------------|-------|------------|------------|---------|
| Assign class teacher | ✅ Immediate | ✅ Immediate | N/A | ✅ Immediate | N/A | N/A |
| Remove class teacher | ✅ Immediate | ✅ Immediate | N/A | ✅ Immediate | N/A | N/A |
| Assign subject teacher | N/A | ✅ Immediate | 🔴 No class scope | N/A | 🔴 No class scope | N/A |
| Remove subject teacher | N/A | ✅ Immediate | ✅ Rejected | N/A | 🔴 Old content still exists | N/A |
| Transfer student | 🔴 No transfer UI | 🔴 No sync | 🟡 classId-based | 🟡 classId-based | 🔴 Enrollment not updated | 🟡 Historical preserved |
| Promote student | ✅ Next session enrollment | ✅ New class | ✅ Session-scoped | ✅ Session-scoped | ✅ New session context | ✅ Archived |
| Create new session | N/A | ✅ Gates operations | ✅ Session required | ✅ Session required | ✅ Session-scoped | N/A |

---

## 9. PROPOSED MINIMAL FIXES (Priority Ordered)

### FIX 1 — 🔴 P0: Add Student Validation to upsertMark
**File**: `src/app/actions/teacher.ts`

After verifying the teacher owns the subject, also verify the student is enrolled in one of the classes that has that subject AND is in the active session.

```typescript
// After subject ownership check:
const enrollment = await prisma.studentEnrollment.findFirst({
  where: {
    studentId: parsed.data.studentId,
    academicSessionId: activeSessionId,
    class: { subjects: { some: { id: parsed.data.subjectId } } }
  }
})
if (!enrollment) return { error: "Student is not enrolled in a class with this subject." }
```

### FIX 2 — 🔴 P0: Filter Student List in Marks Page Using Enrollment
**File**: `src/app/(dashboard)/teacher/marks/page.tsx`

Change student pool query to use `StudentEnrollment` instead of `Student.classId`:

```typescript
// Instead of:
prisma.class.findMany({ where: { subjects: { some: { teacherId } } }, include: { students: ... } })

// Use:
prisma.studentEnrollment.findMany({
  where: {
    academicSessionId: activeSessionId,
    class: { subjects: { some: { teacherId } } }
  },
  include: { student: { include: { user: true } } }
})
```

### FIX 3 — 🔴 P0: Filter Students in Attendance and Class Teacher Pages Using Enrollment
**Files**: `attendance/page.tsx`, `class/page.tsx`, `actions/attendance.ts`

Use `StudentEnrollment.where({ academicSessionId })` rather than `Student.classId` to derive the roster.

### FIX 4 — 🟡 P1: Add academicSessionId to Mark Unique Constraint
**File**: `prisma/schema.prisma`

```prisma
@@unique([studentId, subjectId, examType, academicSessionId])
```
This requires a migration.

### FIX 5 — 🟡 P1: Add Student Transfer Workflow
Add an admin action `transferStudent(studentId, newClassId)` that atomically:
1. Updates `Student.classId`
2. Updates the current session's `StudentEnrollment.classId`
3. Preserves historical records

### FIX 6 — 🟡 P1: Scope Bulk Attendance Validation to Enrollment
**File**: `src/app/actions/attendance.ts` lines 108-109

Change `where: { id: { in: studentIds }, classId: classId }` to verify via enrollment.

### FIX 7 — 🟠 P2: Introduce Per-Class Subject Teaching Assignment
**Architectural change** — Introduce a new model:
```prisma
model SubjectClassAssignment {
  id                String   @id @default(uuid())
  teacherId         String
  teacher           Teacher  @relation(...)
  subjectId         String
  subject           Subject  @relation(...)
  classId           String
  class             Class    @relation(...)
  academicSessionId String
  academicSession   AcademicSession @relation(...)
  
  @@unique([teacherId, subjectId, classId, academicSessionId])
}
```

This is a major architectural change — deferred to a separate phase with full migration planning.

---

## 10. TEST STRATEGY

### Phase A — Automated Integration Tests Needed

1. **Roster Integrity Test**: For each teacher + session, compare expected student IDs (from enrollments) vs actual query results
2. **Cross-class Isolation Test**: Teacher A (subject X, class 10-A) should NOT be able to enter marks for a student in 10-B
3. **Session Isolation Test**: Students from 2025 session should not appear in 2026 session queries
4. **Student Transfer Test**: After moving student, verify old class teacher loses student, new class teacher gains student
5. **Stale Session Test**: After session change, verify `expectedSessionId` guard rejects old submissions

### Phase B — Browser Verification (Post-Fix)

Physically test all four roles after fixes applied to verify the corrected roster isolation.

---

## 11. SUMMARY

| Category | Risk Level | Issues Found |
|----------|-----------|--------------|
| Subject teacher multi-class | 🔴 CRITICAL | Cannot assign different teachers per class |
| Student pool in marks form | 🔴 CRITICAL | No session or class isolation |
| Mark entry student validation | 🔴 CRITICAL | No cross-class check |
| Student roster in class/attendance pages | 🔴 CRITICAL | Uses `Student.classId` not `StudentEnrollment` |
| Student transfer workflow | 🔴 CRITICAL | Does not exist |
| Mark unique constraint (no session) | 🟡 HIGH | Cross-session mark conflicts |
| Class teacher session scope | 🟡 HIGH | Assignment has no session history |
| Bulk attendance student validation | 🟡 HIGH | Uses `Student.classId` |
| Learning Hub student authorization | 🟢 GOOD | Correctly session + enrollment scoped |
| Mark submission stale session guard | 🟢 GOOD | expectedSessionId check works |
| Teacher reassignment revocation | 🟢 GOOD | Server-side check on each request |
| Admin authorization | 🟢 GOOD | Role check on all admin actions |
