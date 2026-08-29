# Audit Trail Design (Zero Schema Modification)

## Overview
This document outlines how the School ERP utilizes the existing `ActivityLog` Prisma model to implement a robust, production-safe audit trail without requiring destructive or risky database schema migrations.

## 1. Existing Schema Utilization
The production database already contains this table:
```prisma
model ActivityLog {
  id         String   @id @default(uuid())
  action     String   // e.g., "MARK_PUBLISHED", "ATTENDANCE_MARKED"
  entityType String   // e.g., "Mark", "Attendance", "Announcement"
  entityId   String?  // The ID of the modified entity
  details    String?  // JSON string of contextual changes
  actorId    String
  actor      User     @relation(fields: [actorId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
}
```

## 2. Events to Capture
We will instrument the following critical mutations using Prisma transactions (`$transaction`) to ensure atomicity (i.e. the log is only written if the primary mutation succeeds).

1. **Mark Updates (`upsertMark`)**
   - Action: `"MARK_UPSERTED"`
   - EntityType: `"Mark"`
   - Details: `"{ subjectId, score, status }"`
2. **Attendance Updates (`upsertAttendance`)**
   - Action: `"ATTENDANCE_UPSERTED"`
   - EntityType: `"Attendance"`
   - Details: `"{ classId, status, date }"`
3. **Promotions (`promoteStudents`)**
   - Action: `"STUDENTS_PROMOTED"`
   - EntityType: `"StudentEnrollment"`
   - Details: `"{ targetClassId, count }"`
4. **Finalization (`finalizeReport`)**
   - Action: `"RECORD_FINALIZED"`
   - EntityType: `"StudentAcademicRecord"`

## 3. Privacy & Security Rules
- **Never Log Passwords**: Hashes and plaintext credentials are never written to `details`.
- **Never Log Tokens**: Session JWTs are never logged.
- **RBAC**: `ActivityLog` entries are currently read-only at the database level and are only accessible by Admins (future Admin UI).

## 4. Retention Strategy
Because this table will grow rapidly (especially with daily attendance), the School IT Administrator must configure a cleanup job (e.g., a periodic script) to delete logs older than 365 days, or export them to a cold-storage CSV archive to preserve database performance.
