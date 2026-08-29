import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SECRET_KEY!

// This client must ONLY be used on the server, as it uses the Service Role / Secret Key
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})

/**
 * Generate a unique storage path matching the required hierarchy.
 */
export function generateStoragePath(subjectId: string, chapterId: string, topicId: string, extension: string) {
  const cleanExt = extension.startsWith('.') ? extension.substring(1) : extension
  return `${subjectId}/${chapterId}/${topicId}/${uuidv4()}.${cleanExt}`
}

/**
 * Create a signed upload URL that the browser can use to directly PUT the file to Supabase.
 */
export async function createSignedUploadUrl(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(path)
    
  if (error) {
    throw new Error(`Failed to create upload URL: ${error.message}`)
  }
  
  return data
}

/**
 * Create a short-lived download URL for authorized students/teachers.
 */
export async function createSignedDownloadUrl(bucket: string, path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)
    
  if (error) {
    throw new Error(`Failed to create download URL: ${error.message}`)
  }
  
  return data.signedUrl
}

/**
 * Safely delete an orphaned or replaced file.
 */
export async function deleteStorageFile(bucket: string, path: string) {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path])
    
  if (error) {
    console.error(`Failed to delete storage file ${bucket}/${path}:`, error.message)
    // We don't necessarily throw here if it's a cleanup task, but we log it.
  }
}
