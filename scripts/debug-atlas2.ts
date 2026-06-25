import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const samples = ['L07001', 'L07004', 'A0550', 'A101', 'A818', 'L10001']
  const items = await prisma.stockItem.findMany({
    where: { article: { in: samples } },
    select: { id: true, article: true, name: true }
  })
  console.log('Found:', JSON.stringify(items, null, 2))
  
  // Count all L/A articles in DB
  const lItems = await prisma.stockItem.count({ where: { article: { startsWith: 'L' } } })
  const aItems = await prisma.stockItem.count({ where: { article: { startsWith: 'A' } } })
  console.log(`\nDB: articles starting with L: ${lItems}, with A: ${aItems}`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
