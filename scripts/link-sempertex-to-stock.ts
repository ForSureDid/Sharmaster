/**
 * Links Sempertex images from latex-balloons bucket to StockItems by article.
 *
 * Match: StockItem.article == first numeric segment of storage key filename.
 * Head image = file without trailing _N suffix; extras = files ending _N.ext
 *
 * Run: npx tsx scripts/link-sempertex-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'latex-balloons'
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

function isExtra(key: string): boolean {
  const base = key.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  return /\._?\d+$/.test(base)
}

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = []
  async function recurse(prefix: string) {
    let offset = 0
    while (true) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, offset, prefix }),
      })
      const files = await res.json() as Array<{ name: string; id: string | null }>
      for (const f of files) {
        const fullPath = prefix ? `${prefix}/${f.name}` : f.name
        if (f.id === null) await recurse(fullPath)
        else keys.push(fullPath)
      }
      if (files.length < 1000) break
      offset += files.length
    }
  }
  await recurse('')
  return keys
}

async function main() {
  console.log('Scanning latex-balloons bucket...')
  const allKeys = await listAllKeys()
  console.log(`  ${allKeys.length} total files`)

  // Build article → { head, extras }
  type Group = { head: string | null; extras: string[] }
  const byArticle = new Map<string, Group>()

  for (const key of allKeys) {
    const filename = key.split('/').pop()!
    const article = filename.split('_')[0]
    if (!/^\d+$/.test(article)) continue

    if (!byArticle.has(article)) byArticle.set(article, { head: null, extras: [] })
    const g = byArticle.get(article)!
    if (isExtra(key)) g.extras.push(key)
    else if (!g.head) g.head = key
  }
  console.log(`  ${byArticle.size} unique article groups in storage`)

  console.log('\nLoading Sempertex StockItems with article...')
  const items = await prisma.stockItem.findMany({
    where: {
      brand: { contains: 'sempertex', mode: 'insensitive' },
      article: { not: null },
      imageUrl: null,
    },
    select: { id: true, name: true, article: true },
  })
  console.log(`  ${items.length} items to process`)

  let linked = 0, noMatch = 0
  const errors: string[] = []
  const BATCH = 10

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const g = byArticle.get(item.article!)
      if (!g?.head) { noMatch++; return }

      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: {
            imageUrl: publicUrl(g.head),
            images: g.extras.map(publicUrl),
          },
        })
        linked++
      } catch (e) {
        errors.push(`id=${item.id}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Linked:   ${linked}`)
  console.log(`  No match: ${noMatch}`)
  if (errors.length) errors.forEach(e => console.log('  ERR:', e))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
