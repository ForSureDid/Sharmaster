/**
 * Uploads every image from "Воздушные шары из латекса" to Supabase Storage.
 *
 * Storage key format:  {code}_{size_inches}_{product_name}[_{photo_N}].ext
 *   e.g. 612796_12_Дочка_С_Днем_Рождения_Ассорти_для_девочки_пастель_2_ст_25_шт_6.jpg
 *        150246_12_Ананас_Белый_005_пастель_2_ст_50_шт.jpg   ← head (no counter)
 *        150246_12_Ананас_Белый_005_пастель_2_ст_50_шт_1.jpg ← photo 1
 *
 * Auto-creates new buckets (products → products-2 → …) if one hits its quota.
 */

import { readFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join, basename, extname } from 'path'
import { tmpdir } from 'os'
import * as dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = resolve(process.cwd(), 'Воздушные шары из латекса')
const MAX_SIZE_PX = 1000
const BASE_BUCKET = 'products'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// ── Transliterate Cyrillic → Latin (Supabase rejects non-ASCII keys) ──────────
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

// ── Build storage key from original filename ──────────────────────────────────
// Input:  "612796_Шар_12_30_см_Дочка_С_Днем_Рождения_..._шт._6.jpg"
// Output: "612796_12_Dochka_S_Dnem_Rozhdeniya_..._sht_6.jpg"
function storageKey(filename: string): string {
  const ext = (filename.match(/\.(jpg|jpeg|png)$/i)?.[0] ?? '.jpg').toLowerCase()

  // Strip extension and trailing dots (files end with e.g. "_шт..jpg")
  let base = filename.replace(/\.(jpg|jpeg|png)$/i, '').replace(/\.+$/, '')

  // Extract trailing photo counter: _N at end (e.g. _1, _6, _10)
  const numMatch = /_(\d+)$/.exec(base)
  const photoSuffix = numMatch ? `_${numMatch[1]}` : ''
  if (numMatch) base = base.slice(0, -numMatch[0].length).replace(/\.+$/, '')

  // Split off артикул: everything before the first underscore preceding a Cyrillic capital
  const codeMatch = /^([^_]+)_([А-ЯЁ])/.exec(base)
  if (!codeMatch) return sanitize(base) + photoSuffix + ext

  const code = codeMatch[1]
  const rest = base.slice(code.length + 1) // everything after "code_"

  // Pattern: {optional Cyrillic type words}__{size_inches}_{size_cm}_см_{name}
  // e.g. "Шар_12_30_см_Дочка..." or "Шар_6_15_см_Линколун_..."
  const sizeMatch = /^(?:[А-ЯЁа-яёA-Za-z]+_)*(\d+(?:[.,]\d+)?)_\d+_см_(.+)$/.exec(rest)

  let storageBase: string
  if (sizeMatch) {
    // Standard balloon: extract inch size + name after "см_"
    storageBase = `${code}_${sizeMatch[1]}_${sizeMatch[2]}`
  } else {
    // Non-standard (sets, garlands, modeling balloons, samples…):
    // strip leading Cyrillic type words, keep the rest
    const typeMatch = /^[А-ЯЁа-яё]+(?:_[А-ЯЁа-яёA-Za-z]+)*_(.+)$/.exec(rest)
    storageBase = `${code}_${typeMatch ? typeMatch[1] : rest}`
  }

  return sanitize(translit(storageBase)) + photoSuffix + ext
}

function sanitize(s: string): string {
  return s
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')   // ASCII only after transliteration
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function ensureBucket(name: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: name, name, public: true }),
  })
  const body = await res.json() as { error?: string; message?: string }
  if (!res.ok && !body.error?.includes('already exists') && !body.message?.includes('already exists')) {
    throw new Error(`Cannot create bucket "${name}": ${JSON.stringify(body)}`)
  }
  console.log(`  Bucket "${name}" ready`)
}

class BucketFullError extends Error {
  constructor(msg: string) { super(msg); this.name = 'BucketFullError' }
}

