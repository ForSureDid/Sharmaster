/**
 * Updates StockItem.stock and StockItem.pricePerPc from "Оценка.xlsx".
 *
 * Оценка name format:  "512 (10''/25 см) Бежевый, пастель ретро, 100 шт., , шт"
 * DB name format:      "512 (10''/25 см) Бежевый, пастель ретро, 100 шт."
 * Cleanup: strip trailing ", , шт" / ", , м" suffix.
 *
 * Strategy:
 *   1. Reset ALL StockItem.stock to 0.
 *   2. For each row in Оценка, update matching item with real stock + price.
 *   3. Report unmatched rows (items in file but not in DB).
 *
 * npx tsx scripts/update-stock-from-otsenka.ts [--dry-run]
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })
const DRY_RUN = process.argv.includes('--dry-run')

const FILE = 'All the Files with material here/Оценка.xlsx'

// Strip trailing unit suffix: ", , шт" / ", , м" etc.
function cleanName(raw: string): string {
  return raw.trim().replace(/,\s*,\s*[а-яёА-ЯЁ]+\.?\s*$/, '').trimEnd().replace(/,\s*$/, '').trimEnd()
}

interface Row {
  name: string
  stock: number
  pricePerPc: number
}

function parseFile(): Row[] {
  const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const rows: Row[] = []
  const seen = new Set<string>()

  for (const r of raw) {
    const nameRaw = r[0]
    const stock   = r[5]
    const price   = r[7]
    if (typeof nameRaw !== 'string' || typeof stock !== 'number' || typeof price !== 'number') continue

    const name = cleanName(nameRaw)
    if (!name || seen.has(name)) continue
    seen.add(name)

    rows.push({ name, stock: Math.round(stock), pricePerPc: price })
  }

  return rows
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`)
  console.log(`\nReading ${FILE}...`)
  const rows = parseFile()
  console.log(`  ${rows.length} unique items parsed`)

  // Show sample
  console.log('\nSample rows:')
  rows.slice(0, 5).forEach(r => console.log(`  stock=${String(r.stock).padStart(5)}  price=${String(r.pricePerPc).padStart(6)}  "${r.name}"`))

  // Load all DB names into a Set for fast lookup
  console.log('\nLoading DB item names...')
  const dbItems = await prisma.stockItem.findMany({ select: { id: true, name: true } })
  const nameToId = new Map(dbItems.map(i => [i.name, i.id]))
  console.log(`  ${dbItems.length} StockItems in DB`)

  // Step 1: Reset all stock to 0
  if (!DRY_RUN) {
    console.log('\nResetting all stock to 0...')
    await prisma.stockItem.updateMany({ data: { stock: 0 } })
    console.log('  Done.')
  } else {
    console.log('\n[DRY RUN] Would reset all stock to 0.')
  }

  // Step 2: Update matching items
  console.log('\nUpdating stock + price...')
  let matched = 0, unmatched = 0
  const unmatchedNames: string[] = []
  const BATCH = 20

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await Promise.all(batch.map(async row => {
      const id = nameToId.get(row.name)
      if (!id) {
        unmatched++
        unmatchedNames.push(row.name)
        return
      }
      if (!DRY_RUN) {
        await prisma.stockItem.update({
          where: { id },
          data: {
            stock: row.stock,
            pricePerPc: new Prisma.Decimal(row.pricePerPc),
          },
        })
      }
      matched++
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed`)
  }

  console.log('\n\n── Results ─────────────────────────────────────────')
  console.log(`  Matched & updated: ${matched}`)
  console.log(`  In file, not in DB: ${unmatched}`)
  console.log(`  In DB, not in file (stock→0): ${dbItems.length - matched}`)

  if (unmatchedNames.length) {
    console.log(`\nUnmatched items (first 20):`)
    unmatchedNames.slice(0, 20).forEach(n => console.log(`  "${n}"`))
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written. Re-run without --dry-run to apply.')
  } else {
    console.log(`\nDone. ${matched} items updated with real stock + price.`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
