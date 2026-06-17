/**
 * Upload BK (БиКей/ProDecor) latex balloon photos to Supabase Storage
 * and link them to matching StockItems by article number.
 *
 * Source:  mikros_bk_photos/
 * Bucket:  latex-BK
 * Key:     BK_{transliterated_name}_{transliterated_article}.{ext}
 *
 *   npx tsx scripts/import-bk-to-storage.ts
 */

import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join, basename, extname } from 'path'
import { tmpdir } from 'os'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = resolve(process.cwd(), 'mikros_bk_photos')
const BUCKET     = 'latex-BK'
const MAX_SIZE_PX = 1000

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DIRECT_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma  = new PrismaClient({ adapter })

// ── Transliterate Cyrillic → Latin ────────────────────────────────────────────
const CYR: Record<string, string> = {
  А:'A', Б:'B', В:'V', Г:'G', Д:'D', Е:'E', Ё:'Yo', Ж:'Zh', З:'Z', И:'I', Й:'Y',
  К:'K', Л:'L', М:'M', Н:'N', О:'O', П:'P', Р:'R', С:'S', Т:'T', У:'U', Ф:'F',
  Х:'Kh', Ц:'Ts', Ч:'Ch', Ш:'Sh', Щ:'Shch', Ъ:'', Ы:'Y', Ь:'', Э:'E', Ю:'Yu', Я:'Ya',
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh', з:'z', и:'i', й:'y',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
  х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
}
function translit(s: string): string {
  return s.split('').map(c => CYR[c] ?? c).join('')
}
function sanitize(s: string): string {
  return s
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ── Build storage key from local filename ─────────────────────────────────────
// Input:  "BK_Шар12'' Пастель ассорти (100 шт./уп.) БК_ч01338.jpg"
// Output: "BK_Shar12_Pastel_assorti_100_sht_up_BK_ch01338.jpg"
function storageKey(filename: string): string {
  const ext  = extname(filename).toLowerCase() || '.jpg'
  const base = filename.slice(0, filename.length - ext.length)
  return sanitize(translit(base)) + ext
}

// Extract article from key — last _-segment before extension
// "BK_Shar12_Pastel_..._BK_ch01338.jpg" → "ch01338"
// We also try the original Cyrillic article from the filename: last _-segment of base.
function articleFromFilename(filename: string): string {
  const ext  = extname(filename)
  const base = filename.slice(0, filename.length - ext.length)
  const parts = base.split('_')
  return parts[parts.length - 1].toLowerCase()
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function ensureBucket(name: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id: name, name, public: true }),
  })
  const body = await res.json() as { error?: string; message?: string }
  if (!res.ok && !body.error?.includes('already exists') && !body.message?.includes('already exists')) {
    throw new Error(`Cannot create bucket "${name}": ${JSON.stringify(body)}`)
  }
  console.log(`  Bucket "${name}" ready`)
}

async function listBucketKeys(bucket: string): Promise<Set<string>> {
  const keys = new Set<string>()
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ limit: 1000, offset, prefix: '' }),
    })
    if (!res.ok) break
    const files = await res.json() as Array<{ name: string }>
    for (const f of files) keys.add(f.name)
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

