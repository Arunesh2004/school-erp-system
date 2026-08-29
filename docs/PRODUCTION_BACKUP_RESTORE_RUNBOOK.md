# Production Backup & Restore Runbook

## Overview
This runbook outlines the operational procedures for backing up and restoring the production Turso (libsql) database for the School ERP. 

**WARNING: NEVER execute restore procedures directly against the live production database URL without first creating a safety snapshot.**

## 1. Backup Strategy (Turso)
Turso offers automated point-in-time recovery and snapshot capabilities.
- **Frequency:** Automated backups should be configured for every 24 hours.
- **Responsibility:** School IT Administrator / Database Administrator.
- **Verification:** The admin must verify the existence of snapshots via the Turso CLI or Dashboard at least weekly.

## 2. Creating a Manual Snapshot
Before any major administrative action (e.g., end-of-year promotion, deleting a teacher, bulk importing data), manually trigger a backup.

```bash
# Using Turso CLI
turso db backup create school-erp-prod
```

## 3. Identifying the Correct Database
Ensure you are operating on the correct environment.
- **Production DB:** `school-erp-prod`
- **Staging DB:** `school-erp-staging`
Never run destructive commands without verifying the current DB context (`turso db show school-erp-prod`).

## 4. Emergency Restore Procedure
If the production database is compromised or data is accidentally destroyed:

1. **Do NOT overwrite the active database immediately.**
2. **Create a recovery database** from the last known good snapshot:
   ```bash
   turso db create school-erp-recovery --from-db school-erp-prod --timestamp "2026-08-25T12:00:00Z"
   ```
3. **Verify the recovery database:**
   Point a local staging instance (or read-only script) to the `school-erp-recovery` URL and verify row counts.
   - Check `StudentEnrollment` counts.
   - Check `Mark` and `Attendance` counts.
4. **Swap Connection Strings:**
   Update the Vercel/Node.js production environment variables to point to the new recovery database URL and Auth Token.
   ```
   DATABASE_URL=libsql://school-erp-recovery-[org].turso.io
   DATABASE_AUTH_TOKEN=[new_token]
   ```
5. **Redeploy / Restart:** Restart the application to pick up the new connection string.
6. **Post-Recovery Integrity Check:** Run the `phase10-final-integrity.ts` script against production to ensure zero orphans.

## 5. Security Rules
- **NEVER** expose the `DATABASE_URL` or `DATABASE_AUTH_TOKEN` in client-side code.
- **NEVER** commit backup files (e.g., `.sqlite` or `.json` dumps) to Git. The `.gitignore` must always contain `*.sqlite`, `*.db`, and `backup-*.json`.
