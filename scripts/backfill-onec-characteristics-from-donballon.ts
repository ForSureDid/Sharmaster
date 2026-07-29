/**
 * Backfills 7 new OnecStockItem columns (occasion/shade/color/colorGroup/
 * lengthMm/widthMm/heightMm) from the full Donballon.ru B2B catalog xlsx
 * export at "All the Files with material here/Donballon.xlsx" (sheet "Лист 1",
 * 17,389 rows), matching by article.
 *
 * Matching rule (per explicit user instruction — article match required,
 * name must "basically correspond", small wording deviations OK, genuinely
 * different product descriptions must not be written):
 *   - OnecStockItem.article (trimmed) === xlsx "Артикул" (trimmed) is
 *     required.
 *   - Additionally, xlsx "Описание для анонса" must be within diffCount <= 3
 *     of the candidate row's `name`, using the exact token-multiset-diff
 *     algorithm below (user ran this against the live DB and picked the
 *     threshold: diff=0 exact 7,472 rows; diff=2/diff=3 are wording-noise
 *     buckets (7,162 / 1,980 rows) that are fine to accept; diff=4 (23 rows,
 *     untested) is treated as reject to stay safe; diff>=5 (54 rows) are
 *     genuinely different products sharing an article number and must be
 *     skipped).
 *   - For articles where MULTIPLE OnecStockItem rows share the same article
 *     (22 as of 2026-07-28): compute diffCount against every candidate,
 *     pick the lowest; accept only if that lowest is <= 3 AND strictly
 *     lower than every other candidate's diffCount for that article
 *     (unambiguous best match). Otherwise skip the whole group.
 *
 *   function norm(s) { return String(s||'').toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ').trim(); }
 *   function tokens(s) { return norm(s).split(' ').filter(Boolean); }
 *   function diffCount(a, b) {
 *     const sa = new Map(); for (const t of tokens(a)) sa.set(t, (sa.get(t)||0)+1);
 *     const sb = new Map(); for (const t of tokens(b)) sb.set(t, (sb.get(t)||0)+1);
 *     let diff = 0;
 *     for (const k of new Set([...sa.keys(), ...sb.keys()])) diff += Math.abs((sa.get(k)||0) - (sb.get(k)||0));
 *     return diff;
 *   }
 *
 * Field-level write rule: only write a column if the xlsx value is non-null
 * and non-empty after trim; otherwise leave the existing DB value untouched
 * (never null out). lengthMm/widthMm/heightMm are parsed with parseInt and
 * skipped (field-level, not row-level) if not a positive integer.
 * occasion/shade/color/colorGroup are stored verbatim (including any
 * semicolon-joined multi-value strings like "Свадьба;Девичник" — do not split).
 *
 * Backup (written before any DB write): previous values of all 7 columns for
 * every row about to be touched, keyed by id, to
 * scripts/backup-onec-characteristics-before-donballon.json.
 * Revert: for each {id, occasion, shade, color, colorGroup, lengthMm,
 * widthMm, heightMm} in that file, write those values back verbatim
 * (including nulls) to the corresponding OnecStockItem row.
 *
 * Skipped-for-name-mismatch rows (diffCount > 3, or an ambiguous group with
 * no unambiguous best match) are logged to
 * scripts/backup-onec-characteristics-skipped-name-mismatch.json for manual
 * review — article, dbName, xlsxName, diffCount. This does not block the run.
 *
 * CAVEAT (do not "fix" without explicit instruction): these 7 columns are
 * intentionally NOT referenced in lib/onecImport.ts's upsertProductChunk()
 * INSERT column list or its ON CONFLICT DO UPDATE SET clause, same as
 * packQty/sizeInches/onSale/isHidden — they must survive every future 1C
 * sync untouched.
 *
 * Run: npx tsx scripts/backfill-onec-characteristics-from-donballon.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const XLSX_PATH = join(
  process.cwd(),
  'All the Files with material here/Donballon.xlsx'
)
const BACKUP_PATH = join(
  process.cwd(),
  'scripts/backup-onec-characteristics-before-donballon.json'
)
const SKIPPED_PATH = join(
  process.cwd(),
  'scripts/backup-onec-characteristics-skipped-name-mismatch.json'
)

const DIFF_THRESHOLD = 3

type XlsxRow = {
  Артикул: string | null
  'Описание для анонса': string | null
  Праздник: string | null
  Оттенок: string | null
  Цвет: string | null
  'Группа цвета': string | null
  'Длина (мм)': string | null
  'Ширина (мм)': string | null
  'Высота (мм)': string | null
  [key: string]: any
}

type DbItem = {
  id: number
  article: string | null
  name: string
  occasion: string | null
  shade: string | null
  color: string | null
  colorGroup: string | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
}

type NewValues = {
  occasion?: string
  shade?: string
  color?: string
  colorGroup?: string
  lengthMm?: number
  widthMm?: number
  heightMm?: number
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t.length > 0 ? t : null
}

function parsePositiveInt(v: string | null | undefined): number | null {
  if (v == null) return null
  const t = String(v).trim()
  if (!t) return null
  const n = parseInt(t, 10)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

// Exact algorithm specified by the user — do not modify.
function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
function tokens(s: string): string[] {
  return norm(s).split(' ').filter(Boolean)
}
function diffCount(a: string, b: string): number {
  const sa = new Map<string, number>()
  for (const t of tokens(a)) sa.set(t, (sa.get(t) || 0) + 1)
  const sb = new Map<string, number>()
  for (const t of tokens(b)) sb.set(t, (sb.get(t) || 0) + 1)
  let diff = 0
  for (const k of new Set([...sa.keys(), ...sb.keys()])) {
    diff += Math.abs((sa.get(k) || 0) - (sb.get(k) || 0))
  }
  return diff
}

function extractNewValues(row: XlsxRow): NewValues {
  const nv: NewValues = {}
  const occasion = nonEmpty(row['Праздник'])
  if (occasion) nv.occasion = occasion
  const shade = nonEmpty(row['Оттенок'])
  if (shade) nv.shade = shade
  const color = nonEmpty(row['Цвет'])
  if (color) nv.color = color
  const colorGroup = nonEmpty(row['Группа цвета'])
  if (colorGroup) nv.colorGroup = colorGroup
  const lengthMm = parsePositiveInt(row['Длина (мм)'])
  if (lengthMm != null) nv.lengthMm = lengthMm
  const widthMm = parsePositiveInt(row['Ширина (мм)'])
  if (widthMm != null) nv.widthMm = widthMm
  const heightMm = parsePositiveInt(row['Высота (мм)'])
  if (heightMm != null) nv.heightMm = heightMm
  return nv
}

async function main() {
  const wb = XLSX.readFile(XLSX_PATH)
  const ws = wb.Sheets['Лист 1']
  const rows: XlsxRow[] = XLSX.utils.sheet_to_json(ws, { defval: null })
  console.log('xlsx rows:', rows.length)

  const items: DbItem[] = await prisma.onecStockItem.findMany({
    select: {
      id: true,
      article: true,
      name: true,
      occasion: true,
      shade: true,
      color: true,
      colorGroup: true,
      lengthMm: true,
      widthMm: true,
      heightMm: true,
    },
  })

  const byArticle = new Map<string, DbItem[]>()
  for (const it of items) {
    if (!it.article) continue
    const key = it.article.trim()
    if (!byArticle.has(key)) byArticle.set(key, [])
    byArticle.get(key)!.push(it)
  }

  let noArticleMatch = 0
  let exactNameMatch = 0 // diff === 0
  let fuzzyAccepted = 0 // 1 <= diff <= 3
  let skippedDiffTooHigh = 0 // diff > 3 (unambiguous single-candidate rows)
  let ambiguousResolved = 0
  let ambiguousSkipped = 0
  let rowsWithNoWritableFields = 0
  let updated = 0

  const backup: Record<
    number,
    {
      occasion: string | null
      shade: string | null
      color: string | null
      colorGroup: string | null
      lengthMm: number | null
      widthMm: number | null
      heightMm: number | null
    }
  > = {}

  const skippedReport: {
    article: string
    dbName?: string
    xlsxName: string | null
    diffCount?: number
    reason: 'diff_too_high' | 'ambiguous_no_clear_match'
    candidates?: { name: string; diffCount: number }[]
  }[] = []

  const plan = new Map<number, NewValues>()

  for (const r of rows) {
    const art = nonEmpty(r['Артикул'])
    if (!art) continue
    const candidates = byArticle.get(art)
    if (!candidates || candidates.length === 0) {
      noArticleMatch++
      continue
    }

    const xlsxName = nonEmpty(r['Описание для анонса'])
    let target: DbItem

    if (candidates.length === 1) {
      const c = candidates[0]
      const d = xlsxName ? diffCount(c.name, xlsxName) : Infinity
      if (d === 0) {
        exactNameMatch++
        target = c
      } else if (d <= DIFF_THRESHOLD) {
        fuzzyAccepted++
        target = c
      } else {
        skippedDiffTooHigh++
        skippedReport.push({
          article: art,
          dbName: c.name,
          xlsxName,
          diffCount: d === Infinity ? undefined : d,
          reason: 'diff_too_high',
        })
        continue
      }
    } else {
      // Ambiguous article group: pick lowest diffCount, require <=3 and
      // strictly lower than every other candidate.
      const scored = candidates.map((c) => ({
        c,
        d: xlsxName ? diffCount(c.name, xlsxName) : Infinity,
      }))
      scored.sort((a, b) => a.d - b.d)
      const best = scored[0]
      const secondBest = scored[1]
      const clearBest =
        best.d <= DIFF_THRESHOLD && (!secondBest || best.d < secondBest.d)
      if (clearBest) {
        target = best.c
        ambiguousResolved++
        if (best.d === 0) exactNameMatch++
        else fuzzyAccepted++
      } else {
        ambiguousSkipped++
        skippedReport.push({
          article: art,
          xlsxName,
          reason: 'ambiguous_no_clear_match',
          candidates: scored.map((s) => ({
            name: s.c.name,
            diffCount: s.d === Infinity ? -1 : s.d,
          })),
        })
        continue
      }
    }

    const nv = extractNewValues(r)
    if (Object.keys(nv).length === 0) {
      rowsWithNoWritableFields++
      continue
    }
    plan.set(target.id, nv)
  }

  const itemById = new Map(items.map((it) => [it.id, it]))

  for (const [id, nv] of plan) {
    const item = itemById.get(id)!
    backup[id] = {
      occasion: item.occasion,
      shade: item.shade,
      color: item.color,
      colorGroup: item.colorGroup,
      lengthMm: item.lengthMm,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
    }
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2))
  writeFileSync(SKIPPED_PATH, JSON.stringify(skippedReport, null, 2))
  console.log(
    `Backup of previous values for ${Object.keys(backup).length} rows written to ${BACKUP_PATH}`
  )
  console.log(
    `Skipped-for-review log (${skippedReport.length} entries) written to ${SKIPPED_PATH}`
  )

  for (const [id, nv] of plan) {
    await prisma.onecStockItem.update({ where: { id }, data: nv })
    updated++
  }

  console.log('---')
  console.log('xlsx rows total:', rows.length)
  console.log('No article match in DB at all:', noArticleMatch)
  console.log('Exact name match (diff=0):', exactNameMatch)
  console.log('Fuzzy accepted (1<=diff<=3):', fuzzyAccepted)
  console.log('Skipped, diff too high (diff>3, unambiguous rows):', skippedDiffTooHigh)
  console.log('Ambiguous article groups resolved (clear best <=3):', ambiguousResolved)
  console.log('Ambiguous article groups skipped (no clear match):', ambiguousSkipped)
  console.log('Matched rows with zero writable (non-empty) fields, skipped:', rowsWithNoWritableFields)
  console.log('Rows updated in DB:', updated)

  await prisma.$disconnect()
}

main()
