// 1С Розница "Обмен данными с сайтом" (CommerceML 2) exchange endpoint.
//
// type=catalog: 1C pushes products + prices/stock into the isolated
// OnecStockItem/SyncLog tables — nothing storefront-facing is touched.
// type=sale: 1C pulls site orders (mode=query returns CommerceML XML built
// from Order/OrderItem, mode=success confirms receipt); the reverse sale file
// 1C POSTs back (its own numbers/statuses) is stored + logged but not applied.
//
// 1C authenticates every request with HTTP Basic Auth and always expects a
// plain-text "success" / "failure\n<message>" body — never an HTTP error page,
// since its exchange client parses the body text, not the status code.

import { NextRequest } from 'next/server'
import { checkOnecAuth, onecUnauthorizedResponse } from '@/lib/onecAuth'
import { appendOnecFile, clearOnecFiles, downloadOnecFile } from '@/lib/onecStorage'
import { parseImportXml, applyImportXml, parseOffersXml, applyOffersXml, upsertOnecCategories } from '@/lib/onecImport'
import { buildSaleQueryXml, confirmSaleExport } from '@/lib/onecOrders'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
// Real 1C catalogs run into the thousands of rows — give the import step room
// even though the bulk-SQL upserts in lib/onecImport are already fast.
export const maxDuration = 300

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

    if (type !== 'catalog' && type !== 'sale') return textResponse('failure\nunsupported type')

    if (mode === 'checkauth') return textResponse('success\nsm_1c_session\nok')
    if (mode === 'init') {
      // Vercel enforces a hard ~4.5MB request body limit at the platform level
      // (rejected before our function even runs) — well under what a real 1C
      // catalog export needs, so we report a conservative limit here to make
      // 1C split larger files into multiple "file" POSTs instead.
      if (type === 'catalog') await clearOnecFiles()
      return textResponse('zip=no\nfile_limit=3000000')
    }

    if (type === 'sale') {
      if (mode === 'query') return await handleSaleQuery()
      if (mode === 'success') {
        const confirmed = await confirmSaleExport()
        if (confirmed > 0) {
          await db.syncLog
            .create({ data: { source: '1c-sale', status: 'success', updated: confirmed } })
            .catch(() => {})
        }
        return textResponse('success')
      }
      return textResponse('failure\nunknown mode')
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

    if ((type !== 'catalog' && type !== 'sale') || mode !== 'file' || !filename) {
      return textResponse('failure\nbad request')
    }

    // Raw bytes, not req.text() — the XML may be windows-1251, and decoding
    // happens later in lib/onecImport once we've sniffed the real encoding.
    const bytes = new Uint8Array(await req.arrayBuffer())

    if (type === 'sale') {
      // 1C mirrors orders back (its document numbers / statuses). We don't
      // apply that to Order yet — keep the file for debugging and log receipt,
      // and answer success so the exchange cycle completes cleanly.
      await appendOnecFile(`sale_${filename}`, bytes)
      await db.syncLog
        .create({
          data: { source: '1c-sale-in', status: 'success', message: `received ${filename} (${bytes.length} bytes)` },
        })
        .catch(() => {})
      return textResponse('success')
    }

    await appendOnecFile(filename, bytes)
    return textResponse('success')
  } catch (e) {
    return textResponse(`failure\n${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleSaleQuery(): Promise<Response> {
  try {
    const { xml, orderCount, unmatchedItems } = await buildSaleQueryXml()

    if (orderCount > 0) {
      await db.syncLog
        .create({
          data: {
            source: '1c-sale',
            status: 'success',
            skipped: unmatchedItems.length,
            message: unmatchedItems.length
              ? `queued ${orderCount}; не найдены в 1С: ${unmatchedItems.slice(0, 20).join('; ')}`
              : `queued ${orderCount}`,
          },
        })
        .catch(() => {})
    }

    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db.syncLog.create({ data: { source: '1c-sale', status: 'failure', message } }).catch(() => {})
    return textResponse(`failure\n${message}`)
  }
}

async function handleImport(filename: string): Promise<Response> {
  const source = /offers/i.test(filename) ? '1c-offers' : '1c-catalog'

  try {
    const bytes = await downloadOnecFile(filename)

    if (/import.*\.xml$/i.test(filename)) {
      const { products, groups } = parseImportXml(bytes)
      const categoryIdByOnecId = await upsertOnecCategories(groups)
      const { created, updated, errors } = await applyImportXml(products, categoryIdByOnecId)
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
