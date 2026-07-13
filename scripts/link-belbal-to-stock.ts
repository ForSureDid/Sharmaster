/**
 * Links latex-Belbal bucket images to StockItems by article (sharik.ru code).
 * Filename format: Belbal_{name}_{code}.jpg → article = code (e.g. 1101-0537)
 * Replaces any existing imageUrl regardless of source.
 * Run: npx tsx scripts/link-belbal-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'latex-Belbal'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DATABASE_URL) {
  console.error('Missing env vars'); process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// Extract sharik.ru code: last NNNN-NNNN before extension
function extractCode(key: string): string | null {
  const noExt = key.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const m = /(\d{4}-\d{4})$/.exec(noExt)
  return m ? m[1] : null
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
    if (!res.ok) break
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

  const byCode = new Map<string, string>()
  let noCode = 0
  for (const key of allKeys) {
    const code = extractCode(key)
    if (!code) { noCode++; continue }
    if (!byCode.has(code)) byCode.set(code, key)
  }
  console.log(`  ${byCode.size} unique codes mapped (${noCode} keys without code)`)

  const codes = [...byCode.keys()]
  console.log('\nLoading matching Belbal StockItems...')
  const items = await prisma.stockItem.findMany({
    where: { article: { in: codes } },
    select: { id: true, name: true, article: true, imageUrl: true },
  })
  console.log(`  ${items.length} StockItems found`)
  const alreadyCorrect = items.filter(i => i.imageUrl?.includes(BUCKET)).length
  console.log(`  ${alreadyCorrect} already linked to this bucket`)
  console.log(`  ${items.length - alreadyCorrect} to update\n`)

  let linked = 0
  const errors: string[] = []
  const BATCH = 10

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const key = byCode.get(item.article!)!
      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { imageUrl: publicUrl(key), images: [] },
        })
        linked++
      } catch (e) {
        errors.push(`id=${item.id} [${item.article}]: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Linked:      ${linked}`)
  console.log(`  Errors:      ${errors.length}`)
  if (errors.length) errors.forEach(e => console.log('  ERR:', e))
  const noMatch = codes.filter(c => !items.find(i => i.article === c))
  console.log(`  No DB match: ${noMatch.length} codes`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
