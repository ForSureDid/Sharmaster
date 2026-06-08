import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join, basename, extname } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const IMAGES_DIR = resolve(process.cwd(), 'Воздушные шары из латекса')
const TEMP_DIR = '/tmp/sharmaster_latex_resized'
const BUCKET = 'products'
const MAX_SIZE_PX = 1000

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Normalize for fuzzy name matching ─────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')
}

// Strip embedded 3-digit color codes (e.g. "белый005пастель" → "белыйпастель").
// We strip exactly-3-digit sequences that appear between letters, since size/qty
// numbers (615, 100) also appear next to letters but this approach still reduces
// collisions enough for a fallback uniqueness check.
function stripColorCodes(s: string): string {
  return s.replace(/(?<=[а-яёa-z])\d{3}(?=[а-яёa-z])/g, '')
}

// ── Extract артикул, normalized product name, and photo number from filename ───
// Returns { code, nameKey, photoNum } where photoNum=null = head image
function parseFilename(filename: string): { code: string; nameKey: string; photoNum: number | null } | null {
  const noExt = filename.replace(/\.(jpg|jpeg|png)$/i, '')

  // code = everything before first underscore followed by Cyrillic/Latin capital
  const match = /^([^_]+)_([А-ЯЁA-Z].+)$/.exec(noExt)
  if (!match) return null
  const code = match[1]

  let namePart = match[2]
  // Strip trailing photo number (_1, _2 … _99)
  const numMatch = /_(\d+)$/.exec(namePart)
  const photoNum = numMatch ? parseInt(numMatch[1]) : null
  if (numMatch) namePart = namePart.slice(0, namePart.length - numMatch[0].length)
  // Strip trailing dot (files end in e.g. "_шт..")
  namePart = namePart.replace(/\.*$/, '')

  return { code, nameKey: normalize(namePart), photoNum }
}

// ── Make артикул safe for storage keys ───────────────────────────────────────
function safeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9\-_.]/g, '_')
}

// ── Resize with macOS sips ────────────────────────────────────────────────────
function resizeImage(src: string, dest: string): void {
  execSync(`sips -Z ${MAX_SIZE_PX} "${src}" --out "${dest}" > /dev/null 2>&1`)
}

// ── Ensure storage bucket exists ──────────────────────────────────────────────
async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  const body = await res.json() as { error?: string; message?: string }
  if (!res.ok && !body.error?.includes('already exists') && !body.message?.includes('already exists')) {
    throw new Error(`Failed to ensure bucket: ${JSON.stringify(body)}`)
  }
  console.log(res.ok ? `Created bucket "${BUCKET}"` : `Bucket "${BUCKET}" ready`)
}

