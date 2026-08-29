import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'

const url = process.env.DATABASE_URL
const authToken = process.env.DATABASE_AUTH_TOKEN

if (!url) {
  throw new Error("DATABASE_URL is not set")
}

  const client = createClient({
    url: url!,
    authToken: authToken || undefined,
  })

async function main() {
  console.log(`Connecting to ${url!.includes('file:') ? 'local SQLite' : 'Turso'}...`)
  
  const sqlFile = path.join(process.cwd(), 'docs', 'notes_migration.sql')
  const sql = fs.readFileSync(sqlFile, 'utf8')
  
  // Split by statements (super basic parsing for our controlled script)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    
  console.log(`Executing ${statements.length} additive statements...`)
  
  const tx = await client.transaction("write")
  try {
    for (const stmt of statements) {
      console.log(`Executing: ${stmt.substring(0, 50)}...`)
      await tx.execute(stmt)
    }
    await tx.commit()
    console.log("Migration applied successfully!")
  } catch (error) {
    console.error("Migration failed, rolling back...", error)
    await tx.rollback()
    throw error
  }
}

main().catch(console.error)
