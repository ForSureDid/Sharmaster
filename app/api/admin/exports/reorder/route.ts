import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSession } from '@/lib/session'
import { getReorderRecommendations } from '@/lib/reorderReport'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const rows = await getReorderRecommendations()
  const now = new Date()

  // ── Build workbook ──────────────────────────────────────────────────────────
  const wb    = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Дозаказ')

  sheet.columns = [
    { width: 6  }, // №
    { width: 18 }, // Артикул
    { width: 54 }, // Название
    { width: 16 }, // Бренд
    { width: 12 }, // Остаток
    { width: 15 }, // Продажи/день
    { width: 14 }, // Дней истории
    { width: 14 }, // Целевой запас
    { width: 14 }, // Купить
    { width: 16 }, // Источник
  ]

  // Title
  sheet.mergeCells('A1:J1')
  Object.assign(sheet.getCell('A1'), {
    value: 'Рекомендации по закупке (дозаказ)',
    font:      { bold: true, size: 14, color: { argb: 'FF1F4E79' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  sheet.getRow(1).height = 28

  // Date
  sheet.mergeCells('A2:J2')
  Object.assign(sheet.getCell('A2'), {
    value: `По состоянию на ${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    font:      { size: 11, color: { argb: 'FF595959' } },
    alignment: { horizontal: 'center' },
  })
  sheet.getRow(2).height = 20

  sheet.addRow([]) // spacer

  // Header row
  const hdrRow = sheet.addRow(['№', 'Артикул', 'Название', 'Бренд', 'Остаток, шт', 'Продажи/день', 'Дней истории', 'Целевой запас', 'Купить, шт', 'Источник'])
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

  let totalReorderQty = 0

  rows.forEach((row, idx) => {
    totalReorderQty += row.reorderQty

    const r = sheet.addRow([
      idx + 1,
      row.article ?? '',
      row.name,
      row.brand ?? '',
      row.currentStock,
      row.avgDailyConsumption,
      row.daysOfHistory,
      row.targetStock,
      row.reorderQty,
      row.overridden ? 'Вручную' : row.source === 'stock' ? 'Склад' : 'Сайт (оценка)',
    ])
    r.height = 18
    r.eachCell((cell, col) => {
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
      }
      cell.border = greenBorder
      if (col === 1) cell.alignment = { horizontal: 'center' }
      if (col >= 5 && col <= 8) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0.#' }
      if (col === 9) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0'; cell.font = { bold: true } }
      if (col === 10) { cell.alignment = { horizontal: 'center' } }
    })
  })

  // Total row
  const totRow = sheet.addRow(['', '', 'ИТОГО', '', '', '', '', '', totalReorderQty])
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
    if (col === 9) { cell.alignment = { horizontal: 'center' }; cell.numFmt = '#,##0' }
  })

  const buffer   = await wb.xlsx.writeBuffer()
  const filename = `Дозаказ_${now.toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control':       'no-store',
    },
  })
}
