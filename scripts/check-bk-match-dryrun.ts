import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function listOneLevel(bucket: string, prefix: string) {
  const out: Array<{ name: string; id: string | null }> = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix }),
    })
    const files = await res.json() as Array<{ name: string; id: string | null }>
    out.push(...files)
    if (files.length < 1000) break
    offset += files.length
  }
  return out
}
async function listAllKeys(bucket: string, prefix = '', depth = 0): Promise<string[]> {
  if (depth > 6) return []
  const entries = await listOneLevel(bucket, prefix)
  const keys: string[] = []
  for (const e of entries) {
    const full = prefix ? `${prefix}${e.name}` : e.name
    if (e.id !== null) keys.push(full)
    else keys.push(...await listAllKeys(bucket, `${full}/`, depth + 1))
  }
  return keys
}

// bucket-side: extract trailing Ch##### / ch##### segment, canonicalize to "CH#####"
function extractBkCode(basename: string): string | null {
  const noExt = basename.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const m = /_([Cc][Hh]\d{5})$/.exec(noExt)
  if (!m) return null
  const digits = m[1].slice(2)
  return `CH${digits}`
}

// DB-side: derive same canonical key from OnecStockItem.article (Cyrillic Ч/ч + 5 digits, optional trailing junk like "_Kz")
function keyForBk(article: string): string | null {
  const m = /^[ЧчЦц](\d{5})/.exec(article.trim())
  if (!m) return null
  return `CH${m[1]}`
}

async function main() {
  const keys = await listAllKeys('latex-BK')
  const imgKeys = keys.filter(k => /\.(jpg|jpeg|png|webp)$/i.test(k))
  const byCode = new Map<string, string[]>()
  for (const k of imgKeys) {
    const basename = k.split('/').pop()!
    const code = extractBkCode(basename)
    if (!code) continue
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(k)
  }
  console.log(`latex-BK: ${keys.length} objects, ${imgKeys.length} images, ${byCode.size} distinct CH-codes`)
  const unrecognized = imgKeys.filter(k => !extractBkCode(k.split('/').pop()!))
  console.log(`Files where extractBkCode failed: ${unrecognized.length}`)
  unrecognized.slice(0, 10).forEach(k => console.log('  UNRECOGNIZED: ' + k))

  const bkRows = await prisma.onecStockItem.findMany({
    where: { name: { contains: 'БиКей' } },
    select: { id: true, article: true, name: true, imageUrl: true },
  })
  console.log(`\nTotal BK rows: ${bkRows.length}`)

  let matched = 0, noKey = 0, noBucketMatch = 0
  const matchedSamples: Array<{ id: number; article: string; name: string; files: string[] }> = []
  const noBucketSamples: Array<{ id: number; article: string; name: string; key: string }> = []
  for (const r of bkRows) {
    const key = keyForBk(r.article ?? '')
    if (!key) { noKey++; continue }
    const files = byCode.get(key)
    if (files) {
      matched++
      if (matchedSamples.length < 20) matchedSamples.push({ id: r.id, article: r.article!, name: r.name, files })
    } else {
      noBucketMatch++
      if (noBucketSamples.length < 10) noBucketSamples.push({ id: r.id, article: r.article!, name: r.name, key })
    }
  }
  console.log(`\nMatched (article has CH-key AND bucket has that code): ${matched}`)
  console.log(`No CH-key derivable from article (e.g. "1103-XXXX" style or null): ${noKey}`)
  console.log(`Has CH-key but no matching file in bucket: ${noBucketMatch}`)

  console.log('\n=== Matched samples (spot check name vs filename) ===')
  matchedSamples.forEach(s => console.log(`  id=${s.id} art="${s.article}" | DB: ${s.name}\n      -> ${s.files.join(', ')}`))

  console.log('\n=== Has key, no bucket file (sample) ===')
  noBucketSamples.forEach(s => console.log(`  id=${s.id} art="${s.article}" key=${s.key} | ${s.name}`))

  // duplicate codes in bucket (more than one file group per code with different "base name" before ordinal split)
  const multi = [...byCode.entries()].filter(([, v]) => v.length > 1)
  console.log(`\nCH-codes with >1 file in bucket: ${multi.length}`)
  multi.slice(0, 10).forEach(([c, v]) => console.log(`  ${c}: ${v.join(' | ')}`))

  // ── Collision check: does keyForBk's Ч/ч+5digit pattern accidentally match
  // OTHER products (confetti, ribbons, etc.) that happen to also have a
  // Ч/ч-prefixed article, landing them a wrong BK-brand photo? ──────────────────
  console.log('\n=== Collision check: non-БиКей rows with a Ч/ч/Ц/ц-leading article ===')
  const nonBk = await prisma.onecStockItem.findMany({
    where: {
      AND: [
        { OR: [{ article: { startsWith: 'Ч' } }, { article: { startsWith: 'ч' } }, { article: { startsWith: 'Ц' } }, { article: { startsWith: 'ц' } }] },
        { NOT: { name: { contains: 'БиКей' } } },
      ],
    },
    select: { id: true, article: true, name: true },
  })
  console.log(`Non-БиКей rows with Ч/ч/Ц/ц-leading article: ${nonBk.length}`)
  let collisions = 0
  for (const r of nonBk) {
    const key = keyForBk(r.article!)
    if (key && byCode.has(key)) {
      collisions++
      console.log(`  COLLISION id=${r.id} art="${r.article}" key=${key} | ${r.name}`)
    }
  }
  console.log(`Collisions: ${collisions} / ${nonBk.length}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
