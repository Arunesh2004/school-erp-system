import { createClient } from "@libsql/client"
import "dotenv/config"

async function run() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  })

  try {
    const res = await client.execute(`PRAGMA index_list(StudentEnrollment)`);
    console.log("Indexes on StudentEnrollment:");
    console.log(res.rows);
    for (const row of res.rows) {
      const info = await client.execute(`PRAGMA index_info('${row.name}')`);
      console.log(`Index ${row.name} columns:`, info.rows);
    }
  } catch (e: any) { console.log(e.message) }
}
run()
