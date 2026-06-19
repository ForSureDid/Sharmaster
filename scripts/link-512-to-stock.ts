/**
 * Links brand-512 images from latex-balloons bucket to StockItems by article.
 *
 * Key format: {folder}/{size}/{512-ARTICLE_description[._N]}.ext
 * Article = first segment of filename before first '_'.
 * Head = no trailing ._N; extras = ._1, ._2, etc.
 *
 * Overwrites any previously set imageUrl (fixes broken products-bucket links).
 *
 * Run: npx tsx scripts/link-512-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'latex-balloons'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing env vars'); process.exit(1)
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
        const full = prefix ? `${prefix}/${f.name}` : f.name
        if (f.id === null) await recurse(full)
        else keys.push(full)
      }
      if (files.length < 1000) break
      offset += files.length
    }
  }
  await recurse('')
  return keys
}

async function main() {
  console.log('Scanning latex-balloons bucket for 512 keys...')
  const allKeys = await listAllKeys()
  const keys512 = allKeys.filter(k => {
    const filename = k.split('/').pop()!
    return filename.startsWith('512-')
  })
  console.log(`  ${allKeys.length} total keys, ${keys512.length} for 512 brand`)

  // Group by article → { head, extras }
  type Group = { head: string | null; extras: string[] }
  const byArticle = new Map<string, Group>()

  for (const key of keys512) {
    const filename = key.split('/').pop()!
    const article = filename.split('_')[0]  // e.g. "512-10C02"
    if (!byArticle.has(article)) byArticle.set(article, { head: null, extras: [] })
    const g = byArticle.get(article)!
    if (isExtra(key)) g.extras.push(key)
    else if (!g.head) g.head = key
  }
  // Sort extras by suffix number
  for (const g of byArticle.values()) {
    g.extras.sort((a, b) => {
      const numA = parseInt(/\._?(\d+)\.[^.]+$/.exec(a)?.[1] ?? '0')
      const numB = parseInt(/\._?(\d+)\.[^.]+$/.exec(b)?.[1] ?? '0')
      return numA - numB
    })
    if (!g.head && g.extras.length > 0) g.head = g.extras.shift()!
  }
  console.log(`  ${byArticle.size} unique 512 article groups in storage`)

  console.log('\nLoading brand-512 StockItems...')
  const items = await prisma.stockItem.findMany({
    where: { brand: '512', article: { not: null } },
    select: { id: true, name: true, article: true, imageUrl: true },
  })
  console.log(`  ${items.length} items total`)

  let linked = 0, noMatch = 0, skipped = 0
  const errors: string[] = []
  const sample: string[] = []
  const BATCH = 10

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const g = byArticle.get(item.article!)
      if (!g?.head) { noMatch++; return }

      // Skip only if already pointing to latex-balloons (correct bucket)
      if (item.imageUrl?.includes('latex-balloons')) { skipped++; return }

      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: {
            imageUrl: publicUrl(g.head),
            images: g.extras.map(publicUrl),
          },
        })
        linked++
        if (sample.length < 10) sample.push(`"${item.article}" → ${g.head.split('/').pop()}`)
      } catch (e) {
        errors.push(`id=${item.id} ${item.article}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log('\n\n── Results ──────────────────────────────────')
  console.log(`  Linked:          ${linked}`)
  console.log(`  No match:        ${noMatch}`)
  console.log(`  Already correct: ${skipped}`)
  if (errors.length) errors.forEach(e => console.log('  ERR:', e))
  if (sample.length) {
    console.log('\n  Sample:')
    sample.forEach(s => console.log('   ', s))
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
