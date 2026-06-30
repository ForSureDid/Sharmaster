import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const PERIOD_LABELS: Record<string, string> = {
  week:  'Неделя',
  month: 'Месяц',
  all:   'Всё время',
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const period = new URL(req.url).searchParams.get('period') ?? 'week'
  if (!['week', 'month', 'all'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const now = new Date()
  let startDate: Date | undefined
  if (period === 'week')  startDate = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  if (period === 'month') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // All items currently on sale
  const saleItems = await db.stockItem.findMany({
    where: { onSale: true },
    select: {
      id: true, name: true, article: true, brand: true,
      pricePerPc: true, salePercent: true, stock: true,
    },
    orderBy: { name: 'asc' },
  })

  if (saleItems.length === 0) {
    return NextResponse.json({ error: 'Нет товаров на акции' }, { status: 400 })
  }

  // Orders in the period (non-cancelled)
  const orders = await db.order.findMany({
    where: {
      status: { not: 'Отменён' },
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
    },
    include: { items: { select: { stockItemId: true, qty: true, price: true } } },
  })

  // Sold map: stockItemId → { qty, revenue }
  const saleIds = new Set(saleItems.map(i => i.id))
  const soldMap = new Map<number, { qty: number; revenue: number }>()
  for (const order of orders) {
    for (const oi of order.items) {
      if (!oi.stockItemId || !saleIds.has(oi.stockItemId)) continue
      const cur = soldMap.get(oi.stockItemId) ?? { qty: 0, revenue: 0 }
      cur.qty     += oi.qty
      cur.revenue += Number(oi.price) * oi.qty
      soldMap.set(oi.stockItemId, cur)
    }
  }

  // Build workbook
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Акции')

  // Column widths
  ws.columns = [
    { width: 4 },
    { width: 30 }, // Название
    { width: 14 }, // Артикул
    { width: 14 }, // Бренд
    { width: 10 }, // Скидка %
    { width: 14 }, // Цена без скидки
    { width: 14 }, // Цена со скидкой
    { width: 10 }, // Остаток
    { width: 12 }, // Продано шт
    { width: 18 }, // Выручка ₸
  ]

  const PURPLE = 'FF7C3AED'
  const PURPLE_LIGHT = 'FFF5F3FF'
  const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE } }
  const ALT_FILL:    ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE_LIGHT } }

  // Title
  const titleLabel = period === 'all'
    ? 'Отчёт по акциям — всё время'
    : `Отчёт по акциям — ${PERIOD_LABELS[period].toLowerCase()}`
  ws.mergeCells('A1:J1')
  const titleCell = ws.getCell('A1')
  titleCell.value = titleLabel
  titleCell.font  = { bold: true, size: 14, color: { argb: PURPLE } }
  titleCell.alignment = { horizontal: 'center' }

  ws.mergeCells('A2:J2')
  ws.getCell('A2').value = `Дата: ${now.toLocaleDateString('ru-RU')}`
  ws.getCell('A2').font  = { color: { argb: 'FF9CA3AF' }, size: 10 }
  ws.getCell('A2').alignment = { horizontal: 'center' }

  ws.addRow([])

  // Header row
  const headers = ['№', 'Название', 'Артикул', 'Бренд', 'Скидка', 'Цена', 'Цена со скидкой', 'Остаток', 'Продано, шт', 'Выручка, ₸']
  const headerRow = ws.addRow(headers)
  headerRow.eachCell(cell => {
    cell.fill      = HEADER_FILL
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = { bottom: { style: 'thin', color: { argb: PURPLE } } }
  })
  headerRow.height = 24

  // Data rows, sorted by total sold desc
  const rows = saleItems.map(item => {
    const sold    = soldMap.get(item.id) ?? { qty: 0, revenue: 0 }
    const price   = Number(item.pricePerPc)
    const pct     = item.salePercent ?? 0
    const salePr  = Math.round(price * (1 - pct / 100))
    return { item, sold, price, pct, salePr }
  }).sort((a, b) => b.sold.qty - a.sold.qty)

  rows.forEach(({ item, sold, price, pct, salePr }, i) => {
    const row = ws.addRow([
      i + 1,
      item.name,
      item.article ?? '—',
      item.brand   ?? '—',
      pct ? `${pct}%` : '—',
      price,
      salePr,
      item.stock,
      sold.qty,
      Math.round(sold.revenue),
    ])
    if (i % 2 === 1) {
      row.eachCell(cell => { cell.fill = ALT_FILL })
    }
    row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } } // red discount
    row.getCell(6).numFmt = '#,##0'
    row.getCell(7).numFmt = '#,##0'
    row.getCell(10).numFmt = '#,##0'
  })

  // Total row
  ws.addRow([])
  const totalQty     = rows.reduce((s, r) => s + r.sold.qty, 0)
  const totalRevenue = rows.reduce((s, r) => s + r.sold.revenue, 0)
  const totalRow = ws.addRow(['', 'ИТОГО', '', '', '', '', '', '', totalQty, Math.round(totalRevenue)])
  totalRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: PURPLE } }
  })

  const buf = await wb.xlsx.writeBuffer()
  const filename = `aktsii_${period}_${now.toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
