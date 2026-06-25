/**
 * Uploads scraped Веселая Затея foil images to Supabase Storage.
 * Bucket: foil-Veselaya (created if needed, public)
 * Run: npx tsx scripts/upload-veselaya-to-storage.ts
 */

import { readFileSync, rmSync, mkdtempSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join, basename, extname } from 'path'
import { tmpdir } from 'os'
import * as dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = resolve(process.cwd(), 'scraped-sharik-veselaya')
const BUCKET = 'foil-Veselaya'
const MAX_SIZE_PX = 1000

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

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
  return translit(s).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}
function storageKey(filepath: string): string { return sanitize(basename(filepath)) }

async function ensureBucket(): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  const body = await res.json() as { error?: string; message?: string }
  if (!res.ok && !body.error?.includes('already exists') && !body.message?.includes('already exists')) {
    throw new Error(`Cannot create bucket "${BUCKET}": ${JSON.stringify(body)}`)
  }
  console.log(`  Bucket "${BUCKET}" ready`)
}

async function uploadOnce(localPath: string, key: string): Promise<void> {
  const ext = extname(localPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const body = readFileSync(localPath)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (!res.ok) throw new Error(await res.text())
}

async function uploadWithRetry(localPath: string, key: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await uploadOnce(localPath, key) } catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

function resize(src: string, dest: string): void {
  execSync(`sips -Z ${MAX_SIZE_PX} "${src}" --out "${dest}" > /dev/null 2>&1`)
}

async function listBucketKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: '' }),
    })
    if (!res.ok) break
    const files = await res.json() as Array<{ name: string; id: string | null }>
    for (const f of files) { if (f.id !== null) keys.add(f.name) }
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

async function main() {
  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 20 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)

  console.log(`Found ${allFiles.length} images in scraped-sharik-veselaya/`)
  await ensureBucket()

  console.log('Checking existing keys...')
  const existing = await listBucketKeys()
  console.log(`  ${existing.size} already uploaded`)

  const toUpload = allFiles.filter(f => !existing.has(storageKey(f)))
  console.log(`  ${toUpload.length} to upload\n`)
  if (toUpload.length === 0) { console.log('Nothing to upload.'); return }

  const TEMP_DIR = mkdtempSync(join(tmpdir(), 'sharmaster_veselaya_'))
  const BATCH = 8
  let done = 0, errCount = 0
  const errList: string[] = []

  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH)
    await Promise.all(batch.map(async (filepath, j) => {
      const key = storageKey(filepath)
      const tempPath = join(TEMP_DIR, `${i + j}_${Date.now()}${extname(filepath)}`)
      try {
        resize(filepath, tempPath)
        await uploadWithRetry(tempPath, key)
        done++
      } catch (e) {
        errCount++
        errList.push(`${basename(filepath)}: ${(e as Error).message.slice(0, 120)}`)
      } finally {
        try { execSync(`rm -f "${tempPath}"`) } catch { /* ignore */ }
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, toUpload.length)}/${toUpload.length} | ok=${done} err=${errCount}`)
  }

  rmSync(TEMP_DIR, { recursive: true, force: true })
  console.log('\n\n── Done ──────────────────────────────────')
  console.log(`  Uploaded: ${done}`)
  console.log(`  Errors:   ${errCount}`)
  if (errList.length) {
    errList.slice(0, 20).forEach(e => console.log('  ', e))
    if (errList.length > 20) console.log(`  …and ${errList.length - 20} more`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
