/**
 * Links Belbal balloon images (latex-Belbal bucket) to StockItems by code.
 *
 * DB item name:   "В 105/083 Металлик Экстра Lime Green"
 *   → code:       "В 105/083"  → normalized: "v105083"
 *
 * Storage key:    "V_105_083_Metallik_Ekstra_Lime_Green.jpg"
 *   → code stem:  "V_105_083"  → normalized: "v105083"
 *
 * Match: normalize(DB code) === normalize(storage key code prefix)
 *
 * Safe to re-run: skips items that already have imageUrl.
 *
 * npx tsx scripts/link-belbal-to-stock.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'latex-Belbal'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DIRECT_URL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DIRECT_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

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
function normalize(s: string): string {
  return translit(s).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

// "В 105/023 Пастель Экстра Sky Blue" → "105023"  (digits only from the code prefix)
// "В 350/234 Металлик..."             → "350234"
function extractDbCode(name: string): string | null {
  // Code pattern: 1-4 Cyrillic/Latin letters + whitespace + digits + "/" + digits
  const m = /^[А-Яа-яA-Za-z]{1,4}\s+(\d+)\s*\/\s*(\d+)/.exec(name.trim())
  return m ? m[1] + m[2] : null
}

// "105-023"                           → "105023"  (two groups joined)
// "105041_Kristall_Ekstra_Bubble_Red" → "105041"  (single leading group)
// Storage keys have either hyphen-separated or merged digit codes.
function extractKeyCode(stem: string): string | null {
  const m = /^(\d+)(?:[-_](\d+))?/.exec(stem)
  if (!m) return null
  const first = m[1]
  const second = m[2] ?? ''
  // If second group starts with 0 or first+second = 6 digits, it's part of the code
  // Otherwise (e.g. "_20_Ekstra"), only first group is the code
  const combined = first + second
  if (second && (second.startsWith('0') || combined.length <= 7)) return combined
  return first
}

function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
}

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = []
  async function recurse(prefix: string) {
    let offset = 0
    while (true) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, offset, prefix }),
      })
      if (!res.ok) { console.error('Storage list failed:', await res.text()); break }
      const files = await res.json() as Array<{ name: string; id: string | null }>
      for (const f of files) {
        const fullPath = prefix ? `${prefix}/${f.name}` : f.name
        if (f.id === null) await recurse(fullPath)   // folder → recurse
        else keys.push(fullPath)
      }
      if (files.length < 1000) break
      offset += files.length
    }
  }
  await recurse('')
  return keys
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`)
  console.log(`\nFetching keys from "${BUCKET}" bucket...`)

  const allKeys = await listAllKeys()
  console.log(`  ${allKeys.length} files in storage`)

  if (allKeys.length === 0) {
    console.error('No files found — check bucket name or credentials.')
    return
  }

  // Show sample keys so the user can verify the format
  console.log('\nSample keys:')
  allKeys.slice(0, 8).forEach(k => console.log('   ', k))

  // Build map: normalizedCode → key
  const codeToKey = new Map<string, string>()
  const ambiguous = new Set<string>()

  for (const key of allKeys) {
    const filename = key.split('/').pop()!
    const stem = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '')
    const keyCode = extractKeyCode(stem)
    if (!keyCode) continue

    const norm = normalize(keyCode)
    if (codeToKey.has(norm) && codeToKey.get(norm) !== key) {
      ambiguous.add(norm)
    } else {
      codeToKey.set(norm, key)
    }
  }

  console.log(`\n  ${codeToKey.size} unique code groups extracted from storage`)
  if (ambiguous.size) console.log(`  ${ambiguous.size} ambiguous codes (multiple files per code, first kept)`)

  // Sample of extracted codes
  console.log('\nSample code extractions from storage:')
  let n = 0
  for (const [code, key] of codeToKey) {
    if (n++ >= 5) break
    console.log(`   ${code.padEnd(12)} ← ${key.split('/').pop()}`)
  }

  console.log('\nLoading Belbal StockItems...')
  const items = await prisma.stockItem.findMany({
    where: {
      brand: { contains: 'belbal', mode: 'insensitive' },
      imageUrl: null,
    },
    select: { id: true, name: true, brand: true },
    orderBy: { name: 'asc' },
  })
  console.log(`  ${items.length} Belbal items without imageUrl`)

  let linked = 0, noCode = 0, noMatch = 0
  const matched: string[] = []
  const unmatched: string[] = []

  const BATCH = 10
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const dbCode = extractDbCode(item.name)
      if (!dbCode) { noCode++; return }

      const normCode = normalize(dbCode)
      const key = codeToKey.get(normCode)

      if (!key) {
        noMatch++
        unmatched.push(`"${item.name.slice(0, 70)}"  [norm="${normCode}"]`)
        return
      }

      matched.push(`"${item.name.slice(0, 55)}"  →  ${key.split('/').pop()}`)

      if (!DRY_RUN) {
        await prisma.stockItem.update({
          where: { id: item.id },
          data: { imageUrl: publicUrl(key), images: [] },
        })
      }
      linked++
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length} processed`)
  }

  console.log('\n\n── Results ─────────────────────────────────────────')
  console.log(`  Linked:           ${linked}`)
  console.log(`  No match in storage: ${noMatch}`)
  console.log(`  No code in name:  ${noCode}`)

  if (matched.length) {
    console.log(`\nSample matches (first 20):`)
    matched.slice(0, 20).forEach(m => console.log('   ', m))
  }
  if (unmatched.length) {
    console.log(`\nUnmatched (first 20):`)
    unmatched.slice(0, 20).forEach(u => console.log('   ', u))
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written to DB. Re-run without --dry-run to apply.')
  } else {
    console.log(`\nDone. ${linked} items updated.`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
