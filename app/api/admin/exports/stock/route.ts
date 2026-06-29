import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const items = await db.stockItem.findMany({
    orderBy: { name: 'asc' },
    select: {
      article: true,
      name: true,
      brand: true,
      stock: true,
      pricePerPc: true,
    },
  })

  const now = new Date()

  // ── Build workbook ──────────────────────────────────────────────────────────
  const wb    = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Остатки склада')

  sheet.columns = [
    { width: 6  }, // №
    { width: 18 }, // Артикул
    { width: 54 }, // Название
    { width: 16 }, // Бренд
    { width: 13 }, // Остаток
    { width: 17 }, // Цена
    { width: 20 }, // Сумма на складе
  ]

  // Title
  sheet.mergeCells('A1:G1')
  Object.assign(sheet.getCell('A1'), {
    value: 'Оперативные остатки магазина',
    font:      { bold: true, size: 14, color: { argb: 'FF1F4E79' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  sheet.getRow(1).height = 28

  // Date
  sheet.mergeCells('A2:G2')
  Object.assign(sheet.getCell('A2'), {
    value: `По состоянию на ${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    font:      { size: 11, color: { argb: 'FF595959' } },
    alignment: { horizontal: 'center' },
  })
  sheet.getRow(2).height = 20

  sheet.addRow([]) // spacer

  // Header row
  const hdrRow = sheet.addRow(['№', 'Артикул', 'Название', 'Бренд', 'Остаток, шт', 'Цена за шт, ₸', 'Сумма на складе, ₸'])
  hdrRow.height = 22
  hdrRow.eachCell(cell => {
    cell.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF375623' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF375623' } },
      bottom: { style: 'thin', color: { argb: 'FF375623' } },
      left:   { style: 'thin', color: { argb: 'FF375623' } },
      right:  { style: 'thin', color: { argb: 'FF375623' } },
    }
  })

  const greenBorder = {
    top:    { style: 'thin' as const, color: { argb: 'FFC6EFCE' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFC6EFCE' } },
    left:   { style: 'thin' as const, color: { argb: 'FFC6EFCE' } },
    right:  { style: 'thin' as const, color: { argb: 'FFC6EFCE' } },
  }

  let totalStock = 0
  let totalValue = 0

  items.forEach((item, idx) => {
    const price = Number(item.pricePerPc)
    const value = price * item.stock
    totalStock += item.stock
    totalValue += value

    const r = sheet.addRow([idx + 1, item.article ?? '', item.name, item.brand ?? '', item.stock, price, value])
    r.height = 18
    r.eachCell((cell, col) => {
      // Out-of-stock: red highlight
      if (item.stock === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
        cell.font = { color: { argb: 'FF9C0006' } }
      } else if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
      }
      cell.border = greenBorder
      if (col === 1) cell.alignment = { horizontal: 'center' }
      if (col === 5) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0' }
      if (col === 6) { cell.alignment = { horizontal: 'right' };  cell.numFmt = '#,##0.00' }
      if (col === 7) { cell.alignment = { horizontal: 'right' };  cell.numFmt = '#,##0.00' }
    })
  })

  // Total row
  const totRow = sheet.addRow(['', '', 'ИТОГО', '', totalStock, '', totalValue])
  totRow.height = 22
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
    cell.border = {
      top:    { style: 'medium', color: { argb: 'FF375623' } },
      bottom: { style: 'medium', color: { argb: 'FF375623' } },
      left:   greenBorder.left,
      right:  greenBorder.right,
    }
    if (col === 3) cell.alignment = { horizontal: 'right' }
    if (col === 5) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0' }
    if (col === 7) { cell.alignment = { horizontal: 'right' };  cell.numFmt = '#,##0.00' }
  })

  const buffer   = await wb.xlsx.writeBuffer()
  const filename = `Остатки_${now.toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control':       'no-store',
    },
  })
}
