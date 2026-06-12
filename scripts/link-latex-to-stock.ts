/**
 * Links latex balloon images (Supabase Storage "products" bucket) to StockItems.
 *
 * Pass 1 — article match:
 *   DB article == first segment of storage key before first '_'
 *   e.g. "512-10K2" matches key "512-10K2_10_Serebro_khrom_12_sht.jpg"
 *
 * Pass 2 — name match (items still without imageUrl after pass 1):
 *   Transliterate Russian DB name words → Latin, compare with storage key description words.
 *   Assign if overlap ≥ 2 and no tie.
 *
 * Safe to re-run: skips items that already have imageUrl.
 *
 *   npx tsx scripts/link-latex-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'products'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DIRECT_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

// ── Transliteration (same table as upload scripts) ────────────────────────────
const CYR: Record<string, string> = {
  А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'Yo',Ж:'Zh',З:'Z',И:'I',Й:'Y',
  К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',
  Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Shch',Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya',
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}
function translit(s: string): string {
  return s.split('').map(c => CYR[c] ?? c).join('')
}

// ── Storage key helpers ───────────────────────────────────────────────────────
function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// Article = first segment before first '_'
function extractArticle(key: string): string {
  return key.split('_')[0]
}

// Returns N if key ends with _N.ext (integer suffix), else null (= head image)
function extraPhotoNum(key: string): number | null {
  const noExt = key.replace(/\.(jpg|jpeg|png)$/i, '')
  const m = /_(\d+)$/.exec(noExt)
  return m ? parseInt(m[1]) : null
}

// ── Word extraction for name matching ─────────────────────────────────────────
const STOP = new Set([
  'sht','pak','upak','upack','nabor','sht','the','and','for','with',
  'see','sharik','shar','shary','dlya','eto',
])

function wordsLat(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w))
  )
}

// Transliterate Russian name, then extract Latin words
function nameWords(name: string): Set<string> {
  return wordsLat(translit(name))
}

// Extract description words from storage key:
// key: {article}_{maybe_size}_{description}[_{N}].ext
function keyDescWords(key: string): Set<string> {
  const noExt = key.replace(/\.(jpg|jpeg|png)$/i, '')
  const withoutArticle = noExt.replace(/^[^_]+_/, '')      // strip article prefix
  const withoutNum = withoutArticle.replace(/_\d+$/, '')   // strip trailing _N
  // Strip leading size segment if purely numeric
  const parts = withoutNum.split('_')
  const descParts = (parts.length > 1 && /^\d+$/.test(parts[0])) ? parts.slice(1) : parts
  return wordsLat(descParts.join(' '))
}

// ── Fetch all keys from bucket (paginated) ────────────────────────────────────
async function fetchAllKeys(): Promise<string[]> {
  const keys: string[] = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: '' }),
    })
    if (!res.ok) { console.error('Storage list failed:', await res.text()); break }
    const files = await res.json() as Array<{ name: string }>
    for (const f of files) keys.push(f.name)
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching all keys from "products" bucket...')
  const allKeys = await fetchAllKeys()
  console.log(`  ${allKeys.length} files in storage`)

  // Group keys by article → { head, extras, descWords }
  type Group = {
    head: string | null
    extras: Array<{ num: number; key: string }>
    descWords: Set<string>
  }
  const byArticle = new Map<string, Group>()

  for (const key of allKeys) {
    const article = extractArticle(key)
    if (!byArticle.has(article)) {
      byArticle.set(article, { head: null, extras: [], descWords: keyDescWords(key) })
    }
    const g = byArticle.get(article)!
    const num = extraPhotoNum(key)
    if (num === null) { if (!g.head) g.head = key }
    else g.extras.push({ num, key })
  }
  for (const g of byArticle.values()) {
    g.extras.sort((a, b) => a.num - b.num)
    if (!g.head && g.extras.length > 0) g.head = g.extras.shift()!.key
  }
  console.log(`  ${byArticle.size} unique article groups`)

  console.log('\nLoading StockItems...')
  const allItems = await prisma.stockItem.findMany({
    select: { id: true, name: true, article: true, imageUrl: true, categoryId: true },
  })
  console.log(`  ${allItems.length} total StockItems`)

  // ── Pass 1: article-based matching ────────────────────────────────────────
  console.log('\nPass 1: article matching...')
  let p1linked = 0, p1noImage = 0, p1skipped = 0
  const errors: string[] = []
  const BATCH = 10

  const unlinkedAfterP1: Array<{ id: number; name: string; article: string | null; imageUrl: string | null; categoryId: number | null }> = []

  for (let i = 0; i < allItems.length; i += BATCH) {
    const batch = allItems.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      if (item.imageUrl) { p1skipped++; return }
      if (!item.article) { unlinkedAfterP1.push(item); return }

      const g = byArticle.get(item.article)
      if (!g || !g.head) { p1noImage++; unlinkedAfterP1.push(item); return }

      const headUrl = publicUrl(g.head)
      const extraUrls = g.extras.map(e => publicUrl(e.key))
      try {
        await prisma.stockItem.update({ where: { id: item.id }, data: { imageUrl: headUrl, images: extraUrls } })
        p1linked++
      } catch (e) {
        errors.push(`P1 id=${item.id}: ${(e as Error).message.slice(0, 80)}`)
        unlinkedAfterP1.push(item)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, allItems.length)}/${allItems.length} processed`)
  }
  console.log(`\n  Linked:   ${p1linked}`)
  console.log(`  No image: ${p1noImage}`)
  console.log(`  Skipped (already had imageUrl): ${p1skipped}`)

  // ── Pass 2: name-based matching (latex-category items only) ──────────────
  // Only match items in latex balloon categories to avoid false positives
  // (tablecloths, foil balloon brands, confetti accessories share color/occasion words)
  const LATEX_CATS = new Set([268, 270, 271, 272])
  const toName = unlinkedAfterP1.filter(i => !i.imageUrl && i.categoryId != null && LATEX_CATS.has(i.categoryId))
  console.log(`\nPass 2: name matching for ${toName.length} latex-category items...`)

  // Build inverted word index: word → Set of articles
  const wordIndex = new Map<string, Set<string>>()
  for (const [article, g] of byArticle) {
    for (const w of g.descWords) {
      if (!wordIndex.has(w)) wordIndex.set(w, new Set())
      wordIndex.get(w)!.add(article)
    }
  }

  let p2linked = 0, p2ambiguous = 0, p2noMatch = 0
  const sample: string[] = []

  for (let i = 0; i < toName.length; i += BATCH) {
    const batch = toName.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const iWords = nameWords(item.name)
      if (iWords.size === 0) { p2noMatch++; return }

      const scores = new Map<string, number>()
      for (const w of iWords) {
        const groups = wordIndex.get(w)
        if (!groups) continue
        for (const article of groups) {
          scores.set(article, (scores.get(article) ?? 0) + 1)
        }
      }
      if (scores.size === 0) { p2noMatch++; return }

      let bestScore = 0, secondScore = 0
      for (const s of scores.values()) {
        if (s > bestScore) { secondScore = bestScore; bestScore = s }
        else if (s > secondScore) secondScore = s
      }

      if (bestScore < 2) { p2noMatch++; return }

      const topCandidates = [...scores.entries()].filter(([, s]) => s === bestScore).map(([a]) => a)
      if (topCandidates.length > 1 && bestScore === secondScore && bestScore <= 2) {
        p2ambiguous++; return
      }

      const winner = topCandidates[0]
      const g = byArticle.get(winner)!
      if (!g?.head) { p2noMatch++; return }

      const headUrl = publicUrl(g.head)
      const extraUrls = g.extras.map(e => publicUrl(e.key))
      try {
        await prisma.stockItem.update({ where: { id: item.id }, data: { imageUrl: headUrl, images: extraUrls } })
        p2linked++
        if (sample.length < 20) sample.push(`"${item.name.slice(0, 55)}" → ${winner} (overlap=${bestScore})`)
      } catch (e) {
        errors.push(`P2 id=${item.id}: ${(e as Error).message.slice(0, 80)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, toName.length)}/${toName.length} processed`)
  }

  console.log(`\n  Linked:           ${p2linked}`)
  console.log(`  No match:         ${p2noMatch}`)
  console.log(`  Ambiguous (skip): ${p2ambiguous}`)

  console.log('\n── Final summary ────────────────────────────────────')
  console.log(`  Pass 1 (article): ${p1linked}`)
  console.log(`  Pass 2 (name):    ${p2linked}`)
  console.log(`  Total linked:     ${p1linked + p2linked}`)
  if (errors.length) {
    console.log(`  Errors: ${errors.length}`)
    errors.slice(0, 10).forEach(e => console.log('   ', e))
  }
  if (sample.length) {
    console.log('\n  Pass 2 sample matches:')
    sample.forEach(s => console.log('   ', s))
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
