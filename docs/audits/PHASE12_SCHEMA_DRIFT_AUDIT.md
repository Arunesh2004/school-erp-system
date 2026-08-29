# PHASE 12: SCHEMA DRIFT AUDIT

This document records the state of schema drift between the local `schema.prisma` and the remote Turso production database.

## 1. Historical Context
In Phase 11, a significant legacy drift was discovered and remediated:
- **Drifted Entity:** `StudentEnrollment_studentId_academicSessionId_key` index existed remotely but was removed from `schema.prisma`.
- **Root Cause:** Use of `npx prisma db push` during early prototyping bypassed the migration history.
- **Remediation:** The index was manually dropped on Turso to align the remote schema with the Prisma source of truth, enabling the historical transfer feature.

## 2. Current Remote Schema Status
Because the remote Turso DB (`libsql://`) cannot be directly introspected by `prisma db pull` without the Driver Adapters configured in a Node script, the drift audit will be evaluated dynamically during Phase 3 invariant scanning.

**If the dynamic invariant scanner (Phase 3) executes successfully against all models without schema-related SQLite errors, we will classify the schema alignment as: `Expected Drift: Minimal/Safe`.**

## 3. Strict Rule (Phase 12)
As requested:
- No `DROP INDEX` commands will be run.
- No `prisma db push` commands will be run.
- No migrations will be executed during static auditing.

Any discovered drift will be strictly documented here as an observation.
