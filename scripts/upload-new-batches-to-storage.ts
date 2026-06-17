/**
 * Uploads three new image batches to Supabase Storage.
 *
 * Source → Bucket (key format):
 *   "Палитра EVERTS (Малайзия)"      → latex-Everts          ({filename})
 *   "Палитра шаров Belbal (Бельгия)" → latex-Belbal          ({filename})
 *   "фото шаров"                     → foil_balloons_OptShar  ({subfolder}/{filename})
 *
 * Filenames are transliterated only (Cyrillic → Latin), not reformatted.
 * Full subfolder structure is preserved.
 * Resumes automatically (skips already-uploaded keys).
 */

import { readFileSync, rmSync, mkdtempSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join, basename, extname, relative } from 'path'
import { tmpdir } from 'os'
import * as dotenv from 'dotenv'

dotenv.config()

const BASE = resolve(process.cwd(), 'All the Files with material here')

const JOBS = [
  { dir: join(BASE, 'Палитра EVERTS (Малайзия)'),      bucket: 'latex-Everts' },
  { dir: join(BASE, 'Палитра шаров Belbal (Бельгия)'), bucket: 'latex-Belbal' },
  { dir: join(BASE, 'фото шаров'),                     bucket: 'foil_balloons_OptShar' },
]

const MAX_SIZE_PX = 1000
const BATCH = 8

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// ── Transliterate Cyrillic → Latin ────────────────────────────────────────────
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

function storageKey(imagesDir: string, filepath: string): string {
  const relPath = relative(imagesDir, filepath)
  return relPath.split('/').map(sanitize).join('/')
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

async function uploadOnce(localPath: string, bucket: string, key: string): Promise<void> {
  const contentType = extname(localPath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
  const body = readFileSync(localPath)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (!res.ok) throw new Error(await res.text())
}

async function uploadWithRetry(localPath: string, bucket: string, key: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await uploadOnce(localPath, bucket, key) }
    catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

function resize(src: string, dest: string): void {
  execSync(`sips -Z ${MAX_SIZE_PX} "${src}" --out "${dest}" > /dev/null 2>&1`)
}

async function listBucketKeys(bucket: string, prefix: string = ''): Promise<Set<string>> {
  const keys = new Set<string>()
  async function listPrefix(p: string) {
    let offset = 0
    while (true) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, offset, prefix: p }),
      })
      if (!res.ok) break
      const files = await res.json() as Array<{ name: string; id: string | null }>
      for (const f of files) {
        const fullPath = p ? `${p}/${f.name}` : f.name
        if (f.id === null) await listPrefix(fullPath)
        else keys.add(fullPath)
      }
      if (files.length < 1000) break
      offset += files.length
    }
  }
  await listPrefix(prefix)
  return keys
}

// ── Upload one job ────────────────────────────────────────────────────────────
async function runJob(dir: string, bucket: string, tempDir: string) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Source: ${dir}`)
  console.log(`  Bucket: ${bucket}`)

  const allFiles = execSync(
    `find "${dir}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} files found`)

  await ensureBucket(bucket)

  console.log('  Checking existing storage keys...')
  const existing = await listBucketKeys(bucket)
  console.log(`  ${existing.size} already in storage`)

  const toUpload = allFiles.filter(f => !existing.has(storageKey(dir, f)))
  console.log(`  ${toUpload.length} to upload\n`)

  let done = 0, errCount = 0
  const errList: string[] = []

  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH)
    await Promise.all(batch.map(async (filepath, j) => {
      const key = storageKey(dir, filepath)
      const tempPath = join(tempDir, `${Date.now()}_${i + j}${extname(filepath)}`)
      try {
        resize(filepath, tempPath)
        await uploadWithRetry(tempPath, bucket, key)
        done++
      } catch (e) {
        errCount++
        errList.push(`${basename(filepath)}: ${(e as Error).message.slice(0, 100)}`)
      } finally {
        try { execSync(`rm -f "${tempPath}"`) } catch { /* ignore */ }
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, toUpload.length)}/${toUpload.length} | ok=${done} err=${errCount}`)
  }

  console.log(`\n  ✓ Uploaded: ${done}  Errors: ${errCount}`)
  if (errList.length) {
    errList.slice(0, 20).forEach(e => console.log('   ', e))
    if (errList.length > 20) console.log(`   …and ${errList.length - 20} more`)
  }
  return { done, errCount }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const TEMP_DIR = mkdtempSync(join(tmpdir(), 'sharmaster_batches_'))
  let totalDone = 0, totalErr = 0

  try {
    for (const { dir, bucket } of JOBS) {
      const { done, errCount } = await runJob(dir, bucket, TEMP_DIR)
      totalDone += done
      totalErr += errCount
    }
  } finally {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Total uploaded: ${totalDone}`)
  console.log(`  Total errors:   ${totalErr}`)
}

main().catch(e => { console.error(e); process.exit(1) })
