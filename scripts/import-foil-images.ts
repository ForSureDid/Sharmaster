/**
 * Links foil balloon images (already uploaded to Supabase Storage "foil-balloons" bucket)
 * to Product records in the DB.
 *
 * Matching strategy (same as latex script):
 *   1. Exact normalized name match
 *   2. Fuzzy: strip embedded 3-digit color codes from normalized name
 *
 * Resume logic: skips products already linked to the foil-balloons bucket.
 *
 * Run after upload-foil-to-storage.ts has finished:
 *   npx tsx scripts/import-foil-images.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { execSync } from 'child_process'
import { resolve, basename, extname } from 'path'
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

// ── Transliteration (must match upload-foil-to-storage.ts exactly) ────────────
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
  const { basename: bn, dirname: dn } = { basename: require('path').basename, dirname: require('path').dirname }
  const category = bn(dn(filepath))
  const filename = bn(filepath)
  return `${sanitize(category)}/${sanitize(filename)}`
}
function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// ── Name normalization (same as latex script) ─────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')
}
function stripColorCodes(s: string): string {
  return s.replace(/(?<=[а-яёa-z])\d{3}(?=[а-яёa-z])/g, '')
}

// ── Parse foil image filename → { code, nameKey, photoNum } ──────────────────
// Filename format: {CODE}_{Russian name part}[_{N}].ext
function parseFilename(filename: string): { code: string; nameKey: string; photoNum: number | null } | null {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')
  const match = /^([^_]+)_([А-ЯЁA-Z].+)$/.exec(noExt)
  if (!match) return null
  const code = match[1]
  let namePart = match[2]
  const numMatch = /_(\d+)$/.exec(namePart)
  const photoNum = numMatch ? parseInt(numMatch[1]) : null
  if (numMatch) namePart = namePart.slice(0, namePart.length - numMatch[0].length)
  namePart = namePart.replace(/\.*$/, '')
  return { code, nameKey: normalize(namePart), photoNum }
}

async function main() {
  console.log('Scanning foil image files...')
  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} files found`)

  // Group by article code; track head and extras
  type Group = { head: string | null; nameKey: string; extras: Array<{ num: number; path: string }> }
  const groups = new Map<string, Group>()

  for (const filepath of allFiles) {
    const parsed = parseFilename(basename(filepath))
    if (!parsed) continue
    const { code, nameKey, photoNum } = parsed
    if (!groups.has(code)) groups.set(code, { head: null, nameKey, extras: [] })
    const g = groups.get(code)!
    if (photoNum === null) {
      g.head = filepath
    } else {
      g.extras.push({ num: photoNum, path: filepath })
    }
  }
  for (const g of groups.values()) {
    g.extras.sort((a, b) => a.num - b.num)
    if (!g.head && g.extras.length > 0) g.head = g.extras.shift()!.path
  }
  console.log(`  ${groups.size} unique article codes`)

  console.log('Loading products from DB...')
  const products = await prisma.product.findMany({
    select: { id: true, name: true, imageUrl: true },
  })
  const normalizedToId = new Map<string, number>(products.map(p => [normalize(p.name), p.id]))
  const alreadyLinked = new Set(
    products.filter(p => p.imageUrl?.includes('foil-balloons')).map(p => p.id)
  )
  // Fuzzy secondary lookup (unique stripped mappings only)
  const strippedToId = new Map<string, number>()
  for (const p of products) {
    const stripped = stripColorCodes(normalize(p.name))
    if (!strippedToId.has(stripped)) {
      strippedToId.set(stripped, p.id)
    } else {
      strippedToId.delete(stripped)
    }
  }
  console.log(`  ${products.length} products loaded, ${alreadyLinked.size} already linked to foil-balloons`)

  let done = 0, noMatch = 0, skipped = 0
  const errors: string[] = []
  const entries = [...groups.entries()]
  const BATCH = 10

  console.log('Linking images to products...')
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)

    await Promise.all(batch.map(async ([code, g]) => {
      if (!g.head) return

      let productId: number | undefined = normalizedToId.get(g.nameKey)
      if (!productId) productId = strippedToId.get(stripColorCodes(g.nameKey))

      if (!productId) { noMatch++; return }
      if (alreadyLinked.has(productId)) { skipped++; return }

      const headKey = storageKey(g.head)
      const headUrl = publicUrl(headKey)
      const extraUrls = g.extras.map(e => publicUrl(storageKey(e.path)))

      try {
        await prisma.product.update({
          where: { id: productId },
          data: { imageUrl: headUrl, images: extraUrls },
        })
        done++
      } catch (e) {
        errors.push(`${code}: ${(e as Error).message.slice(0, 100)}`)
      }
    }))

    process.stdout.write(`\r  ${Math.min(i + BATCH, entries.length)}/${entries.length} codes processed`)
  }

  console.log('\n')
  console.log('── Results ──────────────────────────────────')
  console.log(`  Linked to DB:    ${done}`)
  console.log(`  No DB match:     ${noMatch}`)
  console.log(`  Already linked:  ${skipped}`)
  if (errors.length) {
    console.log(`  Errors (${errors.length}):`)
    errors.slice(0, 15).forEach(e => console.log('   ', e))
    if (errors.length > 15) console.log(`   ... and ${errors.length - 15} more`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
