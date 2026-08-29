import { createClient } from "@libsql/client"
import "dotenv/config"

async function run() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  })

  try {
    const res = await client.execute("SELECT email, role FROM User")
    console.log("Users:", res.rows)
  } catch (e: any) {
    console.error("Error executing query:", e.message)
  }
}
run()
