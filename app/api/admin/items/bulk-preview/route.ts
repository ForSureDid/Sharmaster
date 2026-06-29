import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

// ─── Cell helpers ─────────────────────────────────────────────────────────────

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

// ─── Column detection ─────────────────────────────────────────────────────────

const COL = {
  article:    /арт(икул)?|art|код\s*товара|code/i,
  name:       /наим|назв|товар|name|product/i,
  stock:      /кол|qty|количество|остат|склад|приход|штук|pcs/i,
  price:      /цена|price|стоим/i,
  brand:      /бренд|brand|произв|марка/i,
  sizeInches: /размер|size|дюйм/i,
  fullName:   /полн\s*назв|full\s*name/i,
  barcode:    /штрих|barcode|ean/i,
}

type ColMap = {
  article: number; name: number; stock: number; price: number
  brand: number; sizeInches: number; fullName: number; barcode: number
}

function detectColumns(sheet: ExcelJS.Worksheet): { colMap: ColMap; dataStartRow: number } {
  const header = sheet.getRow(1)
  const cells = Array.from({ length: 20 }, (_, i) => cellStr(header.getCell(i + 1).value))

  const isHeader = cells.some(h =>
    COL.article.test(h) || COL.name.test(h) || COL.stock.test(h) || COL.price.test(h)
  )

  const cm: ColMap = { article: 0, name: 0, stock: 0, price: 0, brand: 0, sizeInches: 0, fullName: 0, barcode: 0 }

  if (isHeader) {
    cells.forEach((h, i) => {
      const c = i + 1
      if (!cm.article    && COL.article.test(h))    cm.article = c
      else if (!cm.name  && COL.name.test(h))       cm.name = c
      else if (!cm.stock && COL.stock.test(h))      cm.stock = c
      else if (!cm.price && COL.price.test(h))      cm.price = c
      if (!cm.brand      && COL.brand.test(h))      cm.brand = c
      if (!cm.sizeInches && COL.sizeInches.test(h)) cm.sizeInches = c
      if (!cm.fullName   && COL.fullName.test(h))   cm.fullName = c
      if (!cm.barcode    && COL.barcode.test(h))    cm.barcode = c
    })
    if (!cm.name)  cm.name = 1
    if (!cm.stock) cm.stock = 3
    if (!cm.price) cm.price = 4
    return { colMap: cm, dataStartRow: 2 }
  }

  // No headers — generic positional fallback
  cm.name = 1; cm.article = 2; cm.stock = 3; cm.price = 4; cm.brand = 5
  return { colMap: cm, dataStartRow: 1 }
}

// ─── Parse sheet ──────────────────────────────────────────────────────────────

type RawRow = {
  article: string; name: string; fullName: string; barcode: string
  brand: string; sizeInches: string; stock: number | null; price: number | null
}

function parseSheet(sheet: ExcelJS.Worksheet): RawRow[] {
  const { colMap: cm, dataStartRow } = detectColumns(sheet)
  const rows: RawRow[] = []

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum < dataStartRow) return
    const name = cm.name > 0 ? cellStr(row.getCell(cm.name).value) : ''
    if (!name) return

    rows.push({
      name,
      article:    cm.article    > 0 ? cellStr(row.getCell(cm.article).value)    : '',
      fullName:   cm.fullName   > 0 ? cellStr(row.getCell(cm.fullName).value)   : '',
      barcode:    cm.barcode    > 0 ? cellStr(row.getCell(cm.barcode).value)     : '',
      brand:      cm.brand      > 0 ? cellStr(row.getCell(cm.brand).value)       : '',
      sizeInches: cm.sizeInches > 0 ? cellStr(row.getCell(cm.sizeInches).value) : '',
      stock: cm.stock > 0 ? cellNum(row.getCell(cm.stock).value) : null,
      price: cm.price > 0 ? cellNum(row.getCell(cm.price).value) : null,
    })
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
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 })
  if (!file.name.match(/\.xlsx?$/i)) {
    return NextResponse.json({ error: 'Только .xlsx файлы' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(new Uint8Array(arrayBuffer) as any)
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать Excel файл' }, { status: 400 })
  }

  const sheet = wb.worksheets[0]
  if (!sheet) return NextResponse.json({ error: 'Файл пуст или не содержит листов' }, { status: 400 })

  const rawRows = parseSheet(sheet)
  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'В файле не найдено строк с товарами' }, { status: 400 })
  }

  // Deduplicate by article or name
  const merged = new Map<string, RawRow>()
  for (const row of rawRows) {
    const key = row.article ? `a:${row.article}` : `n:${row.name}`
    if (!merged.has(key)) merged.set(key, row)
    // later duplicates ignored — for new items import, first occurrence wins
  }
  const deduped = [...merged.values()]

  // Conflict detection against DB
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

  const rows = deduped.map(row => {
    const match = (row.article ? byArticle.get(row.article) : undefined) ?? byName.get(row.name)
    return {
      article:       row.article,
      name:          row.name,
      fullName:      row.fullName,
      barcode:       row.barcode,
      brand:         row.brand,
      sizeInches:    row.sizeInches,
      stock:         row.stock,
      price:         row.price,
      existingId:    match?.id   ?? null,
      existingStock: match?.stock ?? null,
      willCreate:    !match,
    }
  })

  return NextResponse.json({
    rows,
    stats: {
      total:     rows.length,
      willCreate: rows.filter(r => r.willCreate).length,
      conflicts:  rows.filter(r => !r.willCreate).length,
    },
  })
}
