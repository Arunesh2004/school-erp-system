import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

dotenv.config({ path: "./.env" });

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n--- PHASE 3 MIGRATION ---`);
  if (DRY_RUN) {
    console.log(`*** DRY RUN MODE (NO WRITES WILL BE EXECUTED) ***\n`);
  } else {
    console.log(`*** ACTIVE MODE (EXECUTING WRITES) ***\n`);
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    // 1. Export Backup and Row Counts (Always runs)
    console.log("1. Exporting Backup...");
    const backupData: any = {};
    const tablesToExport = ["Student", "Class", "Teacher", "User", "Mark", "Attendance", "StudentAcademicRecord", "SchoolSettings"];
    
    console.log("\n--- BEFORE-MIGRATION ROW COUNTS ---");
    for (const table of tablesToExport) {
      try {
        const res = await client.execute(`SELECT * FROM ${table}`);
        backupData[table] = res.rows;
        console.log(`${table}: ${res.rows.length}`);
      } catch(e) {
        console.log(`${table}: 0 (Table might not exist)`);
      }
    }
    
    const backupLocation = process.cwd() + "/backup-pre-phase3.json";
    fs.writeFileSync(backupLocation, JSON.stringify(backupData, null, 2));
    console.log(`\nBackup saved to: ${backupLocation}`);

    // 2. Schema Prep
    console.log("\n2. Schema Prep");
    const alterTables = [
      `ALTER TABLE StudentAcademicRecord ADD COLUMN academicSessionId TEXT`,
      `ALTER TABLE StudentAcademicRecord ADD COLUMN enrollmentId TEXT`,
      `ALTER TABLE Mark ADD COLUMN academicSessionId TEXT`,
      `ALTER TABLE Attendance ADD COLUMN academicSessionId TEXT`,
      `CREATE TABLE IF NOT EXISTS StudentEnrollment (
        id TEXT NOT NULL PRIMARY KEY,
        studentId TEXT NOT NULL,
        classId TEXT NOT NULL,
        academicSessionId TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL,
        CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "StudentEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "StudentEnrollment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "StudentEnrollment_studentId_academicSessionId_key" ON "StudentEnrollment"("studentId", "academicSessionId")`
    ];

    for (const sql of alterTables) {
      if (!DRY_RUN) {
        try {
          await client.execute(sql);
          console.log(`Executed: ${sql.split('ADD COLUMN')[0] || sql.substring(0,30)}... SUCCESS`);
        } catch (e: any) {
          if (!e.message.includes("duplicate column")) {
            console.log(`Skipped (likely already exists): ${sql.substring(0,30)}...`);
          }
        }
      } else {
        console.log(`[DRY RUN] Would execute: ${sql.split('(')[0]}`);
      }
    }

    // 3. Reconstruct Historical Session
    console.log("\n3. Reconstruct Historical Session");
    const sessions = await client.execute("SELECT id, name FROM AcademicSession WHERE name = '2024-2025'");
    let sessionId: string;
    if (sessions.rows.length === 0) {
      sessionId = crypto.randomUUID();
      if (!DRY_RUN) {
        await client.execute({
          sql: "INSERT INTO AcademicSession (id, name, startDate, endDate, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
          args: [sessionId, '2024-2025', new Date().getTime(), new Date().getTime(), 'ACTIVE', new Date().toISOString()]
        });
        
        await client.execute({
          sql: "UPDATE AcademicSession SET startDate = ?, endDate = ? WHERE id = ?",
          args: [new Date('2024-04-01T00:00:00.000Z').toISOString(), new Date('2025-03-31T00:00:00.000Z').toISOString(), sessionId]
        });
        console.log(`Created AcademicSession '2024-2025' with ID: ${sessionId}`);
        
        // Note: Intentionally NOT updating SchoolSettings.activeSessionId here 
        // to preserve current application state, per user instruction.
      } else {
        console.log(`[DRY RUN] Would create AcademicSession '2024-2025' (SchoolSettings untouched)`);
        sessionId = "dry-run-session-id";
      }
    } else {
      sessionId = sessions.rows[0].id as string;
      console.log(`AcademicSession '2024-2025' already exists with ID: ${sessionId}`);
    }

    // 4. Backfill Student Enrollments
    console.log("\n4. Backfill Student Enrollments");
    const students = await client.execute("SELECT id, classId FROM Student WHERE classId IS NOT NULL");
    let enrollmentCreated = 0;
    for (const student of students.rows) {
      if (!DRY_RUN) {
        const existing = await client.execute({
          sql: "SELECT id FROM StudentEnrollment WHERE studentId = ? AND academicSessionId = ?",
          args: [student.id, sessionId]
        });
        if (existing.rows.length === 0) {
          const enrollId = crypto.randomUUID();
          await client.execute({
            sql: "INSERT INTO StudentEnrollment (id, studentId, classId, academicSessionId, updatedAt) VALUES (?, ?, ?, ?, ?)",
            args: [enrollId, student.id, student.classId, sessionId, new Date().toISOString()]
          });
          enrollmentCreated++;
        }
      } else {
        enrollmentCreated++;
      }
    }
    console.log(DRY_RUN ? `[DRY RUN] Would create ${enrollmentCreated} StudentEnrollments` : `Created ${enrollmentCreated} StudentEnrollments`);

    // 5. Backfill Marks and Attendance
    console.log("\n5. Backfill Marks and Attendance");
    // Marks
    let marksToUpdate = 0;
    try {
      const markCols = await client.execute("PRAGMA table_info(Mark)");
      if (markCols.rows.some(c => c.name === 'academicSessionId')) {
        const marksRes = await client.execute("SELECT COUNT(*) as c FROM Mark WHERE academicSessionId IS NULL");
        marksToUpdate = marksRes.rows[0].c as number;
        if (!DRY_RUN && marksToUpdate > 0) {
          await client.execute({
            sql: "UPDATE Mark SET academicSessionId = ? WHERE academicSessionId IS NULL",
            args: [sessionId]
          });
          console.log(`Updated ${marksToUpdate} Marks with academicSessionId`);
        } else {
          console.log(DRY_RUN ? `[DRY RUN] Would update ${marksToUpdate} Marks with academicSessionId` : `Updated 0 Marks`);
        }
      } else {
        const marksRes = await client.execute("SELECT COUNT(*) as c FROM Mark");
        marksToUpdate = marksRes.rows[0].c as number;
        console.log(DRY_RUN ? `[DRY RUN] Would update ${marksToUpdate} Marks with academicSessionId` : `Updated 0 Marks (Column missing)`);
      }
    } catch(e) {
      console.log("Mark table error.");
    }

    // Attendance
    let attToUpdate = 0;
    try {
      const attCols = await client.execute("PRAGMA table_info(Attendance)");
      if (attCols.rows.some(c => c.name === 'academicSessionId')) {
        const attRes = await client.execute("SELECT COUNT(*) as c FROM Attendance WHERE academicSessionId IS NULL");
        attToUpdate = attRes.rows[0].c as number;
        if (!DRY_RUN && attToUpdate > 0) {
          await client.execute({
            sql: "UPDATE Attendance SET academicSessionId = ? WHERE academicSessionId IS NULL",
            args: [sessionId]
          });
          console.log(`Updated ${attToUpdate} Attendance records with academicSessionId`);
        } else {
          console.log(DRY_RUN ? `[DRY RUN] Would update ${attToUpdate} Attendance records with academicSessionId` : `Updated 0 Attendance records`);
        }
      } else {
        const attRes = await client.execute("SELECT COUNT(*) as c FROM Attendance");
        attToUpdate = attRes.rows[0].c as number;
        console.log(DRY_RUN ? `[DRY RUN] Would update ${attToUpdate} Attendance records with academicSessionId` : `Updated 0 Attendance records (Column missing)`);
      }
    } catch(e) {
       console.log("Attendance table error.");
    }

    // 6. Backfill Academic Records
    console.log("\n6. Backfill Academic Records");
    let sarToUpdate = 0;
    let sarToEnroll = 0;
    let unresolvedSar = 0;
    
    // Check if column exists
    const sarCols = await client.execute("PRAGMA table_info(StudentAcademicRecord)");
    if (sarCols.rows.some(c => c.name === 'academicSession')) {
      // If academicSessionId column exists, query it safely, otherwise just query old ones
      const hasSessionId = sarCols.rows.some(c => c.name === 'academicSessionId');
      const hasEnrollId = sarCols.rows.some(c => c.name === 'enrollmentId');
      
      const query = (hasSessionId && hasEnrollId) 
        ? "SELECT id, studentId, academicSession FROM StudentAcademicRecord WHERE academicSessionId IS NULL OR enrollmentId IS NULL"
        : "SELECT id, studentId, academicSession FROM StudentAcademicRecord";

      const records = await client.execute(query);
      
      for (const rec of records.rows) {
        let updateSession = false;
        let updateEnrollment = false;
        let enrollId = null;

        if (rec.academicSession === '2024-2025') {
          updateSession = true;
          sarToUpdate++;
          
          // Find enrollment
          if (!DRY_RUN) {
             const enr = await client.execute({
               sql: "SELECT id FROM StudentEnrollment WHERE studentId = ? AND academicSessionId = ?",
               args: [rec.studentId, sessionId]
             });
             if (enr.rows.length > 0) {
               enrollId = enr.rows[0].id;
               updateEnrollment = true;
               sarToEnroll++;
             } else {
               unresolvedSar++;
             }
          } else {
             updateEnrollment = true;
             sarToEnroll++;
          }
        } else {
          unresolvedSar++;
        }

        if (!DRY_RUN && hasSessionId && hasEnrollId) {
          if (updateSession && updateEnrollment) {
            await client.execute({
              sql: "UPDATE StudentAcademicRecord SET academicSessionId = ?, enrollmentId = ? WHERE id = ?",
              args: [sessionId, enrollId, rec.id]
            });
          } else if (updateSession) {
            await client.execute({
              sql: "UPDATE StudentAcademicRecord SET academicSessionId = ? WHERE id = ?",
              args: [sessionId, rec.id]
            });
          }
        }
      }
    } else {
       console.log("No string 'academicSession' column found. Records might already be fully processed.");
    }

    console.log(DRY_RUN ? `[DRY RUN] Would set academicSessionId on ${sarToUpdate} AcademicRecords` : `Set academicSessionId on ${sarToUpdate} AcademicRecords`);
    console.log(DRY_RUN ? `[DRY RUN] Would set enrollmentId on ${sarToEnroll} AcademicRecords` : `Set enrollmentId on ${sarToEnroll} AcademicRecords`);
    if (unresolvedSar > 0) {
      console.log(`[WARNING] Found ${unresolvedSar} AcademicRecords that could not be fully resolved.`);
    } else {
      console.log(`All AcademicRecords resolved successfully.`);
    }

    console.log("\n--- MIGRATION RUN COMPLETE ---\n");
  } catch (error) {
    console.error("Migration Error:", error);
  } finally {
    client.close();
  }
}

main();
