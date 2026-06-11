/**
 * Links foil balloon images (already in Supabase Storage "foil-balloons" bucket)
 * to StockItem records by article code.
 *
 * Matching: article = first segment of filename before '_'
 * Head image: file whose name has no trailing _N number
 * Extra images: files with _N suffix, sorted by N
 *
 * Items without article → written to no-article-stock-items.txt
 * Items with article but no matching image → skipped silently
 * Items already linked → skipped (resume-safe)
 *
 *   npx tsx scripts/link-foil-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve, basename, dirname } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = resolve(process.cwd(), 'All the Files with material here/Воздушные шары из фольги')
const BUCKET = 'foil-balloons'
const SUPABASE_URL = process.env.SUPABASE_URL!

if (!SUPABASE_URL || !process.env.DIRECT_URL) {
  console.error('Missing SUPABASE_URL or DIRECT_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

// ── Transliteration (must match upload-foil-to-storage.ts exactly) ──────────
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
function sanitize(s: string): string {
  return translit(s)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}
function storageKey(filepath: string): string {
  const category = basename(dirname(filepath))
  const filename = basename(filepath)
  return `${sanitize(category)}/${sanitize(filename)}`
}
function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// ── Article extraction ────────────────────────────────────────────────────────
// Filename: {ARTICLE}_{name}[_{N}].ext  — article is everything before first _
function extractArticle(filename: string): string | null {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')
  const idx = noExt.indexOf('_')
  if (idx === -1) return null
  // Normalize: strip hyphens, uppercase
  return noExt.slice(0, idx).replace(/-/g, '').toUpperCase()
}

// Returns N if filename ends with _N (pure integer suffix), else null (= head)
function extraPhotoNum(filename: string): number | null {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')
  const m = /_(\d+)$/.exec(noExt)
  return m ? parseInt(m[1]) : null
}

async function main() {
  console.log('Scanning foil image files...')
  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} files found`)

  // Group files by article → { head, extras }
  type Group = { head: string | null; extras: Array<{ num: number; path: string }> }
  const byArticle = new Map<string, Group>()

  for (const filepath of allFiles) {
    const article = extractArticle(basename(filepath))
    if (!article) continue
    if (!byArticle.has(article)) byArticle.set(article, { head: null, extras: [] })
    const g = byArticle.get(article)!
    const num = extraPhotoNum(basename(filepath))
    if (num === null) {
      if (!g.head) g.head = filepath  // first no-number file wins as head
    } else {
      g.extras.push({ num, path: filepath })
    }
  }
  for (const g of byArticle.values()) {
    g.extras.sort((a, b) => a.num - b.num)
    if (!g.head && g.extras.length > 0) g.head = g.extras.shift()!.path
  }
  console.log(`  ${byArticle.size} unique article codes in images`)

  console.log('Loading StockItems from DB...')
  const stockItems = await prisma.stockItem.findMany({
    select: { id: true, name: true, article: true, imageUrl: true },
  })
  const total = stockItems.length
  const noArticleItems = stockItems.filter(s => !s.article)
  const withArticle = stockItems.filter(s => s.article)
  const alreadyLinked = new Set(
    stockItems.filter(s => s.imageUrl?.includes('foil-balloons')).map(s => s.id)
  )
  console.log(`  ${total} items total`)
  console.log(`  ${withArticle.length} have article codes`)
  console.log(`  ${noArticleItems.length} missing article (will write to no-article-stock-items.txt)`)
  console.log(`  ${alreadyLinked.size} already linked to foil-balloons`)

  // Write no-article report
  const noArticleLines = noArticleItems.map(s => `${s.id}\t${s.name}`)
  writeFileSync('no-article-stock-items.txt', noArticleLines.join('\n') + '\n', 'utf-8')
  console.log(`  Wrote no-article-stock-items.txt`)

  let linked = 0, noImage = 0, skipped = 0
  const errors: string[] = []
  const BATCH = 10

  console.log('Linking images to StockItems...')
  for (let i = 0; i < withArticle.length; i += BATCH) {
    const batch = withArticle.slice(i, i + BATCH)

    await Promise.all(batch.map(async (item) => {
      if (alreadyLinked.has(item.id)) { skipped++; return }

      // Normalize DB article same way as filename: strip hyphens, uppercase
      const normalizedArticle = item.article!.replace(/-/g, '').toUpperCase()
      const g = byArticle.get(normalizedArticle)
      if (!g || !g.head) { noImage++; return }

      const headUrl = publicUrl(storageKey(g.head))
      const extraUrls = g.extras.map(e => publicUrl(storageKey(e.path)))

      try {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { imageUrl: headUrl, images: extraUrls },
        })
        linked++
      } catch (e) {
        errors.push(`id=${item.id} article=${item.article}: ${(e as Error).message.slice(0, 100)}`)
      }
    }))

    process.stdout.write(`\r  ${Math.min(i + BATCH, withArticle.length)}/${withArticle.length} processed`)
  }

  console.log('\n')
  console.log('── Results ──────────────────────────────────')
  console.log(`  Linked:           ${linked}`)
  console.log(`  No image found:   ${noImage}`)
  console.log(`  Already linked:   ${skipped}`)
  console.log(`  No article:       ${noArticleItems.length}  (see no-article-stock-items.txt)`)
  if (errors.length) {
    console.log(`  Errors (${errors.length}):`)
    errors.slice(0, 15).forEach(e => console.log('   ', e))
    if (errors.length > 15) console.log(`   ... and ${errors.length - 15} more`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
