/**
 * Clears imageUrl for all Anagram StockItems pointing to wrong buckets,
 * then re-links ALL Anagram items (with or without image) from foil-Anagram bucket by article.
 *
 * Run: npx tsx scripts/relink-anagram-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'foil-Anagram'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing env vars')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

function extractArticle(key: string): string | null {
  const noExt = key.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const parts = noExt.split('_')
  const last = parts[parts.length - 1]
  if (/^\d+[-]\d+$/.test(last)) return last
  return null
}

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: '' }),
    })
    if (!res.ok) { console.error('Storage list failed:', await res.text()); break }
    const files = await res.json() as Array<{ name: string; id: string | null }>
    for (const f of files) {
      if (f.id !== null) keys.push(f.name)
    }
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

async function main() {
  // 1. Build article → key map from foil-Anagram bucket
  console.log(`Scanning "${BUCKET}" bucket...`)
  const allKeys = await listAllKeys()
  console.log(`  ${allKeys.length} files in storage`)

  const byArticle = new Map<string, string>()
  for (const key of allKeys) {
    const article = extractArticle(key)
    if (article && !byArticle.has(article)) byArticle.set(article, key)
  }
  console.log(`  ${byArticle.size} unique articles mapped`)

  // 2. Load ALL Anagram items (with and without imageUrl)
  console.log('\nLoading all Anagram StockItems...')
  const items = await prisma.stockItem.findMany({
    where: {
      brand: { contains: 'anagram', mode: 'insensitive' },
      article: { not: null },
    },
    select: { id: true, name: true, article: true, imageUrl: true },
  })
  console.log(`  ${items.length} total Anagram items`)

  const wrongBucket = items.filter(i => i.imageUrl && !i.imageUrl.includes(BUCKET))
  const noImage    = items.filter(i => !i.imageUrl)
  console.log(`  ${wrongBucket.length} with wrong bucket link`)
  console.log(`  ${noImage.length} without any image`)

  // 3. Reset wrong-bucket items
  if (wrongBucket.length > 0) {
    console.log('\nClearing wrong imageUrls...')
    const ids = wrongBucket.map(i => i.id)
    const BATCH = 50
    let cleared = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      await prisma.stockItem.updateMany({
        where: { id: { in: ids.slice(i, i + BATCH) } },
        data: { imageUrl: null, images: [] },
      })
      cleared += Math.min(BATCH, ids.length - i)
      process.stdout.write(`\r  ${cleared}/${ids.length} cleared`)
    }
    console.log()
  }

  // 4. Re-link everything from foil-Anagram
  const toLink = items.filter(i => i.article && byArticle.has(i.article!))
  const noMatch = items.filter(i => !i.article || !byArticle.has(i.article!))
  console.log(`\nLinking ${toLink.length} items from foil-Anagram...`)

  let linked = 0
  const errors: string[] = []
  const sample: string[] = []
  const BATCH = 10

  for (let i = 0; i < toLink.length; i += BATCH) {
    const batch = toLink.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const key = byArticle.get(item.article!)!
      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { imageUrl: publicUrl(key), images: [] },
        })
        linked++
        if (sample.length < 15) sample.push(`"${item.name.slice(0, 55)}" [${item.article}]`)
      } catch (e) {
        errors.push(`id=${item.id}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, toLink.length)}/${toLink.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Linked:   ${linked}`)
  console.log(`  No match: ${noMatch.length}`)
  if (errors.length) {
    console.log(`  Errors:   ${errors.length}`)
    errors.forEach(e => console.log('  ERR:', e))
  }
  if (noMatch.length > 0) {
    console.log('\n  Unmatched articles:')
    noMatch.slice(0, 20).forEach(i => console.log(`  [${i.article}] ${i.name.slice(0, 60)}`))
    if (noMatch.length > 20) console.log(`  …and ${noMatch.length - 20} more`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
