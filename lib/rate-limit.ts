import { headers } from 'next/headers'

type Bucket = { count: number; resetAt: number }
const store = new Map<string, Bucket>()

// Prune entries older than 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, b] of store) if (now > b.resetAt) store.delete(key)
}, 60_000)

// Exported so proxy.ts (site-wide flood guard) can share the same in-memory
// store as the auth-specific limits below — Proxy defaults to the Node.js
// runtime in this Next version, so this module-level Map is the same
// instance across a proxy call and a Server Function call in one process.
export function check(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const existing = store.get(key)
  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= max) return false
  existing.count++
  return true
}

// Same x-forwarded-for precedence as before, split out so proxy.ts (which
// gets a NextRequest, not the request-scoped `headers()` API) can reuse it.
export function ipFromHeaders(h: Headers): string {
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

export async function getClientIp(): Promise<string> {
  return ipFromHeaders(await headers())
}

// 10 attempts per 15 minutes per IP, AND (when an account identifier like
// email is known) per account — so someone brute-forcing one account from
// many rotating IPs is still caught, not just a flood from a single IP.
export async function checkAuthRateLimit(action: string, identifier?: string): Promise<boolean> {
  const ip = await getClientIp()
  if (!check(`${action}:ip:${ip}`, 10, 15 * 60 * 1000)) return false
  if (identifier && !check(`${action}:acct:${identifier.toLowerCase()}`, 10, 15 * 60 * 1000)) return false
  return true
}
