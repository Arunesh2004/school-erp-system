import { createClient } from "@libsql/client"
import "dotenv/config"

async function testConnection() {
  console.log("=== Turso Connection Verification ===")
  console.log("Loading environment variables from process.env...")

  // STRICTLY load from process.env ONLY.
  // NO fallbacks, NO defaults, NO hardcoded values.
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  console.log(`- DATABASE_URL loaded: ${url ? "YES" : "NO"}`)
  console.log(`- DATABASE_AUTH_TOKEN loaded: ${authToken ? "YES" : "NO"}`)
  
  if (!url || !authToken) {
    console.error("\n❌ CONFIGURATION ERROR: DATABASE_URL and DATABASE_AUTH_TOKEN must be strictly defined in the environment.")
    process.exit(1)
  }

  // Print first 12 characters safely
  console.log(`- Token Preview: ${authToken.substring(0, 12)}...`)

  // Explicit validation against stale placeholders
  const upperToken = authToken.toUpperCase()
  if (upperToken.includes("PASTE") || upperToken.includes("EXISTING") || upperToken.includes("TOKEN")) {
    console.error("\n❌ CONFIGURATION ERROR: Stale placeholder token detected!")
    console.error("The DATABASE_AUTH_TOKEN in your environment is still set to a dummy/placeholder string.")
    console.error("Please update your .env file with the real Turso JWT token.")
    process.exit(1)
  }

  console.log("-------------------------------------")

  try {
    const client = createClient({
      url,
      authToken,
    })

    console.log("Initiating connection test (SELECT 1)...")
    
    const startTime = Date.now()
    const result = await client.execute("SELECT 1 AS status")
    const latency = Date.now() - startTime

    if (result.rows && result.rows.length > 0 && result.rows[0].status === 1) {
      console.log(`✅ SUCCESS: Successfully connected to Turso database! (Latency: ${latency}ms)`)
      console.log("The connection URL and Auth Token are perfectly valid.")
    } else {
      console.warn("⚠️ WARNING: Query executed but returned unexpected results:", result.rows)
    }
  } catch (error: any) {
    console.error("❌ FAILED: Could not connect to Turso database.\n")
    console.error("Diagnostics:")
    
    if (error.message) {
      console.error(`- Error Message: ${error.message}`)
    }
    
    if (error.cause) {
      console.error(`- Error Cause: ${error.cause}`)
      if (error.cause.status === 400) {
        console.error("  -> HINT: HTTP 400 often means the Auth Token is improperly formatted (e.g., not a valid JWT) or the URL is malformed.")
      } else if (error.cause.status === 401) {
        console.error("  -> HINT: HTTP 401 means Unauthorized. Your Auth Token is either expired, revoked, or incorrect.")
      } else if (error.cause.status === 404) {
         console.error("  -> HINT: HTTP 404 means Not Found. Please check that your database URL is exactly correct.")
      }
    } else if (error.code) {
      console.error(`- Error Code: ${error.code}`)
      if (error.code === 'URL_INVALID') {
        console.error("  -> HINT: The DATABASE_URL is not a valid format.")
      }
    }
    
    console.error("\nFull Error Trace:")
    console.error(error)
    process.exit(1)
  }
}

testConnection()
