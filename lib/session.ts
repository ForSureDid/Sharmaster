import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET env var is not set')
const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET)
const COOKIE = 'sm_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export type SessionPayload = {
  userId: number
  name: string
  email: string
  phone: string | null
}

type TokenClaims = SessionPayload & { jti: string }

async function signToken(payload: SessionPayload, jti: string): Promise<string> {
  return new SignJWT({ ...payload, jti } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

// The JWT signature alone can't be revoked before it expires, so every read
// re-checks the Session row server-side — deleting that row (on logout) is
// what actually invalidates the token immediately.
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null

  let claims: TokenClaims
  try {
    const { payload } = await jwtVerify(token, SECRET)
    claims = payload as unknown as TokenClaims
  } catch {
    return null
  }

  const session = await db.session.findUnique({ where: { id: claims.jti } })
  if (!session || session.expiresAt < new Date()) return null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { jti, ...payload } = claims
  return payload
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  // Lazily sweep expired sessions instead of running a cron job
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  await db.session.create({ data: { id: jti, userId: payload.userId, expiresAt } })

  const token = await signToken(payload, jti)
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET)
      const { jti } = payload as unknown as TokenClaims
      await db.session.delete({ where: { id: jti } })
    } catch {
      // token missing/invalid/already revoked — nothing left to clean up
    }
  }
  jar.delete(COOKIE)
}
