import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth/session'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const path = request.nextUrl.pathname

  // Check session for forced password change
  const sessionCookie = request.cookies.get("session")?.value
  if (sessionCookie) {
    const payload = await decrypt(sessionCookie)
    if (payload?.needsPasswordChange) {
      return NextResponse.redirect(new URL("/change-password", request.url))
    }
  }

  // Add Cache-Control no-store headers to all protected routes
  // This prevents the browser's Back/Forward Cache (BFCache) from storing 
  // sensitive pages and displaying them after logout when the user clicks Back.
  if (path.startsWith('/admin') || path.startsWith('/teacher') || path.startsWith('/student')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
  ],
}
