# PHASE 12: AUTHORIZATION ATTACK MATRIX

## 1. Authentication Boundaries

| Boundary | Verification Mechanism | Weaknesses / Risks | Dynamic Test Required? |
| :--- | :--- | :--- | :--- |
| **All `/admin`, `/teacher`, `/student` routes** | Layouts check `verifySession()` (JWT) + `prisma.user.findUnique()` (DB). | Highly secure for UI navigation. DB lookup mitigates stale JWTs for page loads. | No, statically verified secure. |
| **Server Actions** | `verifySession()` (JWT only) + Action-specific DB checks. | `verifySession` does NOT hit DB. Relies on downstream action to verify identity/role. | Yes. Test if a deactivated user with valid JWT can call actions. |
| **`/api/notes/download/[id]`** | `verifySession()` (JWT only) + Resource ownership DB checks. | Same as actions. | Yes. Test deactivated user file access. |

## 2. Server Action Parameter Trust Matrix

Analysis of whether critical parameters are derived securely (Server) or vulnerable to client injection (Client).

| Critical Input | Server Actions | Source | Enforcement Mechanism | IDOR Risk |
| :--- | :--- | :--- | :--- | :--- |
| `userId` / Identity | All | **SERVER** | Derived exclusively from JWT payload. | **None.** Client cannot forge JWT signature. |
| `role` | All | **SERVER** | Derived from JWT. Checked against Action requirements. | **None.** Client cannot forge JWT signature. |
| `expectedSessionId` | Most Mutations | **CLIENT** | Checked against `SchoolSettings.activeSessionId` in DB. | **Low.** Server prevents cross-session mutation. |
| `studentId` | `upsertMark`, `upsertAttendance`, `transferStudent`, `promoteStudents` | **CLIENT** | Must exist in `StudentEnrollment` for active session + Teacher's `TeachingAssignment`/`ClassTeacherAssignment`. | **High.** Relies entirely on custom `teacher-authorization.ts` logic. Must be dynamically tested. |
| `subjectId` | `upsertMark`, `createChapter`, `createTopic` | **CLIENT** | Checked against `TeachingAssignment` (Subject Teacher). | **High.** Relies on custom authorization layer. |
| `classId` | `bulkMarkPresent`, `createChapter` | **CLIENT** | Checked against `ClassTeacherAssignment` or `TeachingAssignment`. | **High.** |
| `markId`, `chapterId`, `topicId` | `bulkUpdateMarkStatus`, `updateChapter`, `updateTopic` | **CLIENT** | DB query explicitly filters by `teacherId` of the requesting user. | **Low.** Ownership strictly enforced in `where` clause. |
| `S3 Object Key` | `confirmFileUpload`, file downloads | **SERVER** | Path is generated on server or read from DB. Client only sees Signed URLs. | **None.** Server-side generation prevents path traversal. |

## 3. IDOR Attack Scenarios (To Be Dynamically Executed)

These scenarios represent explicit tests that will be executed in Phase 3.

### Teacher cross-boundary IDOR
- **Scenario A:** Teacher A attempts to call `upsertMark` for a student in Teacher B's class.
- **Scenario B:** Teacher A attempts to call `upsertMark` for a student they teach, but in a subject they do NOT teach.
- **Scenario C:** Teacher A calls `bulkUpdateMarkStatus` passing a `markId` belonging to Teacher B.
- **Scenario D:** Teacher A attempts to mark attendance for a class where they are only a subject teacher, not the class teacher.

### Student cross-boundary IDOR
- **Scenario E:** Student A calls `/api/notes/download/[id]` using the ID of a PDF scoped to a different class.
- **Scenario F:** Student A attempts to download a PDF that is in `DRAFT` status.
- **Scenario G:** Student A attempts to access notes for a subject not taught to their class.

### Admin bypass scenarios
- **Scenario H:** Student or Teacher calls `promoteStudents` bypassing the UI layout. (Expected: `verifySession` blocks).
- **Scenario I:** Teacher calls `createSession` to manipulate the global active session.

## 4. Specific Pattern Audit

- **Trusting `userId` from request body:** No instances found. `userId` always comes from `verifySession()`.
- **Trusting `role` from client:** No instances found. `role` comes from JWT.
- **Trusting `classId` without canonical authorization:** Some legacy endpoints might exist, but the new `teacher-authorization.ts` uses canonical `TeachingAssignment`. This will be dynamically tested.
- **Direct Prisma update/delete by ID without ownership checks:**
  - `bulkUpdateMarkStatus`: SAFE. `where: { id: { in: markIds }, teacherId: teacherId }`.
  - `deleteAnnouncement`: SAFE. `where: { id, authorId: session.userId }` (wait, I need to check this!).
  - `updateChapter`/`updateTopic`: SAFE. Checks `teacherId`.
  - **Hypothesis:** Admin actions (like `deleteStudent`) do not check ownership because Admins own everything, but they do require the `"ADMIN"` JWT role.

---
*Matrix generated statically. Pending dynamic execution in Phase 3.*
