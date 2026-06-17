// Quick patch: null out remaining broken products/ imageUrls
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }) })
  const result = await prisma.stockItem.updateMany({
    where: { imageUrl: { contains: '/products/' } },
    data: { imageUrl: null, images: [] },
  })
  console.log(`Cleared ${result.count} broken imageUrls`)
  await prisma.$disconnect()
}
main().catch(console.error)
