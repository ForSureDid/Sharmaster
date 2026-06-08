/**
 * Backfills imageUrl (and productId) on StockItem records by matching
 * them against Products that already have imageUrl set.
 *
 * Two-pass matching:
 *  1. Primary  — exact manufacturer + size match, ranked by keyword overlap
 *  2. Fallback — size match across ALL manufacturers, ranked by keyword overlap
 *               (only accepted if overlap ≥ 2 to avoid false positives)
 *
 * Run with --all to re-process items that already have imageUrl.
 * Default: only process items without imageUrl.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

// ── Brand extraction ──────────────────────────────────────────────────────────

function extractBrand(name: string): string {
  const n = name.trim()
  if (/ЗАБАВА/i.test(n))             return 'Забава'
  if (/^R\d+\s+S\d/i.test(n))       return 'Забава'
  if (/^R\d+\s+512-/.test(n))       return '512'
  if (/^R\d+\s+\d{3}\b/.test(n))    return 'Sempertex'
  if (/^R\d+\s+Qualatex/i.test(n))  return 'Qualatex'
  if (/^R\d+\s+/.test(n))           return 'Sempertex'
  return n.split(/\s+/)[0]
}

function extractSizeInches(name: string): string | null {
  // "(12''/30 см)" or "(12')"  — parenthesized, single or double quote after inches
  const m1 = name.match(/\((\d+)[''"]/)
  if (m1) return m1[1]
  // "AGURA 16" Бантик" — bare number followed by ASCII double-quote (char 34)
  const m2 = name.match(/\s(\d+)"\s/)
  if (m2) return m2[1]
  // R12, R10, R5 prefix → size
  const rm = name.match(/^R(\d+)\s/)
  if (rm) return rm[1]
  return null
}

// StockItem brand → Product.manufacturer in DB
const BRAND_TO_MFR: Record<string, string> = {
  '512':        '512',
  'Agura':      'Agura',
  'AGURA':      'Agura',
  'Anagram':    'Anagram',
  'Falali':     'Falali',
  'Koda':       'Koda',
  'KODA':       'Koda',
  'Дон':        'Дон Баллон',
  'ДонБаллон':  'Дон Баллон',
  'Sempertex':  'Sempertex S.A.',
  'Qualatex':   'Qualatex',
  'Gemar':      'Gemar',
  'Belbal':     'Belbal',
  'Betalli':    'Belbal',
  'Betallic':   'Betallic',
}

// ── Keyword extraction ────────────────────────────────────────────────────────

function extractKeywords(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[''"""()'']/g, ' ')
      .replace(/[^\wа-яёa-z\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !/^\d+$/.test(w))
  )
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n
}

type ProductRow = {
  id: number
  name: string
  manufacturer: string | null
  sizeInches: string | null
  imageUrl: string | null
}

// ── Main matching logic ───────────────────────────────────────────────────────

function findBestMatch(
  stockName: string,
  byMfrSize: Map<string, ProductRow[]>,
  bySize: Map<string, ProductRow[]>
): { imageUrl: string | null; productId: number | null; strategy: string } {
  const brand = extractBrand(stockName)
  const size = extractSizeInches(stockName)

  // Pass 1: match by exact manufacturer + size
  const dbMfr = BRAND_TO_MFR[brand]
  if (dbMfr) {
    const key = `${dbMfr}|${size ?? ''}`
    const candidates = byMfrSize.get(key) ?? []

    if (candidates.length === 1) {
      return { imageUrl: candidates[0].imageUrl, productId: candidates[0].id, strategy: 'mfr+size (only)' }
    }
    if (candidates.length > 1) {
      const stockKw = extractKeywords(stockName)
      let best = candidates[0]
      let bestScore = overlapScore(stockKw, extractKeywords(candidates[0].name))
      for (let i = 1; i < candidates.length; i++) {
        const score = overlapScore(stockKw, extractKeywords(candidates[i].name))
        if (score > bestScore) { bestScore = score; best = candidates[i] }
      }
      if (bestScore > 0) {
        return { imageUrl: best.imageUrl, productId: best.id, strategy: `mfr+size+kw(${bestScore})` }
      }
    }
  }

  // Pass 2: fallback — any manufacturer, same size, keyword overlap ≥ 2
  if (size) {
    const candidates = bySize.get(size) ?? []
    if (candidates.length > 0) {
      const stockKw = extractKeywords(stockName)
      let best: ProductRow | null = null
      let bestScore = 1 // require at least 2 overlaps (>1)
      for (const p of candidates) {
        const score = overlapScore(stockKw, extractKeywords(p.name))
        if (score > bestScore) { bestScore = score; best = p }
      }
      if (best) {
        return { imageUrl: best.imageUrl, productId: best.id, strategy: `size+kw(${bestScore})` }
      }
    }
  }

  return { imageUrl: null, productId: null, strategy: 'none' }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const processAll = process.argv.includes('--all')
  console.log(processAll
    ? 'Mode: backfill ALL StockItems (overwrite existing imageUrl)'
    : 'Mode: backfill only StockItems without imageUrl')

  console.log('\nLoading products with images from DB...')
  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, manufacturer: true, sizeInches: true, imageUrl: true },
  })
  console.log(`  ${products.length} products with imageUrl`)

  // Build two lookup maps
  const byMfrSize = new Map<string, ProductRow[]>()
  const bySize = new Map<string, ProductRow[]>()

  for (const p of products) {
    // manufacturer+size index
    const mfr = p.manufacturer ?? ''
    const sz = p.sizeInches ?? ''
    const key1 = `${mfr}|${sz}`
    if (!byMfrSize.has(key1)) byMfrSize.set(key1, [])
    byMfrSize.get(key1)!.push(p)

    // size-only index
    if (sz) {
      if (!bySize.has(sz)) bySize.set(sz, [])
      bySize.get(sz)!.push(p)
    }
  }

  const where = processAll ? {} : { imageUrl: null }
  const stockItems = await prisma.stockItem.findMany({ where, select: { id: true, name: true } })
  console.log(`  ${stockItems.length} stock items to process`)

  let matched = 0, unmatched = 0
  const stratCount = new Map<string, number>()

  const BATCH = 20
  for (let i = 0; i < stockItems.length; i += BATCH) {
    const batch = stockItems.slice(i, i + BATCH)

    await Promise.all(batch.map(async (item) => {
      const { imageUrl, productId, strategy } = findBestMatch(item.name, byMfrSize, bySize)

      stratCount.set(strategy, (stratCount.get(strategy) ?? 0) + 1)

      if (!imageUrl) {
        unmatched++
        return
      }

      matched++
      await prisma.stockItem.update({
        where: { id: item.id },
        data: {
          imageUrl,
          ...(productId != null ? { productId } : {}),
        },
      })
    }))

    process.stdout.write(
      `\r  ${Math.min(i + BATCH, stockItems.length)}/${stockItems.length} | matched=${matched} unmatched=${unmatched}`
    )
  }

  console.log('\n')
  console.log('── Results ──────────────────────────────────')
  console.log(`  Updated with image:    ${matched}`)
  console.log(`  No match found:        ${unmatched}`)
  console.log('\n  By strategy:')
  ;[...stratCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`    ${s}: ${c}`))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
