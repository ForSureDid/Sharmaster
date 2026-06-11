/**
 * Links foil balloon images to StockItems that have no imageUrl yet,
 * matching by name-word overlap between the image filename description
 * and the StockItem name.
 *
 * Matching rules:
 *   - extract meaningful words (len≥3, non-digit, non-stop) from both sides
 *   - score = word overlap count
 *   - assign if: overlap ≥ 2  OR  (overlap == 1 AND that word is rare: ≤ 5% of image groups)
 *   - skip if two image groups tie for best score
 *
 *   npx tsx scripts/link-foil-to-stock-by-name.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { execSync } from 'child_process'
import { resolve, basename, dirname } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = resolve(process.cwd(), 'All the Files with material here/Воздушные шары из фольги')
const BUCKET = 'foil-balloons'
const SUPABASE_URL = process.env.SUPABASE_URL!

if (!SUPABASE_URL || !process.env.DIRECT_URL) {
  console.error('Missing SUPABASE_URL or DIRECT_URL')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

// ── Transliteration (same as upload script) ───────────────────────────────────
const CYR: Record<string, string> = {
  А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'Yo',Ж:'Zh',З:'Z',И:'I',Й:'Y',
  К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',
  Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Shch',Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya',
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}
function translit(s: string): string { return s.split('').map(c => CYR[c] ?? c).join('') }
function sanitize(s: string): string {
  return translit(s).replace(/\s+/g,'_').replace(/[^a-zA-Z0-9._\-]/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'')
}
function storageKey(filepath: string): string {
  return `${sanitize(basename(dirname(filepath)))}/${sanitize(basename(filepath))}`
}
function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// ── Article / extra-photo helpers ─────────────────────────────────────────────
function extractArticle(filename: string): string | null {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')
  const idx = noExt.indexOf('_')
  return idx === -1 ? null : noExt.slice(0, idx).replace(/-/g, '').toUpperCase()
}
function extraPhotoNum(filename: string): number | null {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')
  const m = /_(\d+)$/.exec(noExt)
  return m ? parseInt(m[1]) : null
}

// ── Word extraction ───────────────────────────────────────────────────────────
const STOP = new Set([
  // Russian function words
  'шар','шары','для','это','или','при','без','над','под','про','его','ее',
  'они','что','как','уп.','шт.','цвет','этик','набор','пак','упак',
  // Size/unit noise — the actual digits are already filtered by /^\d+$/
  // Latin stopwords that appear in balloon names
  'the','and','for','with',
])

function words(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^а-яёa-z0-9]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w))
  )
}

// Extract the description part from an image filename (everything after article, before trailing photo num)
function filenameDescWords(filename: string): Set<string> {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')
  const afterArticle = noExt.replace(/^[^_]+_/, '')       // remove "ARTICLE_"
  const withoutPhotoNum = afterArticle.replace(/_\d+$/, '') // remove trailing "_N"
  return words(withoutPhotoNum.replace(/_/g, ' '))
}

async function main() {
  console.log('Scanning foil image files...')
  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} files found`)

  // Group by article, store head/extras/descWords
  type Group = {
    head: string | null
    extras: Array<{ num: number; path: string }>
    descWords: Set<string>
  }
  const byArticle = new Map<string, Group>()

  for (const filepath of allFiles) {
    const fn = basename(filepath)
    const article = extractArticle(fn)
    if (!article) continue
    if (!byArticle.has(article)) {
      byArticle.set(article, { head: null, extras: [], descWords: filenameDescWords(fn) })
    }
    const g = byArticle.get(article)!
    const num = extraPhotoNum(fn)
    if (num === null) { if (!g.head) g.head = filepath }
    else g.extras.push({ num, path: filepath })
  }
  for (const g of byArticle.values()) {
    g.extras.sort((a, b) => a.num - b.num)
    if (!g.head && g.extras.length > 0) g.head = g.extras.shift()!.path
  }
  console.log(`  ${byArticle.size} unique article groups`)

  // Build inverted index: word → Set of articles
  const wordIndex = new Map<string, Set<string>>()
  for (const [article, g] of byArticle) {
    for (const w of g.descWords) {
      if (!wordIndex.has(w)) wordIndex.set(w, new Set())
      wordIndex.get(w)!.add(article)
    }
  }
  const totalGroups = byArticle.size
  const rareThreshold = Math.ceil(totalGroups * 0.05) // word must appear in ≤ 5% of groups to count as rare

  console.log('\nLoading unlinked StockItems...')
  const items = await prisma.stockItem.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true },
  })
  console.log(`  ${items.length} items without image`)

  let linked = 0, ambiguous = 0, noMatch = 0
  const errors: string[] = []
  const sample: string[] = []
  const BATCH = 10

  console.log('Matching by name...')
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)

    await Promise.all(batch.map(async (item) => {
      const itemWords = words(item.name)
      if (itemWords.size === 0) { noMatch++; return }

      // Score each candidate group by overlap
      const scores = new Map<string, number>()
      for (const w of itemWords) {
        const groups = wordIndex.get(w)
        if (!groups) continue
        const isRare = groups.size <= rareThreshold
        // Only count rare single-word matches; common words need 2+ overlap
        for (const article of groups) {
          scores.set(article, (scores.get(article) ?? 0) + (isRare ? 1 : 1))
        }
      }

      if (scores.size === 0) { noMatch++; return }

      // Find best and second-best score
      let bestScore = 0
      let secondScore = 0
      for (const s of scores.values()) {
        if (s > bestScore) { secondScore = bestScore; bestScore = s }
        else if (s > secondScore) secondScore = s
      }

      // Require at least 2 overlapping words — single-word matches are too ambiguous
      if (bestScore < 2) { noMatch++; return }

      // Collect all groups tied at best score
      const topCandidates = [...scores.entries()].filter(([, s]) => s === bestScore).map(([a]) => a)

      if (topCandidates.length > 1 && bestScore === secondScore) {
        // True tie — skip if ≤ 2 overlap (ambiguous)
        if (bestScore <= 2) { ambiguous++; return }
      }

      // Pick the first top candidate (ties at 3+ are still very likely correct)
      const winner = topCandidates[0]
      const g = byArticle.get(winner)!
      if (!g?.head) { noMatch++; return }

      const headUrl = publicUrl(storageKey(g.head))
      const extraUrls = g.extras.map(e => publicUrl(storageKey(e.path)))
      try {
        await prisma.stockItem.update({ where: { id: item.id }, data: { imageUrl: headUrl, images: extraUrls } })
        linked++
        if (sample.length < 20) sample.push(`"${item.name.slice(0, 55)}" → ${winner} (overlap=${bestScore})`)
      } catch (e) { errors.push(`id=${item.id}: ${(e as Error).message.slice(0, 80)}`) }
    }))

    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length} processed`)
  }

  console.log('\n')
  console.log('── Results ──────────────────────────────────')
  console.log(`  Linked by name:   ${linked}`)
  console.log(`  No match:         ${noMatch}`)
  console.log(`  Ambiguous (skip): ${ambiguous}`)
  if (errors.length) {
    console.log(`  Errors:           ${errors.length}`)
    errors.slice(0, 10).forEach(e => console.log('   ', e))
  }
  if (sample.length) {
    console.log('\n  Sample matches:')
    sample.forEach(s => console.log('   ', s))
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
