/**
 * Investigates whether unmatched OnecStockItem articles (no imageUrl after
 * scripts/link-onec-images.ts's exact pass) have a near-match in some bucket's
 * code index that differs only by a single trailing letter — e.g. DB article
 * "2307" vs a photo filed under code "2307P" (same physical product, "P" marks a
 * packaging/piece-count SKU variant, not a different item).
 *
 * Read-only. Reuses the same per-bucket extraction logic as link-onec-images.ts.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const IMG_EXT = /\.(jpg|jpeg|png|webp)$/i

async function listOneLevel(bucket: string, prefix: string): Promise<Array<{ name: string; id: string | null }>> {
  const out: Array<{ name: string; id: string | null }> = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix }),
    })
    if (!res.ok) { console.error(`  list failed for ${bucket} prefix="${prefix}":`, await res.text()); break }
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

type Extracted = { code: string; ordinal: number }
type BucketConfig = { name: string; extract: (basename: string) => Extracted | null }
const SHARIK_CODE = /^(\d{4}-\d{4})$/

function extractLeadingSegment(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^([A-Za-z0-9]+)_/.exec(noExt)
  const code = m ? m[1] : (IMG_EXT.test(basename) ? noExt : null)
  if (!code) return null
  const ordM = /_(\d+)$/.exec(noExt)
  return { code, ordinal: ordM ? parseInt(ordM[1], 10) : 0 }
}
function extractLeadingDigits(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^(\d+)_/.exec(noExt)
  if (!m) return null
  const ordM = /_(\d+)$/.exec(noExt)
  return { code: m[1], ordinal: ordM ? parseInt(ordM[1], 10) : 0 }
}
function extractLastSharikSegment(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const last = noExt.split('_').pop()!
  return SHARIK_CODE.test(last) ? { code: last, ordinal: 0 } : null
}
function extractTrailingSharikCode(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /(\d{4}-\d{4})$/.exec(noExt)
  return m ? { code: m[1], ordinal: 0 } : null
}
function extractAlnumLeadingSegment(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^([A-Za-z0-9]+)_/.exec(noExt)
  if (!m) return null
  const ordM = /_(\d+)$/.exec(noExt)
  return { code: m[1], ordinal: ordM ? parseInt(ordM[1], 10) : 0 }
}
function extractPrazdnikStyle(basename: string): Extracted | null {
  if (!IMG_EXT.test(basename)) return null
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^(.+)_(\d+)$/.exec(noExt)
  return m ? { code: m[1], ordinal: parseInt(m[2], 10) } : { code: noExt, ordinal: 0 }
}
const extractPartydecoStyle = extractPrazdnikStyle
function extractNoveltiesStyle(basename: string): Extracted | null {
  if (!IMG_EXT.test(basename)) return null
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^(.+)_(hd|\d+)$/.exec(noExt)
  if (!m) return { code: noExt, ordinal: 0 }
  return { code: m[1], ordinal: m[2] === 'hd' ? 0 : parseInt(m[2], 10) }
}
function extractSharikCodeAnywhere(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /(\d{4}-\d{4})/.exec(noExt)
  return m ? { code: m[1], ordinal: 0 } : null
}

const BUCKETS: BucketConfig[] = [
  { name: 'latex-Belbal', extract: extractTrailingSharikCode },
  { name: 'foil-Anagram', extract: extractLastSharikSegment },
  { name: 'foil-Grabo', extract: extractLastSharikSegment },
  { name: 'foil-Veselaya', extract: extractLastSharikSegment },
  { name: 'latex-Everts', extract: extractLastSharikSegment },
  { name: 'foil-Betalic', extract: extractLastSharikSegment },
  { name: 'foil-balloons', extract: extractLeadingSegment },
  { name: 'latex-balloons', extract: extractLeadingSegment },
  { name: 'Servirovka-stola', extract: extractLeadingDigits },
  { name: 'lenyu-bantyu', extract: extractAlnumLeadingSegment },
  { name: 'Tovary-dlya-prazdnika', extract: extractPrazdnikStyle },
  { name: 'partydeco', extract: extractPartydecoStyle },
  { name: 'donballon-novelties', extract: extractNoveltiesStyle },
  { name: 'foil_balloons_OptShar', extract: extractSharikCodeAnywhere },
]

async function main() {
  console.log('Scanning buckets...')
  const allCodes = new Map<string, string[]>() // code -> bucket names that have it
  for (const cfg of BUCKETS) {
    const keys = await listAllKeys(cfg.name)
    const imgKeys = keys.filter(k => IMG_EXT.test(k))
    const codesHere = new Set<string>()
    for (const key of imgKeys) {
      const basename = key.split('/').pop()!
      const ex = cfg.extract(basename)
      if (ex) codesHere.add(ex.code)
    }
    for (const code of codesHere) {
      if (!allCodes.has(code)) allCodes.set(code, [])
      allCodes.get(code)!.push(cfg.name)
    }
    console.log(`  ${cfg.name}: ${codesHere.size} distinct codes`)
  }
  console.log(`Total distinct codes across all buckets: ${allCodes.size}`)

  const unmatched = await prisma.onecStockItem.findMany({
    where: { article: { not: null }, imageUrl: null },
    select: { id: true, article: true, name: true },
  })
  console.log(`\nUnmatched OnecStockItem rows (article set, no imageUrl): ${unmatched.length}`)

  // Fuzzy: article and code share the same numeric-and-punctuation core, and the
  // ONLY difference is a single trailing LETTER present on one side and not the
  // other (e.g. "2307" vs "2307P" — packaging/piece-count SKU suffix, same
  // physical product). Never strips/adds a trailing DIGIT — that's a real,
  // distinguishing part of these article codes (color/variant), not a suffix
  // convention (confirmed by spot-checking: dropping the last digit of codes
  // like "R12S67"/"132527" lands on a genuinely different, unrelated product).
  const TRAILING_LETTER = /[A-Za-zА-Яа-я]$/
  type FuzzyHit = { id: number; article: string; name: string; code: string; buckets: string[] }
  const hits: FuzzyHit[] = []
  const seenArticles = new Set<string>()

  // codes grouped by their "core" (with any single trailing letter stripped) —
  // built once, reused for every unmatched article.
  const codeCoreIndex = new Map<string, string[]>() // core -> codes (with the letter still on)
  for (const code of allCodes.keys()) {
    if (TRAILING_LETTER.test(code)) {
      const core = code.slice(0, -1)
      if (!codeCoreIndex.has(core)) codeCoreIndex.set(core, [])
      codeCoreIndex.get(core)!.push(code)
    }
  }

  for (const row of unmatched) {
    const article = row.article!.trim()
    if (seenArticles.has(article)) continue
    // Guard against noise on short codes — require a "real" digit-ending core,
    // not e.g. a 1-2 char code where a coincidental letter-suffix match is likely.
    const MIN_CORE_LEN = 4

    // Case A: article has no letter suffix, some bucket code is article+letter.
    if (!TRAILING_LETTER.test(article) && article.length >= MIN_CORE_LEN && /\d$/.test(article) && codeCoreIndex.has(article)) {
      const code = codeCoreIndex.get(article)![0]
      hits.push({ id: row.id, article, name: row.name, code, buckets: allCodes.get(code)! })
      seenArticles.add(article)
      continue
    }
    // Case B: article has a letter suffix, the bare core (no letter) is a bucket code.
    if (TRAILING_LETTER.test(article)) {
      const core = article.slice(0, -1)
      if (core.length >= MIN_CORE_LEN && /\d$/.test(core) && allCodes.has(core)) {
        hits.push({ id: row.id, article, name: row.name, code: core, buckets: allCodes.get(core)! })
        seenArticles.add(article)
      }
    }
  }

  console.log(`\nFuzzy single-trailing-char matches found: ${hits.length} (of ${unmatched.length} unmatched rows)`)
  console.log('\nSample (first 30):')
  hits.slice(0, 30).forEach(h => console.log(`  article="${h.article}" -> code="${h.code}" [${h.buckets.join(',')}]  "${h.name.slice(0, 60)}"`))

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
