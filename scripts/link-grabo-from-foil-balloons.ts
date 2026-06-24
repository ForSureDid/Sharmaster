/**
 * Links Grabo StockItems (those without imageUrl) to files in foil-balloons bucket.
 * Matching: file name starts with the DB article code.
 * Run: npx tsx scripts/link-grabo-from-foil-balloons.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const SRC_BUCKET = 'foil-balloons'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing env vars'); process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SRC_BUCKET}/${path}`
}

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = []

  async function listDir(prefix: string) {
    let offset = 0
    while (true) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${SRC_BUCKET}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, offset, prefix }),
      })
      if (!res.ok) { console.error('List failed:', await res.text()); break }
      const files = await res.json() as Array<{ name: string; id: string | null }>
      for (const f of files) {
        const fullPath = prefix ? `${prefix}/${f.name}` : f.name
        if (f.id === null) await listDir(fullPath)
        else keys.push(fullPath)
      }
      if (files.length < 1000) break
      offset += files.length
    }
  }

  await listDir('')
  return keys
}

async function main() {
  console.log(`Scanning "${SRC_BUCKET}" bucket...`)
  const allKeys = await listAllKeys()
  console.log(`  ${allKeys.length} total files`)

  // Build map: article_code (uppercase) → full path (first match wins)
  const byArticle = new Map<string, string>()
  for (const key of allKeys) {
    const filename = key.split('/').pop()!
    // Article is everything before the first underscore
    const underscoreIdx = filename.indexOf('_')
    if (underscoreIdx === -1) continue
    const article = filename.slice(0, underscoreIdx).toUpperCase()
    if (!byArticle.has(article)) byArticle.set(article, key)
  }
  console.log(`  ${byArticle.size} unique article prefixes indexed`)

  // Load unlinked Grabo items
  console.log('\nLoading unlinked Grabo StockItems...')
  const items = await prisma.stockItem.findMany({
    where: {
      brand: 'Grabo',
      imageUrl: null,
      article: { not: null },
    },
    select: { id: true, article: true, name: true },
  })
  console.log(`  ${items.length} items without image`)

  // Match
  const toLink: Array<{ id: number; article: string; key: string }> = []
  const noMatch: Array<{ article: string; name: string }> = []

  for (const item of items) {
    const key = byArticle.get(item.article!.toUpperCase())
    if (key) toLink.push({ id: item.id, article: item.article!, key })
    else noMatch.push({ article: item.article!, name: item.name })
  }
  console.log(`  Matched: ${toLink.length}`)
  console.log(`  No match: ${noMatch.length}`)

  if (toLink.length === 0) { console.log('Nothing to link.'); return }

  console.log('\nLinking...')
  let linked = 0
  const errors: string[] = []
  const BATCH = 10

  for (let i = 0; i < toLink.length; i += BATCH) {
    const batch = toLink.slice(i, i + BATCH)
    await Promise.all(batch.map(async ({ id, key }) => {
      try {
        await prisma.stockItem.update({
          where: { id },
          data: { imageUrl: publicUrl(key), images: [] },
        })
        linked++
      } catch (e) {
        errors.push(`id=${id}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, toLink.length)}/${toLink.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Linked:   ${linked}`)
  console.log(`  No match: ${noMatch.length}`)
  if (errors.length) errors.slice(0, 10).forEach(e => console.log('  ERR:', e))
  if (noMatch.length > 0) {
    console.log('\n  Still unmatched (sample):')
    noMatch.slice(0, 20).forEach(i => console.log(`  [${i.article}] ${i.name.slice(0, 55)}`))
    if (noMatch.length > 20) console.log(`  …and ${noMatch.length - 20} more`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
