import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add Cache-Control no-store headers to all protected routes
  // This prevents the browser's Back/Forward Cache (BFCache) from storing 
  // sensitive pages and displaying them after logout when the user clicks Back.
  const path = request.nextUrl.pathname
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
