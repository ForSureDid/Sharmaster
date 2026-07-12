import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
