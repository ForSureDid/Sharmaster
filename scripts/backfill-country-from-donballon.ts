// Fills OnecStockItem.countryOfOrigin (1C never sends it) from the donballon YML feed's
// <country_of_origin>, matched by article→vendorCode (unique) then barcode. Only fills NULLs.
// Usage: npx tsx scripts/backfill-country-from-donballon.ts <feed.xml> [--apply]
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
dotenv.config()
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

async function main() {
  const xml = new TextDecoder('windows-1251').decode(fs.readFileSync(process.argv[2]))
  const byCode = new Map<string, Set<string>>()
  const byBarcode = new Map<string, string>()
  for (const m of xml.matchAll(/<offer\b[\s\S]*?<\/offer>/g)) {
    const o = m[0]
    const country = o.match(/<country_of_origin>([^<]+)<\/country_of_origin>/)?.[1]?.trim()
    if (!country) continue
    const c = cap(country)
    const code = o.match(/<vendorCode>([^<]*)<\/vendorCode>/)?.[1]?.trim().toUpperCase()
    if (code) { if (!byCode.has(code)) byCode.set(code, new Set()); byCode.get(code)!.add(c) }
    const bc = o.match(/name="BARCODE"[^>]*>([^<]*)</)?.[1]
    if (bc) for (const b of bc.split(',').map(s => s.trim()).filter(Boolean)) byBarcode.set(b, c)
  }
  const items = await prisma.onecStockItem.findMany({ where: { countryOfOrigin: null }, select: { id: true, article: true, barcode: true } })
  const todo: { id: number; country: string }[] = []
  for (const it of items) {
    let c: string | undefined
    const set = it.article ? byCode.get(it.article.trim().toUpperCase()) : undefined
    if (set && set.size === 1) c = [...set][0]
    if (!c && it.barcode) c = byBarcode.get(it.barcode.trim())
    if (c) todo.push({ id: it.id, country: c })
  }
  const counts: Record<string, number> = {}
  for (const t of todo) counts[t.country] = (counts[t.country] ?? 0) + 1
  console.log(process.argv.includes('--apply') ? 'APPLY' : 'DRY RUN', `${todo.length}/${items.length}`, counts)
  if (!process.argv.includes('--apply')) return
  fs.writeFileSync('scripts/backup-country-before-donballon.json', JSON.stringify(todo.map(t => ({ id: t.id, old: null }))))
  for (const country of Object.keys(counts)) {
    const r = await prisma.onecStockItem.updateMany({ where: { id: { in: todo.filter(t => t.country === country).map(t => t.id) }, countryOfOrigin: null }, data: { countryOfOrigin: country } })
    console.log(country, r.count)
  }
}
main().finally(() => prisma.$disconnect())