// ── Upload one file to Supabase Storage (with 2 retries) ─────────────────────
async function upload(localPath: string, storageKey: string): Promise<string> {
  const ext = extname(localPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = readFileSync(localPath)
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storageKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body,
    })
    if (res.ok) return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`
    const text = await res.text()
    if (attempt === 2) throw new Error(text)
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }
  throw new Error('unreachable')
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Optional: pass --only=CODE1,CODE2,... to process only specific артикулы
async function main() {
  const onlyArg = process.argv.find(a => a.startsWith('--only='))
  const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null

  if (!existsSync(IMAGES_DIR)) {
    console.error(`Folder not found: ${IMAGES_DIR}`)
    process.exit(1)
  }

  mkdirSync(TEMP_DIR, { recursive: true })

  // ── Step 1: Scan all image files ───────────────────────────────────────────
  console.log('Scanning image folder...')
  const allFiles = execSync(
    `find "${IMAGES_DIR}" -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \\) | grep -v DS_Store`,
    { maxBuffer: 50 * 1024 * 1024 }
  ).toString().trim().split('\n').filter(Boolean)
  console.log(`  ${allFiles.length} image files found`)

  // ── Step 2: Group by артикул ───────────────────────────────────────────────
  type ImageGroup = { head: string | null; nameKey: string; extras: Array<{ num: number; path: string }> }
  const groups = new Map<string, ImageGroup>()

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

  // Sort extras by number; if no head image, promote lowest-numbered extra
  for (const g of groups.values()) {
    g.extras.sort((a, b) => a.num - b.num)
    if (!g.head && g.extras.length > 0) {
      g.head = g.extras.shift()!.path
    }
  }

  console.log(`  ${groups.size} unique артикулов`)

  // ── Step 3: Load DB products ───────────────────────────────────────────────
  console.log('Loading products from DB...')
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
  })
  const idToProduct = new Map<number, typeof products[0]>(products.map(p => [p.id, p]))
  const normalizedToId = new Map<string, number>(products.map(p => [normalize(p.name), p.id]))
  // Secondary lookup: DB names with color codes stripped → id (only for unique mappings)
  const strippedToId = new Map<string, number>()
  for (const p of products) {
    const stripped = stripColorCodes(normalize(p.name))
    if (!strippedToId.has(stripped)) {
      strippedToId.set(stripped, p.id)
    } else {
      strippedToId.delete(stripped) // ambiguous → don't use
    }
  }
  console.log(`  ${products.length} products loaded`)

  await ensureBucket()

  // ── Step 4: Process each артикул ──────────────────────────────────────────
  console.log(`Uploading all images (resized to ${MAX_SIZE_PX}px)...`)

  const BATCH = 5
  let done = 0, noMatch = 0
  const errors: string[] = []
  const entries = [...groups.entries()].filter(([code]) => !onlySet || onlySet.has(code))

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)

    await Promise.all(batch.map(async ([code, g]) => {
      if (!g.head) return

      // 1. Exact normalized name match
      let productId: number | undefined = normalizedToId.get(g.nameKey)

      // 2. Fuzzy: strip embedded color codes then match (e.g. "белый005пастель" → "белыйпастель")
      if (!productId) productId = strippedToId.get(stripColorCodes(g.nameKey))

      // 3. Last resort: numeric артикул == DB product id
      if (!productId) {
        const numericId = parseInt(code)
        if (!isNaN(numericId) && idToProduct.has(numericId)) productId = numericId
      }

      if (!productId) { noMatch++; return }

      const sc = safeCode(code)
      const headExt = extname(g.head).toLowerCase()

      try {
        // Head image → latex/{артикул}.ext
        const headTemp = join(TEMP_DIR, `${sc}${headExt}`)
        resizeImage(g.head, headTemp)
        const headUrl = await upload(headTemp, `latex/${sc}${headExt}`)

        // Additional images → latex/{артикул}_{N}.ext
        const extraUrls: string[] = []
        for (const extra of g.extras) {
          const ext = extname(extra.path).toLowerCase()
          const tempPath = join(TEMP_DIR, `${sc}_${extra.num}${ext}`)
          resizeImage(extra.path, tempPath)
          const url = await upload(tempPath, `latex/${sc}_${extra.num}${ext}`)
          extraUrls.push(url)
        }

        await prisma.product.update({
          where: { id: productId },
          data: { imageUrl: headUrl, images: extraUrls },
        })

        done++
      } catch (e) {
        errors.push(`${code}: ${(e as Error).message.slice(0, 100)}`)
      }
    }))

    process.stdout.write(`\r  ${Math.min(i + BATCH, entries.length)}/${entries.length} артикулов`)
  }

  rmSync(TEMP_DIR, { recursive: true, force: true })

  const totalImages = [...groups.values()].reduce((s, g) => s + 1 + g.extras.length, 0)
  console.log('\n')
  console.log('── Results ──────────────────────────────')
  console.log(`  Артикулов matched & uploaded: ${done}`)
  console.log(`  No DB match:                  ${noMatch}`)
  console.log(`  Total source images scanned:  ${totalImages}`)
  if (errors.length) {
    console.log(`  Errors (${errors.length}):`)
    errors.slice(0, 15).forEach(e => console.log('   ', e))
    if (errors.length > 15) console.log(`   ... and ${errors.length - 15} more`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
