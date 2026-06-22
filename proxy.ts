import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret(): Uint8Array {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET env var is not set')
  return new TextEncoder().encode(process.env.SESSION_SECRET)
}

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const token = request.cookies.get('sm_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
