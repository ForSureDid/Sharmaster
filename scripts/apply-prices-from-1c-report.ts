// Sets OnecStockItem.pricePerPc from a 1C "Оценка склада (в розничных ценах)" export parsed to JSON
// ([{article,name,stock,price}], see scratchpad). Matches by article, then by "article name" / name.
// Skips priceOverride items and ambiguous names. Usage: npx tsx scripts/apply-prices-from-1c-report.ts <report.json> [--apply]
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
dotenv.config()
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
async function main() {
  const apply = process.argv.includes('--apply')
  const rows: { article: string; name: string; price: number }[] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const items = await prisma.onecStockItem.findMany({ select: { id: true, article: true, name: true, pricePerPc: true, priceOverride: true } })
  const byArt = new Map<string, typeof items>(), byName = new Map<string, typeof items>()
  for (const it of items) {
    if (it.article) { const k = it.article.trim().toUpperCase(); (byArt.get(k) ?? byArt.set(k, []).get(k)!).push(it) }
    const n = norm(it.name); (byName.get(n) ?? byName.set(n, []).get(n)!).push(it)
  }
  const todo: { id: number; old: number; price: number; name: string }[] = []
  let skippedOverride = 0, ambiguous = 0
  for (const r of rows) {
    const c = byArt.get(r.article.toUpperCase()) ?? byName.get(norm(r.article + ' ' + r.name)) ?? byName.get(norm(r.name))
    if (!c) continue
    if (c.length > 1) { ambiguous++; continue }
    const it = c[0]
    if (Number(it.pricePerPc) === r.price) continue
    if (it.priceOverride) { skippedOverride++; continue }
    todo.push({ id: it.id, old: Number(it.pricePerPc), price: r.price, name: it.name })
  }
  console.log(apply ? 'APPLY' : 'DRY RUN', { toUpdate: todo.length, skippedOverride, ambiguous })
  if (!apply) { console.log(todo.slice(0, 10)); return }
  fs.writeFileSync('scripts/backup-prices-before-1c-report.json', JSON.stringify(todo.map(t => ({ id: t.id, price: t.old }))))
  for (const t of todo) await prisma.onecStockItem.update({ where: { id: t.id }, data: { pricePerPc: t.price } })
  console.log('updated', todo.length)
}
main().finally(() => prisma.$disconnect())
