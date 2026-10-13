// Fills OnecStockItem.brand (only where NULL/empty) from the brand word the 1C item name starts with.
// Usage: npx tsx scripts/backfill-brand-from-name-prefix.ts [--apply]. Writes a backup json before applying.
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import { writeFileSync } from 'fs'
dotenv.config()
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

// first word of name (lowercase) -> brand string as already used in the DB
const MAP: Record<string, string> = {
  anagram: 'Anagram', falali: 'Falali', sempertex: 'Sempertex S.A.', agura: 'Agura',
  qualatex: 'Qualatex', partydeco: 'PartyDeco', flexmetal: 'Flexmetal', grabo: 'Grabo S.r.l.',
  belbal: 'Belbal', mecrla: 'MECRLA', everts: 'Everts', pantex: 'Pantex', 'make&fun': 'Make&fun',
}

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.onecStockItem.findMany({ where: { OR: [{ brand: null }, { brand: '' }] }, select: { id: true, name: true, brand: true } })
  const todo = rows.flatMap(r => { const b = MAP[r.name.trim().split(/\s+/)[0].toLowerCase()]; return b ? [{ id: r.id, old: r.brand, brand: b }] : [] })
  const counts: Record<string, number> = {}
  for (const t of todo) counts[t.brand] = (counts[t.brand] ?? 0) + 1
  console.log(apply ? 'APPLY' : 'DRY RUN', todo.length, counts)
  if (!apply) return
  writeFileSync('scripts/backup-brand-name-prefix.json', JSON.stringify(todo))
  for (const [brand, n] of Object.entries(counts)) {
    const ids = todo.filter(t => t.brand === brand).map(t => t.id)
    const r = await prisma.onecStockItem.updateMany({ where: { id: { in: ids } }, data: { brand } })
    console.log(brand, n, r.count)
  }
}
main().finally(() => prisma.$disconnect())
