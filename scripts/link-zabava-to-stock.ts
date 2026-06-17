/**
 * Links Zabava images from latex-balloons/Zabava/ to StockItems (brand=Забава).
 *
 * Match strategy: extract the code before "ЗАБАВА" in the item name, normalize
 * (translit + remove non-alphanumeric + lowercase), then match against the
 * normalized first segment of each storage key filename.
 *
 * Handles dual-code names like "R12 H02/H20" or "ШДМ 260 K1/800" by trying
 * the full concat first, then stripping after "/".
 *
 * Run: npx tsx scripts/link-zabava-to-stock.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const BUCKET = 'latex-balloons'
const FOLDER = 'Zabava'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

// "Zabava/R12S105_R_12_ZABAVA_..._50sht.jpg" → "r12s105"
function articleFromKey(key: string): string {
  const filename = key.replace(`${FOLDER}/`, '')
  return normalize(filename.split('_')[0])
}

// "R12 H02/H20 ЗАБАВА ..." → ["r12h02h20", "r12h02"]
// "R 18 H19/760 ЗАБАВА ..." → ["r18h19760", "r18h19"]
// "ШДМ 260 S105 ЗАБАВА ..."  → ["shdm260s105"]
function codeCandidates(name: string): string[] {
  const beforeZabava = name.split(/ЗАБАВА/i)[0].replace(/[."'\s]+$/, '').trim()
  const full = normalize(beforeZabava)
  // Also try stripping after first "/"" occurrence (old/secondary codes)
  const slashNorm = normalize(beforeZabava.split('/')[0].trim())
  const candidates = [full]
  if (slashNorm && slashNorm !== full) candidates.push(slashNorm)
  return candidates
}

function publicUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

async function listZabavaKeys(): Promise<string[]> {
  const keys: string[] = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: FOLDER }),
    })
    if (!res.ok) { console.error('Storage list failed:', await res.text()); break }
    const files = await res.json() as Array<{ name: string; id: string | null }>
    for (const f of files) {
      if (f.id !== null) keys.push(`${FOLDER}/${f.name}`)
    }
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

async function main() {
  console.log(`Fetching keys from ${BUCKET}/${FOLDER}/...`)
  const allKeys = await listZabavaKeys()
  console.log(`  ${allKeys.length} files in storage`)

  // Build lookup: normalized_article → public_url
  const articleToUrl = new Map<string, string>()
  for (const key of allKeys) {
    articleToUrl.set(articleFromKey(key), publicUrl(key))
  }

  console.log('\nLoading Забава StockItems...')
  const items = await prisma.stockItem.findMany({
    where: { brand: { contains: 'забав', mode: 'insensitive' } },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  })
  console.log(`  ${items.length} total, ${items.filter(i => !i.imageUrl).length} without imageUrl`)

  const toUpdate = items.filter(i => !i.imageUrl)

  let linked = 0, noMatch = 0
  const matched: string[] = []
  const unmatched: string[] = []

  const BATCH = 10
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    await Promise.all(batch.map(async item => {
      const candidates = codeCandidates(item.name)
      let url: string | undefined
      for (const code of candidates) {
        url = articleToUrl.get(code)
        if (url) break
      }

      if (!url) {
        noMatch++
        unmatched.push(item.name)
        return
      }

      await prisma.stockItem.update({ where: { id: item.id }, data: { imageUrl: url } })
      linked++
      matched.push(`"${item.name.slice(0, 55)}" → ${url.split('/').pop()}`)
    }))
  }

  console.log('\n── Results ───────────────────────────────────')
  console.log(`  Linked:   ${linked}`)
  console.log(`  No match: ${noMatch}`)

  if (matched.length) {
    console.log(`\n  Sample matches (first 20):`)
    matched.slice(0, 20).forEach(m => console.log('   ', m))
  }
  if (unmatched.length) {
    console.log(`\n  Unmatched (first 20):`)
    unmatched.slice(0, 20).forEach(u => console.log('   ', u))
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
