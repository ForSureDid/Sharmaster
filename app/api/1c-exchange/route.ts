// 1С Розница "Обмен данными с сайтом" (CommerceML 2) exchange endpoint.
// Scope: type=catalog only (products + prices/stock). type=sale (orders) is
// intentionally unsupported — users/orders stay exclusively in Supabase.
//
// 1C authenticates every request with HTTP Basic Auth and always expects a
// plain-text "success" / "failure\n<message>" body — never an HTTP error page,
// since its exchange client parses the body text, not the status code.
//
// Writes land in the isolated OnecStockItem/SyncLog tables only — nothing
// storefront-facing is touched by this route.

import { NextRequest } from 'next/server'
import { checkOnecAuth, onecUnauthorizedResponse } from '@/lib/onecAuth'
import { appendOnecFile, clearOnecFiles, downloadOnecFile } from '@/lib/onecStorage'
import { parseImportXml, applyImportXml, parseOffersXml, applyOffersXml } from '@/lib/onecImport'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  try {
    if (!checkOnecAuth(req)) return onecUnauthorizedResponse()

    const sp = req.nextUrl.searchParams
    const type = sp.get('type')
    const mode = sp.get('mode')
    const filename = sp.get('filename')

    if (type !== 'catalog') return textResponse('failure\nunsupported type')

    if (mode === 'checkauth') return textResponse('success\nsm_1c_session\nok')
    if (mode === 'init') {
      // Vercel enforces a hard ~4.5MB request body limit at the platform level
      // (rejected before our function even runs) — well under what a real 1C
      // catalog export needs, so we report a conservative limit here to make
      // 1C split larger files into multiple "file" POSTs instead.
      await clearOnecFiles()
      return textResponse('zip=no\nfile_limit=3000000')
    }
    if (mode === 'import') {
      if (!filename) return textResponse('failure\nmissing filename')
      return await handleImport(filename)
    }

    return textResponse('failure\nunknown mode')
  } catch (e) {
    return textResponse(`failure\n${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOnecAuth(req)) return onecUnauthorizedResponse()

    const sp = req.nextUrl.searchParams
    const type = sp.get('type')
    const mode = sp.get('mode')
    const filename = sp.get('filename')

    if (type !== 'catalog' || mode !== 'file' || !filename) {
      return textResponse('failure\nbad request')
    }

    // Raw bytes, not req.text() — the XML may be windows-1251, and decoding
    // happens later in lib/onecImport once we've sniffed the real encoding.
    const bytes = new Uint8Array(await req.arrayBuffer())
    await appendOnecFile(filename, bytes)
    return textResponse('success')
  } catch (e) {
    return textResponse(`failure\n${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleImport(filename: string): Promise<Response> {
  const source = /offers/i.test(filename) ? '1c-offers' : '1c-catalog'

  try {
    const bytes = await downloadOnecFile(filename)

    if (/import.*\.xml$/i.test(filename)) {
      const products = parseImportXml(bytes)
      const { created, updated, errors } = await applyImportXml(products)
      await db.syncLog.create({
        data: {
          source: '1c-catalog',
          status: 'success',
          created,
          updated,
          message: errors.length ? errors.slice(0, 20).join('; ') : null,
        },
      })
      return textResponse('success')
    }

    if (/offers.*\.xml$/i.test(filename)) {
      const offers = parseOffersXml(bytes)
      const { updated, skipped, errors } = await applyOffersXml(offers)
      await db.syncLog.create({
        data: {
          source: '1c-offers',
          status: 'success',
          updated,
          skipped,
          message: errors.length ? errors.slice(0, 20).join('; ') : null,
        },
      })
      return textResponse('success')
    }

    return textResponse('failure\nunknown filename')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db.syncLog.create({ data: { source, status: 'failure', message } }).catch(() => {})
    return textResponse(`failure\n${message}`)
  }
}
