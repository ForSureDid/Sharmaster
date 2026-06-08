import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

// Use direct connection (port 5432) for bulk imports — avoids pooler timeouts
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

// ─── Brand detection ─────────────────────────────────────────────────────────

function extractBrand(name: string): string {
  const n = name.trim()
  if (/ЗАБАВА/i.test(n))          return 'Забава'
  if (/^R\d+\s+S\d/i.test(n))    return 'Забава'   // R12 S00, R12 S69
  if (/^R\d+\s+[CH]\d+\s/i.test(n) && /ЗАБАВА/i.test(n)) return 'Забава'
  if (/^R\d+\s+512-/.test(n))    return '512'       // R10 512-10H02 = 512 brand
  if (/^R\d+\s+\d{3}\b/.test(n)) return 'Sempertex' // R10 014, R12 260
  if (/^R\d+\s+Qualatex/i.test(n)) return 'Qualatex'
  if (/^R\d+\s+/.test(n))        return 'Sempertex' // other R-codes → Sempertex
  return n.split(/\s+/)[0]
}

function extractSizeInches(name: string): string | null {
  const m = name.match(/\((\d+)[''"]/)
  if (m) return m[1]
  const rm = name.match(/^R(\d+)\s/)
  if (rm) return rm[1]
  return null
}

// ─── Brands present in the Product (donballon) table ─────────────────────────

const DB_BRAND_MAP: Record<string, string> = {
  '512':       '512',
  'Agura':     'Agura',
  'AGURA':     'Agura',
  'Anagram':   'Anagram',
  'Falali':    'Falali',
  'Koda':      'Koda',
  'KODA':      'Koda',
  'Дон':       'Дон Баллон',
  'ДонБаллон': 'Дон Баллон',
}

type ProductRow = { id: number; name: string; manufacturer: string | null; sizeInches: string | null; imageUrl: string | null }

function findImageInMemory(
  name: string,
  brand: string,
  lookup: Map<string, ProductRow[]>
): { imageUrl: string | null; productId: number | null } {
  const dbMfr = DB_BRAND_MAP[brand]
  if (!dbMfr) return { imageUrl: null, productId: null }

  const size = extractSizeInches(name)
  const key = `${dbMfr}|${size ?? ''}`
  const candidates = lookup.get(key) ?? []

  if (candidates.length === 0) return { imageUrl: null, productId: null }
  if (candidates.length === 1) return { imageUrl: candidates[0].imageUrl, productId: candidates[0].id }

  // Try to narrow by keywords extracted from the XLS name
  const keywords = name
    .replace(/^R\d+\s+[\d\-\w]+\s*/, '')
    .replace(/^[A-Za-zА-Яа-яЁё]+\s+\([^)]+\)\s*/, '')
    .split(/[,\s]+/)
    .filter(w => w.length > 2 && !/^\d/.test(w) && !/шт/i.test(w))
    .slice(0, 2)
    .map(w => w.toLowerCase())

  const match = candidates.find(p =>
    keywords.some(kw => p.name.toLowerCase().includes(kw))
  )
  if (match) return { imageUrl: match.imageUrl, productId: match.id }

  // Fallback: first candidate in this manufacturer+size bucket
  return { imageUrl: candidates[0].imageUrl, productId: candidates[0].id }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const xlsPath = resolve(process.cwd(), 'All the Files with material here/Оценка_склада_в_розничных_ценах_05_06_26.xls')
  const buf = readFileSync(xlsPath)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const productRows = rows.filter(r => {
    const row = r as unknown[]
    return typeof row[5] === 'number' && typeof row[8] === 'number' &&
           typeof row[0] === 'string' && row[0].trim() && row[0] !== 'ST store'
  })
  console.log(`Found ${productRows.length} stock rows in XLS`)

  // Pre-load all matchable Products into memory (single DB query)
  console.log('Loading matchable products from DB...')
  const matchableProducts = await prisma.product.findMany({
    where: { manufacturer: { in: Object.values(DB_BRAND_MAP) }, imageUrl: { not: null } },
    select: { id: true, name: true, manufacturer: true, sizeInches: true, imageUrl: true },
  })
  console.log(`  Loaded ${matchableProducts.length} products for image matching`)

  // Build lookup: "manufacturer|sizeInches" → Product[]
  const lookup = new Map<string, ProductRow[]>()
  for (const p of matchableProducts) {
    const key = `${p.manufacturer}|${p.sizeInches ?? ''}`
    const arr = lookup.get(key) ?? []
    arr.push(p)
    lookup.set(key, arr)
  }

  // Process all XLS rows in memory
  console.log('Processing rows...')
  const data: {
    name: string; brand: string | null; stock: number; pricePerPc: number;
    imageUrl: string | null; productId: number | null; updatedAt: Date
  }[] = []

  let matched = 0; let skipped = 0
  const now = new Date()

  for (const row of productRows as unknown[][]) {
    const rawName = (row[0] as string).trim()
    const name = rawName.replace(/,\s*,\s*шт\s*$/, '').trim()
    const stock = row[5] as number
    const pricePerPc = row[8] as number

    if (!name || pricePerPc <= 0) { skipped++; continue }

    const brand = extractBrand(name)
    const { imageUrl, productId } = findImageInMemory(name, brand, lookup)
    if (imageUrl) matched++

    data.push({ name, brand, stock, pricePerPc, imageUrl, productId, updatedAt: now })
  }

  // Deduplicate by name (last occurrence wins)
  const deduped = [...new Map(data.map(d => [d.name, d])).values()]
  console.log(`  ${deduped.length} unique rows ready (${matched} with images, ${skipped} skipped)`)

  // Wipe and re-insert (clean full import)
  console.log('Clearing old stock data...')
  await prisma.stockItem.deleteMany({})

  console.log('Inserting in batches...')
  const BATCH = 500
  for (let i = 0; i < deduped.length; i += BATCH) {
    await prisma.stockItem.createMany({ data: deduped.slice(i, i + BATCH), skipDuplicates: true })
    process.stdout.write(`\r  ${Math.min(i + BATCH, deduped.length)}/${deduped.length}`)
  }

  console.log(`\nDone! ${deduped.length} stock items imported, ${matched} with product images.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
