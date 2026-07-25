// Follow-up to check-onec-sempertex-bk2.ts: quantifies the BK article-prefix shapes
// (Ч##### / ч##### / Ч#####_Kz / the "1103-XXXX" sharik.ru-style outliers) that fed
// the keyForBk() regex in scripts/link-onec-images.ts.
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== Sempertex, currently unlinked (imageUrl null) ===')
  const sempUnlinked = await prisma.onecStockItem.findMany({
    where: { name: { contains: 'Sempertex', mode: 'insensitive' }, imageUrl: null },
    select: { id: true, article: true, name: true, sizeInches: true },
  })
  console.log('count unlinked:', sempUnlinked.length)
  sempUnlinked.slice(0, 40).forEach(s => console.log(`  id=${s.id} art="${s.article}" size=${s.sizeInches} | ${s.name}`))

  console.log('\n=== Sempertex total / linked / unlinked ===')
  const sempTotal = await prisma.onecStockItem.count({ where: { name: { contains: 'Sempertex', mode: 'insensitive' } } })
  const sempLinked = await prisma.onecStockItem.count({ where: { name: { contains: 'Sempertex', mode: 'insensitive' }, imageUrl: { not: null } } })
  console.log(`total=${sempTotal} linked=${sempLinked} unlinked=${sempTotal - sempLinked}`)

  console.log('\n=== BK total / linked / unlinked ===')
  const bkTotal = await prisma.onecStockItem.count({ where: { name: { contains: 'БиКей' } } })
  const bkLinked = await prisma.onecStockItem.count({ where: { name: { contains: 'БиКей' }, imageUrl: { not: null } } })
  console.log(`total=${bkTotal} linked=${bkLinked} unlinked=${bkTotal - bkLinked}`)

  console.log('\n=== BK article patterns (distinct prefixes) ===')
  const bkAll = await prisma.onecStockItem.findMany({ where: { name: { contains: 'БиКей' } }, select: { article: true } })
  const prefixCounts = new Map<string, number>()
  for (const b of bkAll) {
    const a = b.article ?? 'NULL'
    const prefix = a.replace(/[0-9]/g, '#')
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1)
  }
  for (const [p, c] of [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${p}: ${c}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
