import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/session'
import prisma from '@/lib/prisma'

export default async function Home() {
  const session = await verifySession()

  if (!session?.userId) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true }
  })

  if (!dbUser) {
    redirect('/login')
  }

  if (dbUser.role === 'ADMIN') redirect('/admin')
  if (dbUser.role === 'TEACHER') redirect('/teacher')
  if (dbUser.role === 'STUDENT') redirect('/student')

  redirect('/login')
}
