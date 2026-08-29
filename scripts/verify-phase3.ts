import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

async function main() {
  console.log("--- PHASE 3 VERIFICATION ---");
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  let allPassed = true;

  try {
    const counts: Record<string, any> = {};
    const tables = ["Student", "Class", "Teacher", "User", "Mark", "Attendance", "StudentAcademicRecord", "SchoolSettings", "AcademicSession", "StudentEnrollment"];
    for (const t of tables) {
      try {
        const res = await client.execute(`SELECT COUNT(*) as c FROM ${t}`);
        counts[t] = res.rows[0].c;
      } catch (e) {
        counts[t] = 0;
      }
    }
    console.table(counts);

    // Validate counts
    const expected = {
      Student: 10,
      Class: 2,
      Teacher: 3,
      User: 14,
      Mark: 30,
      Attendance: 5,
      StudentAcademicRecord: 1,
      SchoolSettings: 1,
      AcademicSession: 1,
      StudentEnrollment: 10
    };

    for (const [k, v] of Object.entries(expected)) {
      if (counts[k] !== v) {
        console.error(`Count mismatch for ${k}: expected ${v}, got ${counts[k]}`);
        allPassed = false;
      }
    }

    // Verify Mark has valid academicSessionId
    const marks = await client.execute("SELECT id FROM Mark WHERE academicSessionId IS NULL");
    if (marks.rows.length > 0) {
      console.error(`Found ${marks.rows.length} Marks with NULL academicSessionId`);
      allPassed = false;
    }

    // Verify Attendance has valid academicSessionId
    const att = await client.execute("SELECT id FROM Attendance WHERE academicSessionId IS NULL");
    if (att.rows.length > 0) {
      console.error(`Found ${att.rows.length} Attendance with NULL academicSessionId`);
      allPassed = false;
    }

    // Verify StudentAcademicRecord has valid academicSessionId and enrollmentId
    const sar = await client.execute("SELECT id FROM StudentAcademicRecord WHERE academicSessionId IS NULL OR enrollmentId IS NULL");
    if (sar.rows.length > 0) {
      console.error(`Found ${sar.rows.length} StudentAcademicRecord with NULL academicSessionId or enrollmentId`);
      allPassed = false;
    }

    // Verify original '2024-2025' is preserved through legacyAcademicSession or academicSession
    const sar2 = await client.execute("SELECT academicSession FROM StudentAcademicRecord");
    if (sar2.rows[0]?.academicSession !== '2024-2025') {
      console.error(`Original '2024-2025' value not preserved in StudentAcademicRecord`);
      allPassed = false;
    }

    if (allPassed) {
      console.log("ALL VERIFICATION CHECKS PASSED!");
      process.exit(0);
    } else {
      console.error("VERIFICATION FAILED!");
      process.exit(1);
    }

  } catch (error) {
    console.error("Verification Error:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
