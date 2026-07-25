// Confirms why latex-Sempertex can't be turned on the way latex-BK was: of the 216
// unlinked Sempertex OnecStockItem rows, only 4 have a non-null article at all (the
// rest are NULL — no key to match on), and those 4 use donballon's numeric catalog
// scheme, not latex-Sempertex's raw "R12SM005"-style SKU codes. See the top-of-file
// comment in scripts/link-onec-images.ts for the full reasoning.
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const total = await prisma.onecStockItem.count({ where: { name: { contains: 'Sempertex', mode: 'insensitive' }, imageUrl: null } })
  const withArticle = await prisma.onecStockItem.count({ where: { name: { contains: 'Sempertex', mode: 'insensitive' }, imageUrl: null, article: { not: null } } })
  console.log(`Sempertex unlinked total=${total}, with non-null article=${withArticle}`)
  const rows = await prisma.onecStockItem.findMany({
    where: { name: { contains: 'Sempertex', mode: 'insensitive' }, imageUrl: null, article: { not: null } },
    select: { id: true, article: true, name: true },
  })
  rows.forEach(r => console.log(`  id=${r.id} art="${r.article}" | ${r.name}`))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
