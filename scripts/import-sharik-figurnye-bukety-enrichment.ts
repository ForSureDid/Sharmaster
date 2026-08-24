// Enriches OnecStockItem rows (brand/occasion/color/weightGrams/lengthMm/widthMm/heightMm)
// from a sharik.ru category scrape, matched by exact `article` equality.
//
// Source: scraped-sharik-figurnye-bukety/raw.jsonl (+ event.jsonl merged in by numeric `id`)
// Match key: raw['Артикул'] === OnecStockItem.article (exact string match)
//
// Rules:
//  - Only write a column when the current DB value is NULL/empty AND the scraped value is non-empty.
//    Never overwrite an existing value.
//  - Skip articles that match more than one OnecStockItem row (ambiguous — logged, not touched).
//  - Skip articles with no DB match at all (logged to a not-found CSV).
//  - weightGrams: parse "38.0 Г" (optionally with a "(брутто)" suffix, defensively stripped) -> 38 (rounded int)
//  - lengthMm/widthMm/heightMm: parse "19.0x9.0x0.2 см" as Length x Width x Height in cm -> mm (x10), rounded int.
//    If the value isn't exactly 3 numbers separated by 'x', skip those 3 columns for that row and log it.
//
// Usage:
//   npx tsx scripts/import-sharik-figurnye-bukety-enrichment.ts --dry-run   # report only, no writes
//   npx tsx scripts/import-sharik-figurnye-bukety-enrichment.ts             # apply updates
//
// Resumable/idempotent: re-running is always safe — once a column is filled it's never touched again,
// so a second run naturally applies zero further changes to already-updated rows (aside from newly
// matched rows if the DB gains more matching articles later).

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const RAW_PATH = '/Users/bmm/sharmaster.kz/scraped-sharik-figurnye-bukety/raw.jsonl'
const EVENT_PATH = '/Users/bmm/sharmaster.kz/scraped-sharik-figurnye-bukety/event.jsonl'
const NOT_FOUND_CSV = '/Users/bmm/sharmaster.kz/scratchpad/sharik-figurnye-not-found.csv'
const BACKUP_PATH = '/Users/bmm/sharmaster.kz/scratchpad/sharik-figurnye-backup-before-enrichment.json'
const UNPARSED_SIZE_LOG = '/Users/bmm/sharmaster.kz/scratchpad/sharik-figurnye-unparsed-sizes.csv'

const DRY_RUN = process.argv.includes('--dry-run')
const CHUNK_SIZE = 200

type RawRow = {
  id: number
  ['Название']?: string
  ['Артикул']?: string
  ['Цвет фольга']?: string
  ['Торговая марка']?: string
  ['Вес брутто']?: string
  ['Размер']?: string
}

function parseWeightGrams(raw: string | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  // e.g. "38.0 Г", defensively also handle a "(брутто)" suffix like the box-level fields carry
  const m = s.match(/([\d.]+)\s*Г/i)
  if (!m) return null
  const val = parseFloat(m[1])
  if (Number.isNaN(val)) return null
  return Math.round(val)
}

function parseSizeMm(raw: string | undefined): { l: number; w: number; h: number } | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  // e.g. "19.0x9.0x0.2 см" -> Length x Width x Height in cm
  const cleaned = s.replace(/см/i, '').trim()
  const parts = cleaned.split(/x/i).map((p) => p.trim())
  if (parts.length !== 3) return null
  const nums = parts.map((p) => parseFloat(p))
  if (nums.some((n) => Number.isNaN(n))) return null
  const [lCm, wCm, hCm] = nums
  return {
    l: Math.round(lCm * 10),
    w: Math.round(wCm * 10),
    h: Math.round(hCm * 10),
  }
}

