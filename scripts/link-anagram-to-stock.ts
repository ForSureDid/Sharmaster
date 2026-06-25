/**
 * Links Anagram foil images from "foil-Anagram" bucket to StockItems by article.
 *
 * Key format: Anagram_<name>_<article>.jpg
 * Article extracted as the last underscore-segment before the extension.
 * e.g. "Anagram_B_FIGURA_Mishka_1207-5887.jpg" → article "1207-5887"
 *
 * Matches StockItem where brand ILIKE 'anagram' AND article = extracted code.
 * Skips items that already have imageUrl.
 *
 * Run: npx tsx scripts/link-anagram-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'foil-Anagram'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DIRECT_URL in .env')
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
  console.log(`Scanning "${BUCKET}" bucket...`)
  const allKeys = await listAllKeys()
  console.log(`  ${allKeys.length} files in storage`)

  const byArticle = new Map<string, string>()
  let skipped = 0
  for (const key of allKeys) {
    const article = extractArticle(key)
    if (!article) { skipped++; continue }
    if (!byArticle.has(article)) byArticle.set(article, key)
  }
  console.log(`  ${byArticle.size} unique articles mapped`)
  if (skipped > 0) console.log(`  ${skipped} keys skipped (no article)`)

  console.log('\nLoading Anagram StockItems without image...')
  const items = await prisma.stockItem.findMany({
    where: {
      brand: { contains: 'anagram', mode: 'insensitive' },
      article: { not: null },
      imageUrl: null,
    },
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
      const key = byArticle.get(item.article!)
      if (!key) { noMatch++; return }
      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { imageUrl: publicUrl(key), images: [] },
        })
        linked++
        if (sample.length < 20) sample.push(`"${item.name.slice(0, 60)}" [${item.article}] → ${key}`)
      } catch (e) {
        errors.push(`id=${item.id}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Linked:   ${linked}`)
  console.log(`  No match: ${noMatch}`)
  if (errors.length) {
    console.log(`  Errors:   ${errors.length}`)
    errors.forEach(e => console.log('  ERR:', e))
  }
  if (sample.length) {
    console.log('\n  Sample matches:')
    sample.forEach(s => console.log('  ', s))
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
