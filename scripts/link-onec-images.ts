/**
 * Links OnecStockItem rows (1C CommerceML sync — see prisma/schema.prisma) to product
 * photos already sitting in Supabase Storage, matched by `article` (trimmed).
 *
 * Scans all image buckets found in Storage (17 total minus "1c-exchange", which holds
 * the CommerceML XML payload, not images). Each bucket has its own filename convention —
 * the per-bucket `extract()` functions below are adapted from the existing
 * scripts/link-<brand>-to-stock.ts scripts (see comments per bucket for the source).
 * latex-Sempertex and latex-BK are NOT scanned: investigation
 * (scripts/check-onec-images-investigate.ts) found their filenames use manufacturer SKU
 * codes (e.g. "LOL6SM000", "Ch47423") that never match any OnecStockItem.article value —
 * 0 matches, not worth the scan.
 *
 * Buckets are scanned in size-descending order; the FIRST bucket that has a code
 * matching a given article wins. Conflicts (article found in >1 bucket) are counted
 * and a sample is printed — not silently resolved.
 *
 * Preview (no writes):  npx tsx scripts/link-onec-images.ts
 * Apply:                npx tsx scripts/link-onec-images.ts --apply
 *
 * Backup (written on --apply before any update, one row per OnecStockItem that gets
 * touched): scripts/backup-onec-stockitems-images.json
 * Revert: restore imageUrl/images per id from that backup (same pattern as
 * scripts/revert-agura-digits.ts / revert-partydeco.ts).
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'
dotenv.config()

const APPLY = process.argv.includes('--apply')
const BACKUP_PATH = resolve(process.cwd(), 'scripts/backup-onec-stockitems-images.json')

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DATABASE_URL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL in .env')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const IMG_EXT = /\.(jpg|jpeg|png|webp)$/i

function publicUrl(bucket: string, key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`
}

// ── Storage listing (recursive — Storage list() is non-recursive; several buckets
//    (foil-balloons, latex-balloons, partydeco, Tovary-dlya-prazdnika,
//    donballon-novelties) store files under subfolders, which come back as
//    entries with id:null that must be recursed into) ──────────────────────────
async function listOneLevel(bucket: string, prefix: string): Promise<Array<{ name: string; id: string | null }>> {
  const out: Array<{ name: string; id: string | null }> = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix }),
    })
    if (!res.ok) { console.error(`  list failed for ${bucket} prefix="${prefix}":`, await res.text()); break }
    const files = await res.json() as Array<{ name: string; id: string | null }>
    out.push(...files)
    if (files.length < 1000) break
    offset += files.length
  }
  return out
}

async function listAllKeys(bucket: string, prefix = '', depth = 0): Promise<string[]> {
  if (depth > 6) return []
  const entries = await listOneLevel(bucket, prefix)
  const keys: string[] = []
  for (const e of entries) {
    const full = prefix ? `${prefix}${e.name}` : e.name
    if (e.id !== null) keys.push(full)
    else keys.push(...await listAllKeys(bucket, `${full}/`, depth + 1))
  }
  return keys
}

// ── Per-bucket code extraction ──────────────────────────────────────────────
// Each extract() takes the file's basename (no folder path) with extension still
// attached, and returns { code, ordinal } or null to skip. ordinal 0 = head image
// (becomes imageUrl); ordinal > 0 = extra, sorted ascending into images[].
type Extracted = { code: string; ordinal: number }
type BucketConfig = { name: string; extract: (basename: string) => Extracted | null }

const SHARIK_CODE = /^(\d{4}-\d{4})$/

// foil-balloons / latex-balloons: uploaded by import-latex-images.ts family.
// Basename e.g. "123029_Shar_18_46_sm_Serdtse_Tiffani_1_sht..jpg" (head) /
// "..._1.jpg" (extra). Code = leading digit run before first "_" (matches
// scripts/link-foil-to-stock.ts: "article = first segment of filename before '_'").
function extractLeadingSegment(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^([A-Za-z0-9]+)_/.exec(noExt)
  const code = m ? m[1] : (IMG_EXT.test(basename) ? noExt : null)
  if (!code) return null
  const ordM = /_(\d+)$/.exec(noExt)
  return { code, ordinal: ordM ? parseInt(ordM[1], 10) : 0 }
}

// Servirovka-stola: "{article}_{name}_{seq}.jpg" (link-servirovka-to-stock.ts).
function extractLeadingDigits(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^(\d+)_/.exec(noExt)
  if (!m) return null
  const ordM = /_(\d+)$/.exec(noExt)
  return { code: m[1], ordinal: ordM ? parseInt(ordM[1], 10) : 0 }
}

// foil-Veselaya / foil-Anagram / foil-Grabo / foil-Betalic / latex-Everts: single
// canonical image per code, code = last underscore-segment before extension, must
// look like a sharik.ru code (link-veselaya/anagram/betalic/everts-to-stock.ts,
// relink-grabo-to-stock.ts). No extras convention in the source scripts, so always
// ordinal 0 (imageUrl only, images stays []).
function extractLastSharikSegment(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const last = noExt.split('_').pop()!
  return SHARIK_CODE.test(last) ? { code: last, ordinal: 0 } : null
}

// latex-Belbal: "..._{code}.jpg" — last NNNN-NNNN anywhere at the end of the
// basename (link-belbal-to-stock.ts). Single image, no extras.
function extractTrailingSharikCode(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /(\d{4}-\d{4})$/.exec(noExt)
  return m ? { code: m[1], ordinal: 0 } : null
}

// lenyu-bantyu: "{code}_{name}...jpg", code alnum, head has no trailing _N, extras do
// (link-lentu-banty-to-stock.ts).
function extractAlnumLeadingSegment(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^([A-Za-z0-9]+)_/.exec(noExt)
  if (!m) return null
  const ordM = /_(\d+)$/.exec(noExt)
  return { code: m[1], ordinal: ordM ? parseInt(ordM[1], 10) : 0 }
}

// Tovary-dlya-prazdnika: code = filename minus extension minus optional trailing
// "_{n}" (lib/prazdnik-groups.ts listBucketGroups: base.match(/^(.+)_(\d+)$/)).
function extractPrazdnikStyle(basename: string): Extracted | null {
  if (!IMG_EXT.test(basename)) return null
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^(.+)_(\d+)$/.exec(noExt)
  return m ? { code: m[1], ordinal: parseInt(m[2], 10) } : { code: noExt, ordinal: 0 }
}

// partydeco (under images/): head = "{code}.jpg", extras = "{code}_{n}.jpg"
// (original scripts/link-partydeco-to-stock.ts convention, applied directly to the
// bucket listing since the local scrape dir isn't the source of truth here).
const extractPartydecoStyle = extractPrazdnikStyle // identical convention

// donballon-novelties (under images/): head = "{code}_hd.png", extras "{code}_{n}.ext"
// — small bucket (70 objects, 7 onec matches at investigation time), best-effort.
function extractNoveltiesStyle(basename: string): Extracted | null {
  if (!IMG_EXT.test(basename)) return null
  const noExt = basename.replace(IMG_EXT, '')
  const m = /^(.+)_(hd|\d+)$/.exec(noExt)
  if (!m) return { code: noExt, ordinal: 0 }
  return { code: m[1], ordinal: m[2] === 'hd' ? 0 : parseInt(m[2], 10) }
}

// foil_balloons_OptShar: no clean per-file convention (raw transliterated filenames,
// folder structure preserved) — fallback: sharik NNNN-NNNN code anywhere in the
// basename. Single image, first key found wins.
function extractSharikCodeAnywhere(basename: string): Extracted | null {
  const noExt = basename.replace(IMG_EXT, '')
  const m = /(\d{4}-\d{4})/.exec(noExt)
  return m ? { code: m[1], ordinal: 0 } : null
}

// Scan order = priority order for conflict resolution (first match wins).
//
// IMPORTANT: this is ordered by extractor *strictness*, not bucket size. An early
// spot-check (article "1103-2394", name "Belbal Шар с рисунком 14" Пиксели") found
// size-descending order picks the wrong bucket: partydeco's loose extractor (accepts
// any basename as a code, no shape validation) happened to also contain a file
// literally named "1103-2394.jpg" — a different, unrelated product — and being a
// bigger bucket it would win over the correct latex-Belbal match. Confirmed on 5
// sampled conflicts (1103-2394, 1103-3170/3148/3150, 1207-5437, 1202-4082,
// 1207-6011, 1209-0036) that every OnecStockItem.name brand hint ("Belbal", "Б"=
// Betalic, "К"=Veselaya, "А"=Anagram, "ПД"=PartyDeco) matches whichever bucket used
// a *pattern-validated* extractor (requires the code to look like NNNN-NNNN), never
// the loose/anywhere-in-string ones. So: strict-pattern brand buckets first, then
// anchored-at-start "real article prefix" buckets, then loose/whole-basename
// buckets, then the anywhere-in-string fallback (foil_balloons_OptShar) last.
const BUCKETS: BucketConfig[] = [
  // STRICT — code must match sharik.ru NNNN-NNNN shape; curated per-brand bucket.
  { name: 'latex-Belbal', extract: extractTrailingSharikCode },
  { name: 'foil-Anagram', extract: extractLastSharikSegment },
  { name: 'foil-Grabo', extract: extractLastSharikSegment },
  { name: 'foil-Veselaya', extract: extractLastSharikSegment },
  { name: 'latex-Everts', extract: extractLastSharikSegment },
  { name: 'foil-Betalic', extract: extractLastSharikSegment },
  // SEMI — code = digit/alnum run anchored at the very start of the filename
  // (the uploader encoded the real article there; reliable by construction).
  { name: 'foil-balloons', extract: extractLeadingSegment },
  { name: 'latex-balloons', extract: extractLeadingSegment },
  { name: 'Servirovka-stola', extract: extractLeadingDigits },
  { name: 'lenyu-bantyu', extract: extractAlnumLeadingSegment },
  // LOOSE — whole basename accepted as code, no shape check.
  { name: 'Tovary-dlya-prazdnika', extract: extractPrazdnikStyle },
  { name: 'partydeco', extract: extractPartydecoStyle },
  { name: 'donballon-novelties', extract: extractNoveltiesStyle },
  // LOOSEST — sharik-code searched anywhere in the string, unanchored.
  { name: 'foil_balloons_OptShar', extract: extractSharikCodeAnywhere },
]

type Group = { head: string; extras: string[] } // storage keys
type BucketGroups = Map<string, Group> // code -> group

async function scanBucket(cfg: BucketConfig): Promise<BucketGroups> {
  const keys = await listAllKeys(cfg.name)
  const imgKeys = keys.filter(k => IMG_EXT.test(k))
  const byCode = new Map<string, Array<{ key: string; ordinal: number }>>()
  for (const key of imgKeys) {
    const basename = key.split('/').pop()!
    const ex = cfg.extract(basename)
    if (!ex) continue
    if (!byCode.has(ex.code)) byCode.set(ex.code, [])
    byCode.get(ex.code)!.push({ key, ordinal: ex.ordinal })
  }
  const groups: BucketGroups = new Map()
  for (const [code, items] of byCode) {
    items.sort((a, b) => a.ordinal - b.ordinal)
    groups.set(code, { head: items[0].key, extras: items.slice(1).map(i => i.key) })
  }
  console.log(`  ${cfg.name}: ${keys.length} objects, ${imgKeys.length} images, ${groups.size} distinct codes`)
  return groups
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes DB)' : 'PREVIEW (no writes)'}\n`)

  console.log('Scanning buckets (recursive)...')
  const perBucket = new Map<string, BucketGroups>()
  for (const cfg of BUCKETS) {
    perBucket.set(cfg.name, await scanBucket(cfg))
  }

  console.log('\nLoading OnecStockItem rows with article...')
  const onecRows = await prisma.onecStockItem.findMany({
    where: { article: { not: null } },
    select: { id: true, article: true, imageUrl: true, images: true },
  })
  console.log(`  ${onecRows.length} rows (${new Set(onecRows.map(r => r.article!.trim())).size} unique articles)`)

  // article -> winning {bucket, head, extras}, first bucket in BUCKETS order wins
  type Winner = { bucket: string; head: string; extras: string[] }
  const winners = new Map<string, Winner>()
  const conflictArticles = new Map<string, string[]>() // article -> all buckets that had a code match

  const allArticles = new Set(onecRows.map(r => r.article!.trim()).filter(Boolean))
  for (const article of allArticles) {
    const matchedBuckets: string[] = []
    for (const cfg of BUCKETS) {
      const group = perBucket.get(cfg.name)!.get(article)
      if (group) {
        matchedBuckets.push(cfg.name)
        if (!winners.has(article)) {
          winners.set(article, { bucket: cfg.name, head: publicUrl(cfg.name, group.head), extras: group.extras.map(k => publicUrl(cfg.name, k)) })
        }
      }
    }
    if (matchedBuckets.length > 1) conflictArticles.set(article, matchedBuckets)
  }

  console.log(`\nUnique articles matched: ${winners.size} / ${allArticles.size}`)
  console.log(`Articles matched in >1 bucket (first-in-priority-order wins): ${conflictArticles.size}`)
  if (conflictArticles.size) {
    console.log('  Sample conflicts (article: buckets, winner marked *):')
    ;[...conflictArticles.entries()].slice(0, 15).forEach(([a, buckets]) => {
      console.log(`    ${a}: ${buckets.map((b, i) => i === 0 ? `*${b}` : b).join(', ')}`)
    })
  }

  // Per-bucket win counts
  const winsByBucket = new Map<string, number>()
  for (const w of winners.values()) winsByBucket.set(w.bucket, (winsByBucket.get(w.bucket) ?? 0) + 1)
  console.log('\nWins by bucket:')
  for (const cfg of BUCKETS) console.log(`  ${cfg.name}: ${winsByBucket.get(cfg.name) ?? 0}`)

  // Build per-row plan
  type Plan = { id: number; article: string; oldImageUrl: string | null; oldImages: string[]; win: Winner }
  const plans: Plan[] = []
  for (const row of onecRows) {
    const article = row.article!.trim()
    const win = winners.get(article)
    if (!win) continue
    plans.push({ id: row.id, article, oldImageUrl: row.imageUrl, oldImages: row.images, win })
  }
  const replacing = plans.filter(p => p.oldImageUrl).length
  console.log(`\nRows to update: ${plans.length} (already had a non-null imageUrl: ${replacing})`)

  console.log('\nSample plan (first 15):')
  plans.slice(0, 15).forEach(p => console.log(
    `  id=${p.id} article="${p.article}" [${p.win.bucket}] head=${p.win.head.split('/').pop()} extras=${p.win.extras.length}`
  ))

  const unmatchedCount = allArticles.size - winners.size
  console.log(`\nArticles with zero matches anywhere: ${unmatchedCount}`)

  if (!APPLY) {
    console.log('\nPreview only. Re-run with --apply to write.')
    await prisma.$disconnect()
    return
  }

  // ── Backup ──
  const backup = plans.map(p => ({ id: p.id, article: p.article, imageUrl: p.oldImageUrl, images: p.oldImages }))
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2))
  console.log(`\nBackup written: ${BACKUP_PATH} (${backup.length} rows)`)

  // ── Apply ──
  let updated = 0
  const errors: string[] = []
  const BATCH = 20
  for (let i = 0; i < plans.length; i += BATCH) {
    const batch = plans.slice(i, i + BATCH)
    await Promise.all(batch.map(async p => {
      try {
        await prisma.onecStockItem.update({
          where: { id: p.id },
          data: { imageUrl: p.win.head, images: p.win.extras },
        })
        updated++
      } catch (e) {
        errors.push(`id=${p.id} [${p.article}]: ${(e as Error).message.slice(0, 100)}`)
      }
    }))
    process.stdout.write(`\r  ${Math.min(i + BATCH, plans.length)}/${plans.length}`)
  }

  console.log('\n\n── Done ─────────────────────────────────')
  console.log(`  Rows updated: ${updated}`)
  console.log(`  Errors:       ${errors.length}`)
  errors.slice(0, 20).forEach(e => console.log('  ERR:', e))

  // ── Verify ──
  const ids = plans.map(p => p.id)
  let withImg = 0
  for (let i = 0; i < ids.length; i += 5000) {
    const chunk = ids.slice(i, i + 5000)
    const after = await prisma.onecStockItem.count({ where: { id: { in: chunk }, imageUrl: { not: null } } })
    withImg += after
  }
  const totalWithImg = await prisma.onecStockItem.count({ where: { imageUrl: { not: null } } })
  console.log(`  Verify: ${withImg}/${ids.length} planned rows now have imageUrl set`)
  console.log(`  Verify: ${totalWithImg} OnecStockItem rows total now have imageUrl (of ${onecRows.length} with article, ${await prisma.onecStockItem.count()} total)`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