async function main() {
  const rawLines = fs.readFileSync(RAW_PATH, 'utf-8').trim().split('\n')
  const raw: RawRow[] = rawLines.map((l) => JSON.parse(l))

  const eventLines = fs.readFileSync(EVENT_PATH, 'utf-8').trim().split('\n')
  const eventById = new Map<number, string>()
  for (const line of eventLines) {
    const d = JSON.parse(line)
    eventById.set(d.id, (d['Событие'] || '').trim())
  }

  const merged = raw.map((r) => ({
    ...r,
    occasion: (eventById.get(r.id) || '').trim(),
  }))

  console.log(`Scraped rows: ${merged.length}`)

  const articles = merged.map((r) => r['Артикул']).filter((a): a is string => !!a)

  const dbRows = await prisma.onecStockItem.findMany({
    where: { article: { in: articles } },
    select: {
      id: true,
      article: true,
      name: true,
      brand: true,
      occasion: true,
      color: true,
      weightGrams: true,
      lengthMm: true,
      widthMm: true,
      heightMm: true,
    },
  })

  const byArticle = new Map<string, typeof dbRows>()
  for (const row of dbRows) {
    if (!row.article) continue
    if (!byArticle.has(row.article)) byArticle.set(row.article, [])
    byArticle.get(row.article)!.push(row)
  }

  const duplicatedArticles: string[] = []
  const notFoundRows: RawRow[] = []
  const unparsedSizeRows: { article: string; name: string; size: string }[] = []

  // Per-row planned update, keyed by DB row id
  type Plan = {
    dbId: number
    article: string
    dbName: string
    scrapedName: string
    data: Record<string, string | number>
    before: Record<string, unknown>
  }
  const plans: Plan[] = []

  const fieldCounts = {
    brand: 0,
    occasion: 0,
    color: 0,
    weightGrams: 0,
    lengthMm: 0,
    widthMm: 0,
    heightMm: 0,
  }

  for (const r of merged) {
    const article = r['Артикул']
    if (!article) continue
    const matches = byArticle.get(article)
    if (!matches || matches.length === 0) {
      notFoundRows.push(r)
      continue
    }
    if (matches.length > 1) {
      if (!duplicatedArticles.includes(article)) duplicatedArticles.push(article)
      continue
    }
    const dbRow = matches[0]

    const data: Record<string, string | number> = {}

    const brand = (r['Торговая марка'] || '').trim()
    if (!dbRow.brand && brand) data.brand = brand

    const occasion = (r as any).occasion as string
    if (!dbRow.occasion && occasion) data.occasion = occasion

    const color = (r['Цвет фольга'] || '').trim()
    if (!dbRow.color && color) data.color = color

    const weightGrams = parseWeightGrams(r['Вес брутто'])
    if (dbRow.weightGrams == null && weightGrams != null) data.weightGrams = weightGrams

    const sizeRaw = r['Размер']
    const size = parseSizeMm(sizeRaw)
    if (sizeRaw && !size) {
      unparsedSizeRows.push({ article, name: r['Название'] || '', size: sizeRaw })
    }
    if (size) {
      if (dbRow.lengthMm == null) data.lengthMm = size.l
      if (dbRow.widthMm == null) data.widthMm = size.w
      if (dbRow.heightMm == null) data.heightMm = size.h
    }

    if (Object.keys(data).length === 0) continue

    for (const k of Object.keys(data)) {
      fieldCounts[k as keyof typeof fieldCounts]++
    }

    plans.push({
      dbId: dbRow.id,
      article,
      dbName: dbRow.name,
      scrapedName: r['Название'] || '',
      data,
      before: {
        brand: dbRow.brand,
        occasion: dbRow.occasion,
        color: dbRow.color,
        weightGrams: dbRow.weightGrams,
        lengthMm: dbRow.lengthMm,
        widthMm: dbRow.widthMm,
        heightMm: dbRow.heightMm,
      },
    })
  }

  console.log(`\nMatched unique DB rows: ${byArticle.size - duplicatedArticles.length}`)
  console.log(`Duplicated articles (skipped, ${duplicatedArticles.length}):`, duplicatedArticles)
  console.log(`Not found in DB: ${notFoundRows.length}`)
  console.log(`Unparsed sizes: ${unparsedSizeRows.length}`)
  console.log(`\nRows with at least one field to update: ${plans.length}`)
  console.log('Per-field planned update counts:', fieldCounts)

  console.log('\n--- Sample "before -> after" (up to 10) ---')
  for (const p of plans.slice(0, 10)) {
    console.log(`\narticle=${p.article} id=${p.dbId}`)
    console.log(`  db name:      ${p.dbName}`)
    console.log(`  scraped name: ${p.scrapedName}`)
    for (const [k, v] of Object.entries(p.data)) {
      console.log(`  ${k}: ${JSON.stringify((p.before as any)[k])} -> ${JSON.stringify(v)}`)
    }
  }

  // write diagnostics regardless of dry-run
  fs.mkdirSync(path.dirname(NOT_FOUND_CSV), { recursive: true })
  const notFoundCsv = ['article,name'].concat(
    notFoundRows.map((r) => `"${r['Артикул']}","${(r['Название'] || '').replace(/"/g, '""')}"`)
  )
  fs.writeFileSync(NOT_FOUND_CSV, notFoundCsv.join('\n') + '\n')

  const unparsedCsv = ['article,name,size'].concat(
    unparsedSizeRows.map((r) => `"${r.article}","${r.name.replace(/"/g, '""')}","${r.size}"`)
  )
  fs.writeFileSync(UNPARSED_SIZE_LOG, unparsedCsv.join('\n') + '\n')

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed.')
    return
  }

  if (plans.length === 0) {
    console.log('\nNothing to update.')
    return
  }

  // Backup affected rows before writing (only rows that will actually be touched)
  // Only write the backup once — a resumed run must not overwrite the pristine
  // pre-any-write snapshot with a partially-mutated state.
  if (!fs.existsSync(BACKUP_PATH)) {
    const affectedIds = plans.map((p) => p.dbId)
    const backupRows = await prisma.onecStockItem.findMany({
      where: { id: { in: affectedIds } },
      select: {
        id: true,
        article: true,
        name: true,
        brand: true,
        occasion: true,
        color: true,
        weightGrams: true,
        lengthMm: true,
        widthMm: true,
        heightMm: true,
      },
    })
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupRows, null, 2))
    console.log(`\nBackup written: ${BACKUP_PATH} (${backupRows.length} rows)`)
  } else {
    console.log(`\nBackup already exists at ${BACKUP_PATH} — not overwriting (resumed run).`)
  }

  // Bulk update via a single raw SQL statement per chunk (COALESCE keeps any existing
  // non-null value untouched — this makes the whole operation naturally idempotent,
  // so it's safe to include already-updated rows in a resumed run).
  // This avoids Prisma interactive transactions, whose per-statement round trips over
  // the pooler were timing out well before a 25-100 row chunk could complete.
  console.log(`\nApplying ${plans.length} updates in chunks of ${CHUNK_SIZE} (bulk SQL)...`)
  let applied = 0
  for (let i = 0; i < plans.length; i += CHUNK_SIZE) {
    const chunk = plans.slice(i, i + CHUNK_SIZE)
    const ids = chunk.map((p) => p.dbId)
    const brand = chunk.map((p) => (p.data.brand as string) ?? null)
    const occasion = chunk.map((p) => (p.data.occasion as string) ?? null)
    const color = chunk.map((p) => (p.data.color as string) ?? null)
    const weightGrams = chunk.map((p) => (p.data.weightGrams as number) ?? null)
    const lengthMm = chunk.map((p) => (p.data.lengthMm as number) ?? null)
    const widthMm = chunk.map((p) => (p.data.widthMm as number) ?? null)
    const heightMm = chunk.map((p) => (p.data.heightMm as number) ?? null)

    await prisma.$executeRawUnsafe(
      `UPDATE "OnecStockItem" t SET
         brand = COALESCE(t.brand, v.brand),
         occasion = COALESCE(t.occasion, v.occasion),
         color = COALESCE(t.color, v.color),
         "weightGrams" = COALESCE(t."weightGrams", v."weightGrams"),
         "lengthMm" = COALESCE(t."lengthMm", v."lengthMm"),
         "widthMm" = COALESCE(t."widthMm", v."widthMm"),
         "heightMm" = COALESCE(t."heightMm", v."heightMm"),
         "updatedAt" = now()
       FROM (
         SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[], $7::int[], $8::int[])
           AS v(id, brand, occasion, color, "weightGrams", "lengthMm", "widthMm", "heightMm")
       ) v
       WHERE t.id = v.id`,
      ids,
      brand,
      occasion,
      color,
      weightGrams,
      lengthMm,
      widthMm,
      heightMm
    )
    applied += chunk.length
    console.log(`  ...${applied}/${plans.length}`)
  }

  console.log(`\nDone. Processed ${applied} rows (COALESCE only fills columns that were still NULL).`)
  console.log('Per-field planned write counts (upper bound; already-filled columns are no-ops):', fieldCounts)
  console.log(`Revert: restore from ${BACKUP_PATH} by re-writing each id's saved column values.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
