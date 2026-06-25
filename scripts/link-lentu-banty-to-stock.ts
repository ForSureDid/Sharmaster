/**
 * Links lenyu-bantyu bucket images to StockItems by article.
 * Replaces any existing imageUrl regardless of source.
 * Multiple images per article: first = imageUrl, rest = images[].
 * Run: npx tsx scripts/link-lentu-banty-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'lenyu-bantyu'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DATABASE_URL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// Extract article: alphanumeric code at the start of the key (e.g. 6231132, L07001, A0550)
function extractArticle(key: string): string | null {
  const m = /^([A-Za-z0-9]+)_/.exec(key)
  return m ? m[1] : null
}

// Is this key a "secondary" photo (ends with _1, _2, etc. before extension)?
function isSecondary(key: string): boolean {
  return /_\d+\.\w+$/.test(key)
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
    for (const f of files) { if (f.id !== null) keys.push(f.name) }
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

async function main() {
  console.log(`Scanning "${BUCKET}" bucket...`)
  const allKeys = await listAllKeys()
  console.log(`  ${allKeys.length} files in storage`)

  // Group by article: { article → { primary: key | null, extras: key[] } }
  const byArticle = new Map<string, { primary: string | null; extras: string[] }>()

  for (const key of allKeys) {
    const article = extractArticle(key)
    if (!article) continue
    if (!byArticle.has(article)) byArticle.set(article, { primary: null, extras: [] })
    const group = byArticle.get(article)!
    if (isSecondary(key)) {
      group.extras.push(key)
    } else {
      // Prefer the non-secondary as primary; if two non-secondary exist keep first
      if (!group.primary) group.primary = key
      else group.extras.push(key)
    }
  }

  // Sort extras for stable ordering
  for (const g of byArticle.values()) {
    g.extras.sort()
    // Fallback: if no primary found, promote first extra
    if (!g.primary && g.extras.length > 0) {
      g.primary = g.extras.shift()!
    }
  }

  console.log(`  ${byArticle.size} unique articles mapped`)

  const articles = [...byArticle.keys()]
  console.log('\nLoading matching StockItems...')
  const items = await prisma.stockItem.findMany({
    where: { article: { in: articles } },
    select: { id: true, name: true, article: true, imageUrl: true },
  })
  console.log(`  ${items.length} StockItems found with matching articles`)

  if (items.length === 0) {
    console.log('Nothing to link.')
    return
  }

  const alreadyCorrect = items.filter(i => i.imageUrl?.includes(BUCKET)).length
  const toUpdate = items.filter(i => !i.imageUrl?.includes(BUCKET))
  console.log(`  ${alreadyCorrect} already linked to this bucket`)
  console.log(`  ${toUpdate.length} to update (new or wrong source)\n`)

  let linked = 0
  const errors: string[] = []
  const BATCH = 10

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const group = byArticle.get(item.article!)!
      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: {
            imageUrl: publicUrl(group.primary!),
            images: group.extras.map(k => publicUrl(k)),
          },
        })
        linked++
      } catch (e) {
        errors.push(`id=${item.id} [${item.article}]: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Linked:     ${linked}`)
  console.log(`  Errors:     ${errors.length}`)
  if (errors.length) errors.forEach(e => console.log('  ERR:', e))

  const noMatch = articles.filter(a => !items.find(i => i.article === a))
  console.log(`  No DB match: ${noMatch.length} articles (not in StockItem table)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
