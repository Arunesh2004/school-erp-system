# PHASE 12: DATABASE INVARIANT REPORT

This document maps all application-level invariants to their underlying Prisma schema representation to determine if the invariant is enforced by the database (Strong Enforcement) or solely by application logic (Weak Enforcement / Race Condition Risk).

## 1. Schema Constraints & Invariants

| Invariant | Application Enforcement | Database Enforcement | Risk Level / Notes |
| :--- | :--- | :--- | :--- |
| **One ACTIVE Enrollment per student per session** | Yes (`transferStudent` sets old to `TRANSFERRED`, new to `ACTIVE`) | **NO** (No partial DB index exists for `status="ACTIVE"`) | 🟡 Requires dynamic check-then-write testing. |
| **No duplicate Marks** | Yes (`upsertMark` ensures unique) | **YES** (`@@unique([studentId, subjectId, examType, academicSessionId])`) | 🟢 Safe from concurrency. |
| **No duplicate Attendance** | Yes (`upsertAttendance`) | **YES** (`@@unique([studentId, date])`) | 🟢 Safe from concurrency. |
| **No orphaned Marks** | N/A | **YES** (Cascade deletes / FK constraints) | 🟢 Safe. |
| **No orphaned Attendance** | N/A | **YES** (Cascade deletes / FK constraints) | 🟢 Safe. |
| **One ACTIVE Class Teacher per class per session** | Yes (`assignClassTeacher` deactivates old) | **NO** | 🟡 Application check-then-write risk. |
| **One ACTIVE Subject Teacher per subject/class/session**| Yes (`createTeachingAssignment` deactivates old) | **NO** | 🟡 Application check-then-write risk. |
| **One Finalized Academic Record** | Yes | **YES** (`@@unique([studentId, academicSessionId])`) | 🟢 Safe. |

## 2. Invariant Risk Analysis & Dynamic Scan Plan

The invariants marked **NO** for Database Enforcement rely entirely on Prisma transaction sequences to prevent corruption. If `Promise.all()` or overlapping HTTP requests hit these mutations concurrently, they could violate the invariant (e.g. creating two ACTIVE enrollments for a student).

In Phase 3, we will deploy a dynamic invariant scanner to sweep the database and verify:
1. `SELECT count(*), studentId FROM StudentEnrollment WHERE status='ACTIVE' GROUP BY studentId HAVING count(*) > 1`
2. `SELECT count(*), classId FROM ClassTeacherAssignment WHERE isActive=1 GROUP BY classId HAVING count(*) > 1`
3. `SELECT count(*), classId, subjectId FROM TeachingAssignment WHERE isActive=1 GROUP BY classId, subjectId HAVING count(*) > 1`

*Matrix generated statically. Pending dynamic execution in Phase 3.*
