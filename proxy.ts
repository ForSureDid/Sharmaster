// This is Next 16's renamed `middleware.ts`, defaults to the Node.js
// runtime — so `lib/rate-limit.ts`'s module-level Map is the same instance
// here as in the Server Functions it also guards (login/register).
//
// Two independent jobs:
// 1. Admin auth guard (original) — edge-checks the session JWT for
//    /admin and /api/admin before any handler runs.
// 2. Flood/brute-force guard (new) — app-layer rate limiting. NOT a
//    substitute for real DDoS mitigation: it only throttles what reaches
//    this Next.js process, one IP at a time. A genuine volumetric/
//    distributed attack has to be stopped upstream (Cloudflare, or rate
//    limiting in the reverse proxy in front of this container) — see
//    node_modules/next/dist/docs/01-app/02-guides/self-hosting.md's
//    "Reverse Proxy" section. This is a baseline app-level backstop on top
//    of that.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { check, ipFromHeaders } from '@/lib/rate-limit'

function getSecret(): Uint8Array {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET env var is not set')
  return new TextEncoder().encode(process.env.SESSION_SECRET)
}

async function isAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('sm_session')?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.role === 'admin'
  } catch {
    return false
  }
}

// 1C's own exchange client and the internal cache-revalidation webhook are
// both already gated by their own auth checks (Basic Auth / secret header).
// Never rate-limit them here — 1C can legitimately fire many chunked
// requests in a row during a catalog sync, and blocking it breaks the real
// business flow (see project_onec_exchange memory), which is worse than the
// abuse this file defends against.
const RATE_LIMIT_EXEMPT_PREFIXES = ['/api/1c-exchange', '/api/revalidate']

// Cheap-to-spam, costly-to-us POST endpoints: login/register (credential
// stuffing / brute force — see the per-account limit in app/auth/actions.ts,
// this is a second, cheaper layer in front of it) and public unauthenticated
// write endpoints (feedback/review/like spam).
const STRICT_POST_PREFIXES = ['/login', '/register', '/api/feedback', '/api/reviews', '/api/likes']

function tooManyRequests(): NextResponse {
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: { 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (!RATE_LIMIT_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    const ip = ipFromHeaders(request.headers)

    // Site-wide flood guard: generous enough for one real visitor's normal
    // browsing (page loads pull in several RSC/data fetches each), tight
    // enough to blunt a single IP hammering the app.
    if (!check(`flood:${ip}`, 300, 60_000)) return tooManyRequests()

    if (request.method === 'POST' && STRICT_POST_PREFIXES.some((p) => pathname.startsWith(p))) {
      if (!check(`strict:${ip}:${pathname}`, 20, 60_000)) return tooManyRequests()
    }
  }

  // Guard the admin JSON API at the edge. Each handler still re-checks the
  // DB-backed session (see lib/session), so this is defense-in-depth: it stops
  // unauthorized requests before they reach any handler, and returns a proper
  // 401 instead of an HTML redirect an API client can't follow.
  if (pathname.startsWith('/api/admin')) {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Guard the admin pages — redirect humans to login / home.
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('sm_session')?.value
    if (!token) return NextResponse.redirect(new URL('/login', request.url))
    if (!(await isAdmin(request))) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
