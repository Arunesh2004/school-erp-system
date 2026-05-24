import { createClient } from "@libsql/client"
import * as fs from "fs"
import * as path from "path"
import "dotenv/config"

async function bootstrap() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  if (!url || !authToken) {
    console.error("❌ DATABASE_URL and DATABASE_AUTH_TOKEN must be set in .env")
    process.exit(1)
  }

  console.log(`Connecting to Turso: ${url}`)

  const client = createClient({
    url,
    authToken,
  })

  const sqlPath = path.join(process.cwd(), "prisma", "schema.sql")
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found at ${sqlPath}`)
    process.exit(1)
  }

  // PowerShell redirection > creates UTF-16LE encoded files by default on Windows
  let sql = fs.readFileSync(sqlPath, "utf16le")
  
  // If it wasn't utf16le (e.g. no BOM or null bytes), fallback to utf-8 just in case
  if (sql.indexOf('\0') === -1 && !sql.startsWith('\uFEFF')) {
     sql = fs.readFileSync(sqlPath, "utf-8")
  }

  console.log("Executing schema.sql on remote database...")
  
  try {
    const sqlStatements = sql
      .split(";")
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
      .map(stmt => {
        // Strip comments
        let cleaned = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        // Add IF NOT EXISTS to prevent errors if running multiple times
        cleaned = cleaned.replace(/^CREATE TABLE "([^"]+)"/i, 'CREATE TABLE IF NOT EXISTS "$1"');
        cleaned = cleaned.replace(/^CREATE UNIQUE INDEX "([^"]+)"/i, 'CREATE UNIQUE INDEX IF NOT EXISTS "$1"');
        cleaned = cleaned.replace(/^CREATE INDEX "([^"]+)"/i, 'CREATE INDEX IF NOT EXISTS "$1"');
        return cleaned;
      })
      .filter(stmt => stmt.length > 0);

    console.log(`Parsed ${sqlStatements.length} statements. Executing sequentially...`);
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const stmt = sqlStatements[i];
      try {
        await client.execute(stmt);
      } catch (err: any) {
        if (err.message && (err.message.includes("already exists") || err.message.includes("duplicate column"))) {
          console.log(`Statement ${i + 1} skipped: already exists.`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:\n${stmt}\n`, err);
          // Let's log the full error cause to see the HTTP response body if available
          if (err.cause) console.error("Cause:", err.cause);
          process.exit(1);
        }
      }
    }

    console.log("✅ Turso database schema initialized successfully.")
    
    // Verify by querying a table
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table';")
    console.log("Created tables:")
    result.rows.forEach(row => console.log(` - ${row.name}`))
    
  } catch (error) {
    console.error("❌ Failed to initialize remote database schema:", error)
    process.exit(1)
  }
}

bootstrap()
