import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }) })
  const rows = await prisma.$queryRaw<any[]>`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at`
  console.log(rows)

  // check StockItem columns
  const cols = await prisma.$queryRaw<{column_name: string}[]>`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'StockItem' ORDER BY column_name
  `
  console.log('\nStockItem columns:', cols.map(c => c.column_name))
  await prisma.$disconnect()
}
main().catch(console.error)
