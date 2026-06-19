import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL
  const urlInfo = dbUrl
    ? `set (host: ${dbUrl.split('@')[1]?.split('/')[0] ?? 'unknown'})`
    : 'NOT SET'

  try {
    const count = await db.stockItem.count()
    return NextResponse.json({ ok: true, stockItemCount: count, dbUrl: urlInfo })
  } catch (err: unknown) {
    const e = err as Error & { code?: string; meta?: unknown }
    return NextResponse.json(
      { ok: false, error: e.message, code: e.code, meta: e.meta, dbUrl: urlInfo },
      { status: 500 }
    )
  }
}
