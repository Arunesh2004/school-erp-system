import { jwtVerify, SignJWT } from "jose"

const secretKey = process.env.JWT_SECRET
const key = new TextEncoder().encode(secretKey)

export type SessionPayload = {
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
