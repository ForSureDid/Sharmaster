import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') === 'month' ? 'month' : 'week'

  const now = new Date()
  const periodStart = new Date(now)
  periodStart.setDate(periodStart.getDate() - (period === 'week' ? 7 : 30))
  periodStart.setHours(0, 0, 0, 0)

  // Fetch all order items from non-cancelled orders in the period
  const orderItems = await db.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: periodStart },
        status: { not: 'Отменён' },
      },
    },
    select: { stockItemId: true, name: true, qty: true, price: true },
  })

  // Look up articles via stockItemId
  const stockItemIds = [
    ...new Set(orderItems.map(i => i.stockItemId).filter((id): id is number => id !== null)),
  ]
  const stockItems = await db.stockItem.findMany({
    where: { id: { in: stockItemIds } },
    select: { id: true, article: true },
  })
  const articleMap = new Map(stockItems.map(s => [s.id, s.article ?? '']))

  // Group by stockItemId (same product sold multiple times) or by name
  type Row = { article: string; name: string; qty: number; total: number }
  const grouped = new Map<string, Row>()

  for (const item of orderItems) {
    const key = item.stockItemId ? `sid:${item.stockItemId}` : `name:${item.name}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        article: item.stockItemId ? (articleMap.get(item.stockItemId) ?? '') : '',
        name: item.name,
        qty: 0,
        total: 0,
      })
    }
    const g = grouped.get(key)!
    g.qty += item.qty
    g.total += Number(item.price) * item.qty
  }

  const rows = [...grouped.values()].sort((a, b) => b.total - a.total)
  const grandQty   = rows.reduce((s, r) => s + r.qty, 0)
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  // ── Build workbook ──────────────────────────────────────────────────────────
  const wb    = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet(period === 'week' ? 'Продажи за неделю' : 'Продажи за месяц')

  sheet.columns = [
    { width: 6  }, // №
    { width: 18 }, // Артикул
    { width: 54 }, // Название
    { width: 14 }, // Кол-во
    { width: 18 }, // Сумма
  ]

  // Title
  sheet.mergeCells('A1:E1')
  Object.assign(sheet.getCell('A1'), {
    value: period === 'week' ? 'Продажи за неделю' : 'Продажи за месяц',
    font:      { bold: true, size: 14, color: { argb: 'FF1F4E79' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  sheet.getRow(1).height = 28

  // Date range
  sheet.mergeCells('A2:E2')
  Object.assign(sheet.getCell('A2'), {
    value:     `${periodStart.toLocaleDateString('ru-RU')} — ${now.toLocaleDateString('ru-RU')}`,
    font:      { size: 11, color: { argb: 'FF595959' } },
    alignment: { horizontal: 'center' },
  })
  sheet.getRow(2).height = 20

  sheet.addRow([]) // spacer

  // Header row
  const hdrRow = sheet.addRow(['№', 'Артикул', 'Название', 'Кол-во, шт', 'Сумма, ₸'])
  hdrRow.height = 22
  hdrRow.eachCell(cell => {
    cell.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top: { style: 'thin', color: { argb: 'FF2E5FAA' } },
      bottom: { style: 'thin', color: { argb: 'FF2E5FAA' } },
      left: { style: 'thin', color: { argb: 'FF2E5FAA' } },
      right: { style: 'thin', color: { argb: 'FF2E5FAA' } },
    }
  })

  // Data rows
  const border = {
    top: { style: 'thin' as const, color: { argb: 'FFBDD7EE' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFBDD7EE' } },
    left: { style: 'thin' as const, color: { argb: 'FFBDD7EE' } },
    right: { style: 'thin' as const, color: { argb: 'FFBDD7EE' } },
  }

  rows.forEach((row, idx) => {
    const r = sheet.addRow([idx + 1, row.article, row.name, row.qty, row.total])
    r.height = 18
    r.eachCell((cell, col) => {
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF3FB' } }
      }
      cell.border = border
      if (col === 1) cell.alignment = { horizontal: 'center' }
      if (col === 4) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0' }
      if (col === 5) { cell.alignment = { horizontal: 'right' };  cell.numFmt = '#,##0.00' }
    })
  })

  // Total row
  const totRow = sheet.addRow(['', '', 'ИТОГО', grandQty, grandTotal])
  totRow.height = 22
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    cell.border = {
      top:    { style: 'medium', color: { argb: 'FF4472C4' } },
      bottom: { style: 'medium', color: { argb: 'FF4472C4' } },
      left:   border.left,
      right:  border.right,
    }
    if (col === 3) cell.alignment = { horizontal: 'right' }
    if (col === 4) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0' }
    if (col === 5) { cell.alignment = { horizontal: 'right' };  cell.numFmt = '#,##0.00' }
  })

  const buffer   = await wb.xlsx.writeBuffer()
  const filename = period === 'week'
    ? `Продажи_неделя_${now.toISOString().slice(0, 10)}.xlsx`
    : `Продажи_месяц_${now.toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control':       'no-store',
    },
  })
}