async function uploadFile(localPath: string, key: string): Promise<void> {
  const contentType = extname(localPath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
  const body = readFileSync(localPath)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (!res.ok) throw new Error(await res.text())
}

async function uploadWithRetry(localPath: string, key: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await uploadFile(localPath, key) } catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

function resize(src: string, dest: string): void {
  execSync(`sips -Z ${MAX_SIZE_PX} "${src}" --out "${dest}" > /dev/null 2>&1`)
}

function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(IMAGES_DIR)) {
    console.error(`Folder not found: ${IMAGES_DIR}`)
    process.exit(1)
  }

  // ── Phase 1: Upload ──────────────────────────────────────────────────────────
  console.log('=== Phase 1: Upload to storage ===\n')

  await ensureBucket(BUCKET)

  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 20 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} files in ${IMAGES_DIR}`)

  console.log('  Checking existing bucket keys...')
  const existing = await listBucketKeys(BUCKET)
  console.log(`  ${existing.size} already in storage`)

  const toUpload = allFiles.filter(f => !existing.has(storageKey(basename(f))))
  console.log(`  ${toUpload.length} to upload\n`)

  const TEMP = join(tmpdir(), `bk_upload_${Date.now()}`)
  execSync(`mkdir -p "${TEMP}"`)

  const BATCH = 6
  let uploaded = 0, errCount = 0
  const errList: string[] = []

  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH)
    await Promise.all(batch.map(async (filepath, j) => {
      const fname   = basename(filepath)
      const key     = storageKey(fname)
      const tmpPath = join(TEMP, `${i + j}_${Date.now()}${extname(fname)}`)
      try {
        resize(filepath, tmpPath)
        await uploadWithRetry(tmpPath, key)
        uploaded++
      } catch (e) {
        errCount++
        errList.push(`${fname}: ${(e as Error).message.slice(0, 120)}`)
      } finally {
        try { execSync(`rm -f "${tmpPath}"`) } catch { /* ignore */ }
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, toUpload.length)}/${toUpload.length} | ok=${uploaded} err=${errCount}`)
  }

  execSync(`rm -rf "${TEMP}"`)
  console.log('\n')
  console.log(`  Uploaded: ${uploaded}`)
  console.log(`  Skipped:  ${existing.size}`)
  console.log(`  Errors:   ${errCount}`)
  if (errList.length) errList.slice(0, 10).forEach(e => console.log('   ', e))

  // ── Phase 2: Link to StockItems by article ───────────────────────────────────
  console.log('\n=== Phase 2: Link images to StockItems ===\n')

  // Rebuild key set (include previously existing + newly uploaded)
  const allKeys = await listBucketKeys(BUCKET)
  console.log(`  ${allKeys.size} total keys in bucket`)

  // Build article → key map (case-insensitive article, key without extension)
  // Article is the last _-segment of the key before extension
  const articleToKey = new Map<string, string>()
  for (const key of allKeys) {
    const noExt = key.replace(/\.(jpg|jpeg|png)$/i, '')
    const parts  = noExt.split('_')
    const art    = parts[parts.length - 1].toLowerCase()
    if (art) articleToKey.set(art, key)
  }
  console.log(`  ${articleToKey.size} unique articles in bucket`)

  // Load StockItems — prefer brand=БиКей or items without imageUrl from BK article range
  const stockItems = await prisma.stockItem.findMany({
    where: { article: { not: null } },
    select: { id: true, article: true, imageUrl: true, name: true },
  })
  console.log(`  ${stockItems.length} StockItems with articles`)

  let linked = 0, alreadyHas = 0, noMatch = 0
  const linkErrors: string[] = []

  for (const item of stockItems) {
    if (item.imageUrl) { alreadyHas++; continue }
    // Transliterate the DB article so it matches the bucket key's transliterated article
    const art = sanitize(translit(item.article!)).toLowerCase()
    const key = articleToKey.get(art)
    if (!key) { noMatch++; continue }
    try {
      await prisma.stockItem.update({
        where: { id: item.id },
        data:  { imageUrl: publicUrl(key) },
      })
      linked++
    } catch (e) {
      linkErrors.push(`id=${item.id}: ${(e as Error).message.slice(0, 80)}`)
    }
  }

  console.log(`  Linked:           ${linked}`)
  console.log(`  Already had image: ${alreadyHas}`)
  console.log(`  No match:         ${noMatch}`)
  if (linkErrors.length) {
    console.log(`  Errors: ${linkErrors.length}`)
    linkErrors.slice(0, 10).forEach(e => console.log('   ', e))
  }

  console.log('\n── Done ──────────────────────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
