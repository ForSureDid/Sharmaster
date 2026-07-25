// Investigation: what do OnecStockItem rows for Sempertex / BK ("БиКей") actually
// look like — article format, brand column, sizeInches — used while diagnosing why
// latex-Sempertex and latex-BK were excluded from scripts/link-onec-images.ts.
// Finding: brand column is 100% NULL (1C doesn't populate it); Sempertex articles are
// donballon numeric codes; BK articles are Cyrillic "Ч47423"/"ч47423" (see
// check-bk-match-dryrun.ts for how that turned into a real fix for BK).
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== Sempertex rows (name contains Sempertex) ===')
  const sempCount = await prisma.onecStockItem.count({ where: { name: { contains: 'Sempertex', mode: 'insensitive' } } })
  console.log('count:', sempCount)
  const semp = await prisma.onecStockItem.findMany({
    where: { name: { contains: 'Sempertex', mode: 'insensitive' } },
    take: 30, select: { id: true, article: true, name: true, sizeInches: true, imageUrl: true },
  })
  semp.forEach(s => console.log(`  id=${s.id} art="${s.article}" size=${s.sizeInches} img=${!!s.imageUrl} | ${s.name}`))

  console.log('\n=== BK / БиКей rows ===')
  const bkPatterns = ['БиКей', 'BiKey', ' BK ', 'BK,', 'BK(', 'BK ']
  for (const p of bkPatterns) {
    const c = await prisma.onecStockItem.count({ where: { name: { contains: p } } })
    console.log(`  contains "${p}": ${c}`)
  }
  const bk = await prisma.onecStockItem.findMany({
    where: { name: { contains: 'БиКей' } },
    take: 30, select: { id: true, article: true, name: true, sizeInches: true, imageUrl: true },
  })
  bk.forEach(s => console.log(`  id=${s.id} art="${s.article}" size=${s.sizeInches} img=${!!s.imageUrl} | ${s.name}`))

  const brands = await prisma.onecStockItem.groupBy({ by: ['brand'], _count: true, orderBy: { _count: { brand: 'desc' } }, take: 30 })
  console.log('\nTop brands:')
  brands.forEach(b => console.log(`  ${b.brand ?? 'NULL'}: ${b._count}`))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
