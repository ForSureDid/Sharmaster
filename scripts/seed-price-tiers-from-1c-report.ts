// Seeds OnecStockItem.priceTargetHint (price per the 1C retail report) for every report row matched
// by article/name, and pins priceTierId right away where the 1C debug log already shows the item's tiers
// (SyncLog source '1c-offers-debug'). The sync (lib/onecImport.ts resolveTiers) pins the rest on the
// item's next offer. Usage: npx tsx scripts/seed-price-tiers-from-1c-report.ts <report.json>
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
dotenv.config()
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
async function main() {
  const rows: { article: string; name: string; price: number }[] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const items = await prisma.onecStockItem.findMany({ select: { id: true, onecId: true, article: true, name: true } })
  const byArt = new Map<string, typeof items>(), byName = new Map<string, typeof items>()
  for (const it of items) {
    if (it.article) { const k = it.article.trim().toUpperCase(); (byArt.get(k) ?? byArt.set(k, []).get(k)!).push(it) }
    const n = norm(it.name); (byName.get(n) ?? byName.set(n, []).get(n)!).push(it)
  }
  const hint = new Map<number, number>(); const byOnecId = new Map<string, number>()
  for (const r of rows) {
    const c = byArt.get(r.article.toUpperCase()) ?? byName.get(norm(r.article + ' ' + r.name)) ?? byName.get(norm(r.name))
    if (!c || c.length !== 1) continue
    hint.set(c[0].id, r.price); if (c[0].onecId) byOnecId.set(c[0].onecId, c[0].id)
  }
  // group ids by price to update in few statements
  const byPrice = new Map<number, number[]>()
  for (const [id, p] of hint) (byPrice.get(p) ?? byPrice.set(p, []).get(p)!).push(id)
  for (const [p, ids] of byPrice) await prisma.onecStockItem.updateMany({ where: { id: { in: ids } }, data: { priceTargetHint: p } })
  console.log('hints set', hint.size)

  const logs = await prisma.syncLog.findMany({ where: { source: '1c-offers-debug' }, orderBy: { createdAt: 'desc' }, take: 500 })
  const seen = new Set<string>(); let pinned = 0
  for (const l of logs) {
    let j: any; try { j = JSON.parse(l.message ?? '') } catch { continue }
    for (const s of j.samples ?? []) {
      if (seen.has(s.onecId)) continue; seen.add(s.onecId)
      const id = byOnecId.get(s.onecId); if (id == null) continue
      const h = hint.get(id)!
      const hits = (s['цены'] as any[]).filter(p => Number(p['ЦенаЗаЕдиницу']) === h)
      if (hits.length >= 1) { await prisma.onecStockItem.update({ where: { id }, data: { priceTierId: hits[0]['ИдТипаЦены'] } }); pinned++ }
    }
  }
  console.log('tiers pinned from logs', pinned)
}
main().finally(() => prisma.$disconnect())
