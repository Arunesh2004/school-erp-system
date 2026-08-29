import { jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers"
import prisma from "@/lib/prisma"

const secretKey = process.env.JWT_SECRET
const key = new TextEncoder().encode(secretKey)

type SessionPayload = {
  userId: string
  role: string
  needsPasswordChange?: boolean
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key)
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ["HS256"],
    })
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(userId: string, role: string, needsPasswordChange: boolean = false) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, role, needsPasswordChange, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

export async function verifySession(allowPasswordChangeState: boolean = false) {
  let cookie = undefined
  const cookieStore = await cookies()
  cookie = cookieStore.get("session")?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    return null
  }

  // Live database validation (Option A implementation)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { mustChangePassword: true, role: true }
  })

  if (!user) {
    return null // User was deleted
  }

  // Strict Server-Side Enforcement (Phase B)
  // Blocks Server Actions and API routes from executing if a password change is required.
  if (user.mustChangePassword && !allowPasswordChangeState) {
    return null
  }

  return { 
    isAuth: true, 
    userId: session.userId, 
    role: user.role, // Use DB role for safety too
    needsPasswordChange: user.mustChangePassword 
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}
