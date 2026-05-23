import { type NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'

const protectedRoutes = ['/admin', '/teacher', '/student']
const publicRoutes = ['/login']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route))

  const cookie = request.cookies.get('session')?.value
  const session = await verifySession(cookie)

  if (isProtectedRoute && !session?.isAuth) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  if (isPublicRoute && session?.isAuth && path === '/login') {
    // Redirect based on role if they try to access login while authenticated
    if (session.role === 'ADMIN') return NextResponse.redirect(new URL('/admin', request.nextUrl))
    if (session.role === 'TEACHER') return NextResponse.redirect(new URL('/teacher', request.nextUrl))
    if (session.role === 'STUDENT') return NextResponse.redirect(new URL('/student', request.nextUrl))
    return NextResponse.redirect(new URL('/', request.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
