import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const path = resolve(process.cwd(), 'All the Files with material here/Номенклатура СТ.xlsx')
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // Header is row 7 (index 6), data starts row 8 (index 7)
  // Col indices (0-based): 0=name, 5=article, 12=brand
  const rows: (string | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const dataRows = rows.slice(7)
  console.log(`Read ${dataRows.length} rows from nomenclature`)

  const items: { name: string; article: string | null; brand: string | null; stock: number; pricePerPc: number }[] = []
  const seen = new Set<string>()

  for (const row of dataRows) {
    const name = row[0]?.trim() ?? null
    if (!name) continue
    if (seen.has(name)) continue
    seen.add(name)

    const article = row[5] ? String(row[5]).trim() : null
    const brand   = row[12]?.trim() ?? null

    items.push({ name, article, brand, stock: 0, pricePerPc: 0 })
  }

  console.log(`${items.length} unique products to import`)

  console.log('Deleting existing stock items...')
  await prisma.stockItem.deleteMany({})

  console.log('Inserting...')
  const BATCH = 500
  for (let i = 0; i < items.length; i += BATCH) {
    await prisma.stockItem.createMany({ data: items.slice(i, i + BATCH) })
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log(`\nDone! ${items.length} stock items imported.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
