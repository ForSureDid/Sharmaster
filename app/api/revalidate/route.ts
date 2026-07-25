// On-demand cache invalidation for external writers (donballon novelties
// sync and similar scripts that write to the DB directly, bypassing the
// server actions that normally call updateTag('stockItems')).
//
// POST /api/revalidate with header `x-revalidate-secret: $REVALIDATE_SECRET`.

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  revalidateTag('stockItems', 'max')
  revalidateTag('onecStockItems', 'max')
  revalidatePath('/')
  revalidatePath('/novinka')

  return NextResponse.json({ ok: true, revalidated: ['stockItems', 'onecStockItems', '/', '/novinka'] })
}
