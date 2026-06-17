import { headers } from 'next/headers'

type Bucket = { count: number; resetAt: number }
const store = new Map<string, Bucket>()

// Prune entries older than 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, b] of store) if (now > b.resetAt) store.delete(key)
}, 60_000)

function check(key: string, max: number, windowMs: number): boolean {
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

export async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

// 10 attempts per 15 minutes per IP
export async function checkAuthRateLimit(action: string): Promise<boolean> {
  const ip = await getClientIp()
  return check(`${action}:${ip}`, 10, 15 * 60 * 1000)
}
