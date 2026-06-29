import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

type IncomingRow = {
  article: string
  name: string
  qty: number
  price: number | null
  existingId: number | null
  willCreate: boolean
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: { rows: IncomingRow[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = body.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  // Re-validate and separate into updates vs creates
  const updateRows = rows.filter(
    r => !r.willCreate && typeof r.existingId === 'number' && r.qty > 0
  )
  const createRows = rows.filter(
    r => r.willCreate && r.name?.trim() && r.qty > 0
  )

  const errors: string[] = []

  // ── Updates: increment stock ───────────────────────────────────────────────
  await Promise.all(
    updateRows.map(async row => {
      try {
        await db.stockItem.update({
          where: { id: row.existingId! },
          data: {
            stock: { increment: row.qty },
            ...(row.price != null && row.price > 0 ? { pricePerPc: row.price } : {}),
          },
        })
      } catch {
        errors.push(`Не удалось обновить: "${row.name}"`)
      }
    })
  )

  // ── Creates: new stock items ───────────────────────────────────────────────
  const createData = createRows.map(row => ({
    name:       row.name.trim(),
    article:    row.article?.trim() || null,
    stock:      row.qty,
    pricePerPc: row.price != null && row.price > 0 ? row.price : 0,
    images:     [] as string[],
  }))

  let created = 0
  if (createData.length > 0) {
    try {
      const result = await db.stockItem.createMany({
        data: createData,
        skipDuplicates: true, // skip if name already exists (race condition)
      })
      created = result.count
    } catch {
      errors.push('Ошибка при создании новых позиций')
    }
  }

  return NextResponse.json({
    updated: updateRows.length - errors.filter(e => e.includes('обновить')).length,
    created,
    errors,
  })
}
