# Final School Handover Checklist

## BEFORE GO-LIVE
- [ ] **Production URL Verified:** Ensure domain points to production Vercel instance.
- [ ] **Database Connection:** Verified that `DATABASE_URL` connects to `school-erp-prod` (Turso).
- [ ] **Backup Verification:** Confirmed that Turso automated backups are enabled and running daily.
- [ ] **Admin Accounts:** Created the initial 2 Admin accounts with strong, non-default passwords.
- [ ] **Default Password Policy:** Tested that users logging in with `Student@12345` or `Teacher@12345` are forced to change their passwords immediately before accessing dashboards.
- [ ] **School Settings:** Configured real School Name, Address, and Contact Number in Admin -> Settings.
- [ ] **Initial Academic Sessions:** Created `2025-2026` (Active) and `2024-2025` (Archived) sessions.

## FIRST DAY PROTOCOL
- [ ] **Admin Login Check:** Ensure both admins can log in and see identical active sessions.
- [ ] **Teacher Login Check:** Verify a class teacher sees only their assigned class, and a subject teacher sees only their subjects.
- [ ] **Mark Entry Test:** Have one teacher enter a mark and confirm it saves successfully.
- [ ] **Attendance Test:** Have one class teacher enter attendance for the day.
- [ ] **Mobile Device Check:** Open the site on a physical smartphone (375px) to verify table horizontal scrolling works.

## ONGOING OPERATIONS
- [ ] **Session Management:** Admins must NOT switch the active session during school hours unless absolutely necessary, to prevent stale-session rejections for active teachers.
- [ ] **Student Withdrawal:** To archive/withdraw a student, Admin must set their `classId = null` (remove them from the active class roster). DO NOT DELETE THE STUDENT, as it will cascade-delete historical academic records.
- [ ] **Staff Offboarding:** Reassign the leaving teacher's subjects and classes to a new teacher. Do not delete the old teacher account if you wish to preserve their historical `ActivityLog` trail.

## EMERGENCY PROTOCOLS
- [ ] **Wrong Promotion:** If a student is promoted incorrectly, the Admin must manually delete the *new* `StudentEnrollment` for the target session and re-run the promotion.
- [ ] **Accidental Data Loss:** Follow the `PRODUCTION_BACKUP_RESTORE_RUNBOOK.md` to spin up a recovery DB from a snapshot.
- [ ] **Compromised Account:** Admin must immediately reset the user's password hash in the database or disable the account.
