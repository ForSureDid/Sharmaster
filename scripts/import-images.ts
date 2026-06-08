import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import * as dotenv from 'dotenv'
import * as xlsx from 'xlsx'

dotenv.config()

const XLSX_PATH = resolve(process.cwd(), 'All the Files with material here/PicturePrice.xlsx')
const EXTRACT_DIR = '/tmp/sharmaster_xlsx_images'
const BUCKET = 'products'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

// ── Extract xlsx zip ──────────────────────────────────────────────────────────

function extractXlsx() {
  if (!existsSync(join(EXTRACT_DIR, 'xl/media'))) {
    mkdirSync(EXTRACT_DIR, { recursive: true })
    execSync(`unzip -q "${XLSX_PATH}" -d "${EXTRACT_DIR}"`)
    console.log('Extracted xlsx to', EXTRACT_DIR)
  } else {
    console.log('Using cached extraction at', EXTRACT_DIR)
  }
}

// ── Parse drawing XML: row index → image filename ─────────────────────────────

function parseDrawing(): Map<number, string> {
  const xml = readFileSync(join(EXTRACT_DIR, 'xl/drawings/drawing1.xml'), 'utf-8')
  const relsXml = readFileSync(join(EXTRACT_DIR, 'xl/drawings/_rels/drawing1.xml.rels'), 'utf-8')

  // Build rId → filename map from rels
  const ridToFile = new Map<string, string>()
  const relPattern = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g
  let relMatch: RegExpExecArray | null
  while ((relMatch = relPattern.exec(relsXml)) !== null) {
    ridToFile.set(relMatch[1], relMatch[2])
  }

  // Build row index → image filename from drawing anchors
  const rowToImage = new Map<number, string>()
  const blocks = xml.split('<xdr:twoCellAnchor')
  for (const block of blocks.slice(1)) {
    const toIdx = block.indexOf('<xdr:to>')
    const fromPart = toIdx > 0 ? block.slice(0, toIdx) : block.slice(0, 500)
    const rowMatch = /<xdr:row>(\d+)<\/xdr:row>/.exec(fromPart)
    const ridMatch = /r:embed="(rId\d+)"/.exec(block)
    if (rowMatch && ridMatch) {
      const filename = ridToFile.get(ridMatch[1])
      if (filename) rowToImage.set(parseInt(rowMatch[1]), filename)
    }
  }
  return rowToImage
}

// ── Parse xlsx data: row index → { article, name, manufacturer } ──────────────

interface XlsxRow {
  rowIdx: number
  article: string
  name: string
  manufacturer: string
}

function parseXlsx(): XlsxRow[] {
  const wb = xlsx.readFile(XLSX_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = xlsx.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })

  const rows: XlsxRow[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const article = row[1] != null ? String(row[1]).trim() : ''
    const name = row[2] != null ? String(row[2]).trim() : ''
    if (!article || !name) continue
    rows.push({
      rowIdx: i,
      article,
      name,
      manufacturer: row[7] != null ? String(row[7]).trim() : '',
    })
  }
  return rows
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFilename(article: string): string {
  // Replace any character not safe for Supabase Storage keys (ASCII alnum, dash, underscore, dot)
  return article.replace(/[^a-zA-Z0-9\-_.]/g, '_') + '.jpg'
}

// ── Supabase Storage helpers ──────────────────────────────────────────────────

async function ensureBucket() {
  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  const body = await create.json() as { error?: string; message?: string }
  if (!create.ok && !body.error?.includes('already exists') && !body.message?.includes('already exists')) {
    throw new Error(`Failed to create bucket: ${JSON.stringify(body)}`)
  }
  console.log(create.ok ? `Created public bucket "${BUCKET}"` : `Bucket "${BUCKET}" already exists`)
}

async function uploadImage(localPath: string, storageName: string): Promise<string> {
  const body = readFileSync(localPath)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storageName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body,
  })
  if (!res.ok) throw new Error(`Upload failed for ${storageName}: ${await res.text()}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageName}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  extractXlsx()

  console.log('Parsing xlsx...')
  const xlsxRows = parseXlsx()
  console.log(`  ${xlsxRows.length} product rows`)

  console.log('Parsing drawing XML...')
  const rowToImage = parseDrawing()
  console.log(`  ${rowToImage.size} image anchors`)

  // Build article → image file path
  const articleToImage = new Map<string, string>()
  for (const row of xlsxRows) {
    const imgFile = rowToImage.get(row.rowIdx)
    if (imgFile) {
      articleToImage.set(row.article, join(EXTRACT_DIR, 'xl/media', imgFile))
    }
  }
  console.log(`  ${articleToImage.size} articles mapped to images`)

  console.log('Loading products from DB...')
  const products = await prisma.product.findMany({
    select: { id: true, name: true, imageUrl: true, manufacturer: true },
  })

  // Build name → product list (for exact match)
  const nameToProducts = new Map<string, typeof products>()
  for (const p of products) {
    const list = nameToProducts.get(p.name) ?? []
    list.push(p)
    nameToProducts.set(p.name, list)
  }
  console.log(`  ${products.length} products loaded`)

  await ensureBucket()

  let uploaded = 0, updated = 0, noMatch = 0, noImage = 0
  const errors: string[] = []

  const BATCH = 20 // concurrent uploads
  const entries = xlsxRows.filter(r => articleToImage.has(r.article))

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    await Promise.all(batch.map(async (row) => {
      const imagePath = articleToImage.get(row.article)!
      const matches = nameToProducts.get(row.name)

      if (!matches || matches.length === 0) {
        noMatch++
        return
      }

      // Prefer product with same manufacturer if multiple matches
      let product = matches[0]
      if (matches.length > 1) {
        const mfMatch = matches.find(
          p => p.manufacturer && row.manufacturer &&
               p.manufacturer.toLowerCase() === row.manufacturer.toLowerCase()
        )
        if (mfMatch) product = mfMatch
      }

      // Skip if already uploaded to our Storage
      if (product.imageUrl?.startsWith(SUPABASE_URL!)) {
        updated++ // count as done
        return
      }

      try {
        const storageName = safeFilename(row.article)
        const url = await uploadImage(imagePath, storageName)
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: url },
        })
        uploaded++
        updated++
      } catch (e) {
        errors.push(`${row.article}: ${(e as Error).message}`)
      }
    }))

    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, entries.length)}/${entries.length}`)
  }

  console.log('\n')
  console.log('── Results ──────────────────────────────')
  console.log(`  Total updated in DB:   ${updated}`)
  console.log(`  Newly uploaded:        ${uploaded}`)
  console.log(`  No DB match by name:   ${noMatch}`)
  console.log(`  No image in xlsx:      ${noImage}`)
  if (errors.length) {
    console.log(`  Errors (${errors.length}):`)
    errors.slice(0, 10).forEach(e => console.log('   ', e))
    if (errors.length > 10) console.log(`   ... and ${errors.length - 10} more`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