async function uploadOnce(localPath: string, bucket: string, key: string): Promise<string> {
  const contentType = extname(localPath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
  const body = readFileSync(localPath)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (res.ok) return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`
  const text = await res.text()
  const lower = text.toLowerCase()
  if (lower.includes('limit') || lower.includes('quota') || lower.includes('exceed') || lower.includes('full')) {
    throw new BucketFullError(text)
  }
  throw new Error(text)
}

async function uploadWithRetry(localPath: string, bucket: string, key: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await uploadOnce(localPath, bucket, key)
    } catch (e) {
      if (e instanceof BucketFullError) throw e // propagate without retry
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
  throw new Error('unreachable')
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize(src: string, dest: string): void {
  execSync(`sips -Z ${MAX_SIZE_PX} "${src}" --out "${dest}" > /dev/null 2>&1`)
}

// ── List all existing keys in a bucket (paginated) ───────────────────────────
async function listBucketKeys(bucket: string): Promise<Set<string>> {
  const keys = new Set<string>()
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: '' }),
    })
    if (!res.ok) break
    const files = await res.json() as Array<{ name: string }>
    for (const f of files) keys.add(f.name)
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(IMAGES_DIR)) {
    console.error(`Folder not found: ${IMAGES_DIR}`)
    process.exit(1)
  }

  const TEMP_DIR = mkdtempSync(join(tmpdir(), 'sharmaster_latex_'))

  console.log('Scanning images...')
  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} files found`)

  let bucketSeq = 1
  let currentBucket = BASE_BUCKET
  await ensureBucket(currentBucket)

  // Skip already-uploaded files for fast resume
  console.log('Checking existing storage keys...')
  const existing = await listBucketKeys(currentBucket)
  console.log(`  ${existing.size} already in storage`)

  const BATCH = 8
  let done = 0, skipped = 0, errCount = 0
  const errList: string[] = []

  // Filter to only missing files
  const toUpload = allFiles.filter(f => !existing.has(storageKey(basename(f))))
  console.log(`  ${toUpload.length} to upload\n`)

  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH)

    await Promise.all(batch.map(async (filepath, j) => {
      const fname = basename(filepath)
      const key = storageKey(fname)
      const tempPath = join(TEMP_DIR, `${i + j}_${Date.now()}${extname(fname)}`)

      try {
        resize(filepath, tempPath)

        let uploadedUrl: string
        try {
          uploadedUrl = await uploadWithRetry(tempPath, currentBucket, key)
        } catch (e) {
          if (e instanceof BucketFullError) {
            // Rotate to next bucket (sequential — JS is single-threaded at await)
            bucketSeq++
            const next = bucketSeq === 1 ? BASE_BUCKET : `${BASE_BUCKET}-${bucketSeq}`
            console.log(`\n  ⚡ "${currentBucket}" full → creating "${next}"`)
            await ensureBucket(next)
            currentBucket = next
            uploadedUrl = await uploadWithRetry(tempPath, currentBucket, key)
          } else {
            throw e
          }
        }

        done++
        void uploadedUrl // used for side-effects only here
      } catch (e) {
        errCount++
        errList.push(`${fname}: ${(e as Error).message.slice(0, 100)}`)
      } finally {
        try { execSync(`rm -f "${tempPath}"`) } catch { /* ignore */ }
      }
    }))

    process.stdout.write(`\r  ${Math.min(i + BATCH, toUpload.length)}/${toUpload.length} | ok=${done} err=${errCount} bucket=${currentBucket}`)
  }

  rmSync(TEMP_DIR, { recursive: true, force: true })

  console.log('\n')
  console.log('── Done ──────────────────────────────────')
  console.log(`  Uploaded:     ${done}`)
  console.log(`  Errors:       ${errCount}`)
  console.log(`  Buckets used: ${bucketSeq === 1 ? 1 : bucketSeq} (${BASE_BUCKET}${bucketSeq > 1 ? ` … ${BASE_BUCKET}-${bucketSeq}` : ''})`)
  if (errList.length) {
    console.log(`\n  First ${Math.min(errList.length, 20)} errors:`)
    errList.slice(0, 20).forEach(e => console.log('   ', e))
    if (errList.length > 20) console.log(`   …and ${errList.length - 20} more`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
