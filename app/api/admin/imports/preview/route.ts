import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

// ─── Cell value helpers ────────────────────────────────────────────────────────

function cellStr(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (val instanceof Date) return ''
  if (typeof val === 'object') {
    if ('result' in val) return cellStr((val as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
    if ('richText' in val) return (val as ExcelJS.CellRichTextValue).richText?.map(r => r.text).join('') ?? ''
    if ('text' in val) return String((val as { text: string }).text)
  }
  return ''
}

function cellNum(val: ExcelJS.CellValue): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(',', '.').replace(/\s/g, ''))
    return isNaN(n) ? null : n
  }
  if (typeof val === 'object' && val !== null && 'result' in val) {
    return cellNum((val as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
  }
  return null
}

// ─── Column detection ──────────────────────────────────────────────────────────

const COL_PATTERNS = {
  article: /арт|art|код|code/i,
  name:    /наим|назв|товар|name|product/i,
  qty:     /кол|qty|количество|приход|поступ|штук|pcs/i,
  price:   /цена|price|стоим/i,
}

type ColMap = { article: number; name: number; qty: number; price: number }

function detectColumns(sheet: ExcelJS.Worksheet): { colMap: ColMap; dataStartRow: number } {
  const firstRow = sheet.getRow(1)

  // Check up to 15 columns for header keywords
  const headerCells = Array.from({ length: 15 }, (_, i) => cellStr(firstRow.getCell(i + 1).value))
  const isHeader = headerCells.some(
    h => COL_PATTERNS.article.test(h) || COL_PATTERNS.name.test(h) ||
         COL_PATTERNS.qty.test(h) || COL_PATTERNS.price.test(h)
  )

  if (isHeader) {
    const colMap: ColMap = { article: -1, name: -1, qty: -1, price: -1 }
    headerCells.forEach((h, i) => {
      const col = i + 1
      if (COL_PATTERNS.article.test(h) && colMap.article === -1) colMap.article = col
      else if (COL_PATTERNS.name.test(h) && colMap.name === -1)  colMap.name = col
      else if (COL_PATTERNS.qty.test(h) && colMap.qty === -1)    colMap.qty = col
      else if (COL_PATTERNS.price.test(h) && colMap.price === -1) colMap.price = col
    })
    // Fallback for undetected columns
    if (colMap.name === -1)    colMap.name = 1
    if (colMap.qty === -1)     colMap.qty = 3
    if (colMap.price === -1)   colMap.price = 4
    if (colMap.article === -1) colMap.article = 0 // 0 = not used
    return { colMap, dataStartRow: 2 }
  }

  // No headers — try to detect the Оценка format: name@col1, stock@col6, price@col8
  // Heuristic: check if row 1 col 1 is a string and col 6 is a number
  const r1 = sheet.getRow(1)
  const maybeOtsenka =
    typeof r1.getCell(1).value === 'string' &&
    typeof r1.getCell(6).value === 'number'

  if (maybeOtsenka) {
    return { colMap: { article: 0, name: 1, qty: 6, price: 8 }, dataStartRow: 1 }
  }

  // Generic fallback: A=article, B=name, C=qty, D=price
  return { colMap: { article: 1, name: 2, qty: 3, price: 4 }, dataStartRow: 1 }
}

// ─── Sheet parser ──────────────────────────────────────────────────────────────

type RawRow = { article: string; name: string; qty: number; price: number | null }

function parseSheet(sheet: ExcelJS.Worksheet): RawRow[] {
  const { colMap, dataStartRow } = detectColumns(sheet)
  const rows: RawRow[] = []

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum < dataStartRow) return

    const name    = colMap.name    > 0 ? cellStr(row.getCell(colMap.name).value)    : ''
    const article = colMap.article > 0 ? cellStr(row.getCell(colMap.article).value) : ''
    const qty     = cellNum(row.getCell(colMap.qty).value)
    const price   = colMap.price > 0 ? cellNum(row.getCell(colMap.price).value) : null

    if (!name || qty === null || qty <= 0) return
    rows.push({ article, name, qty: Math.round(qty), price })
  })

  return rows
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!file.name.match(/\.xlsx?$/i)) {
    return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(new Uint8Array(arrayBuffer) as any)
  } catch {
    return NextResponse.json({ error: 'Could not read the Excel file' }, { status: 400 })
  }

  const sheet = wb.worksheets[0]
  if (!sheet) return NextResponse.json({ error: 'The file has no sheets' }, { status: 400 })

  const rawRows = parseSheet(sheet)
  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in the file' }, { status: 400 })
  }

  // Deduplicate: same article (non-empty) or same name → sum qty, take last price
  type Merged = RawRow & { count: number }
  const merged = new Map<string, Merged>()
  for (const row of rawRows) {
    const key = row.article ? `a:${row.article}` : `n:${row.name}`
    const existing = merged.get(key)
    if (existing) {
      existing.qty += row.qty
      if (row.price !== null) existing.price = row.price
      existing.count++
    } else {
      merged.set(key, { ...row, count: 1 })
    }
  }
  const deduped = [...merged.values()]

  // Match against DB
  const articles = deduped.filter(r => r.article).map(r => r.article)
  const names    = deduped.map(r => r.name)

  const existing = await db.stockItem.findMany({
    where: {
      OR: [
        ...(articles.length ? [{ article: { in: articles } }] : []),
        { name: { in: names } },
      ],
    },
    select: { id: true, article: true, name: true, stock: true },
  })

  const byArticle = new Map(existing.filter(e => e.article).map(e => [e.article!, e]))
  const byName    = new Map(existing.map(e => [e.name, e]))

  const preview = deduped.map(row => {
    const match = (row.article ? byArticle.get(row.article) : undefined) ?? byName.get(row.name)
    return {
      article:       row.article,
      name:          row.name,
      qty:           row.qty,
      price:         row.price,
      existingId:    match?.id ?? null,
      existingStock: match?.stock ?? null,
      willCreate:    !match,
    }
  })

  const willUpdate = preview.filter(r => !r.willCreate).length
  const willCreate = preview.filter(r => r.willCreate).length

  return NextResponse.json({ rows: preview, stats: { total: preview.length, willUpdate, willCreate } })
}
