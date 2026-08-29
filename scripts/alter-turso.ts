import { createClient } from "@libsql/client"
import "dotenv/config"

async function run() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  })

  try {
    await client.execute(`DROP INDEX IF EXISTS "StudentEnrollment_studentId_academicSessionId_key"`);
    console.log("Dropped legacy unique index on StudentEnrollment");
  } catch (e: any) { console.log(e.message) }
}
run()
