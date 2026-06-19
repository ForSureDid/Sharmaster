/**
 * Links brand-512 images to StockItems.
 *
 * Source: Product records with manufacturer="512" (all 495 already have imageUrl from donballon import).
 * Article is extracted from the imageUrl filename (basename without extension).
 *
 * Match: StockItem.article == Product imageUrl filename (no extension).
 *   e.g. StockItem.article "512-12M40" matches Product imageUrl ending in "512-12M40.jpg"
 *
 * Safe to re-run: skips StockItems that already have imageUrl.
 *
 * Run: npx tsx scripts/link-512-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DIRECT_URL) {
  console.error('Missing DIRECT_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

function filenameArticle(imageUrl: string): string {
  const filename = imageUrl.split('/').pop()!
  return filename.replace(/\.(jpg|jpeg|png|webp)$/i, '')
}

async function main() {
  console.log('Loading 512 Products with images...')
  const products = await prisma.product.findMany({
    where: { manufacturer: '512', imageUrl: { not: null } },
    select: { imageUrl: true, images: true },
  })
  console.log(`  ${products.length} products found`)

  // article → { imageUrl, images }
  const byArticle = new Map<string, { imageUrl: string; images: string[] }>()
  for (const p of products) {
    const article = filenameArticle(p.imageUrl!)
    if (!byArticle.has(article)) {
      byArticle.set(article, { imageUrl: p.imageUrl!, images: p.images })
    }
  }
  console.log(`  ${byArticle.size} unique article codes in products`)

  console.log('\nLoading brand-512 StockItems without imageUrl...')
  const items = await prisma.stockItem.findMany({
    where: { brand: '512', imageUrl: null, article: { not: null } },
    select: { id: true, name: true, article: true },
  })
  console.log(`  ${items.length} items to process`)

  let linked = 0, noMatch = 0
  const errors: string[] = []
  const sample: string[] = []
  const BATCH = 10

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const match = byArticle.get(item.article!)
      if (!match) { noMatch++; return }

      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { imageUrl: match.imageUrl, images: match.images },
        })
        linked++
        if (sample.length < 15) {
          sample.push(`"${item.article}" → ${match.imageUrl.split('/').pop()}`)
        }
      } catch (e) {
        errors.push(`id=${item.id} ${item.article}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log('\n\n── Results ──────────────────────────────────')
  console.log(`  Linked:   ${linked}`)
  console.log(`  No match: ${noMatch}`)
  if (errors.length) {
    console.log(`  Errors: ${errors.length}`)
    errors.forEach(e => console.log('   ', e))
  }
  if (sample.length) {
    console.log('\n  Sample matches:')
    sample.forEach(s => console.log('   ', s))
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
