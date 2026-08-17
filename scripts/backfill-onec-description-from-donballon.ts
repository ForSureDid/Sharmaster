/**
 * Backfills OnecStockItem.description from the donballon.ru B2B YML feed,
 * since 1C's Описание is frequently garbled (encoding artifacts, half-copied
 * spec dumps, raw HTML). See lib/onecImport.ts's upsertProductChunk — as of
 * 2026-08-17, description is only ever set on INSERT (as a 1C placeholder),
 * never overwritten on UPDATE, so this backfill survives every future sync.
 *
 * Matching strategy, in priority order, NO fuzzy matching (same as
 * scripts/backfill-onec-brand-from-donballon.ts):
 *   1. article: OnecStockItem.article trimmed/uppercased == offer.vendorCode
 *      trimmed/uppercased (exact). Skipped as ambiguous if a vendorCode maps
 *      to multiple offers with different `description` values.
 *   2. name (only for rows not matched by article): OnecStockItem.name
 *      trimmed == offer.name trimmed, case-insensitive exact full-string
 *      match. Same ambiguity handling.
 * Only rows with a non-empty offer.description are touched. Rows already
 * equal (trimmed) to the candidate are left alone. Everything else is left
 * alone (no guessing, no nulling out).
 *
 * Backup (written before any DB write): every row about to be touched,
 * previous description value, to
 * scripts/backup-onec-description-before-donballon.json — same convention as
 * scripts/backup-onec-brand-before-donballon.json. Revert: for each
 * {id, description} in that file, set OnecStockItem.description = description.
 *
 * Run: npx tsx scripts/backfill-onec-description-from-donballon.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { XMLParser } from 'fast-xml-parser'
import { writeFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const FEED_URL = 'https://www.donballon.ru/bitrix/catalog_export/yandex_donballon_b2b.php'
const BACKUP_PATH = join(process.cwd(), 'scripts/backup-onec-description-before-donballon.json')

// The Supabase pooler has dropped this script's connection mid-run twice
// (2026-08-17, "Connection terminated unexpectedly") — once during the plain
// update loop, once during the very first bulk SELECT. Not obviously tied to
// query size/duration, so every DB round-trip in this script goes through this
// retry wrapper rather than just the update chunks.
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const wait = 1000 * 2 ** i
      console.error(`DB call failed (attempt ${i + 1}/${attempts}), retrying in ${wait}ms:`, e)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

function decodeXml(bytes: Uint8Array): string {
  const prolog = new TextDecoder('ascii').decode(bytes.slice(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prolog)
  const encoding = m?.[1]?.toLowerCase() ?? 'utf-8'
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

type Offer = {
  vendorCode?: string
  name?: string
  description?: string
}

function cleanDescription(raw: string): string {
  // Feed descriptions occasionally carry HTML tags/entities — strip to plain text.
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function main() {
  console.log('Downloading donballon YML feed...')
  const feedRes = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sharmaster-description-backfill/1.0)' },
  })
  if (!feedRes.ok) throw new Error(`Feed fetch failed: ${feedRes.status}`)
  const bytes = new Uint8Array(await feedRes.arrayBuffer())
  console.log(`Downloaded ${(bytes.length / 1024 / 1024).toFixed(1)} MB`)
  const xml = decodeXml(bytes)

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(xml)
  const offersRaw = doc?.yml_catalog?.shop?.offers?.offer
  const offers: Offer[] = Array.isArray(offersRaw) ? offersRaw : offersRaw ? [offersRaw] : []
  console.log(`Parsed ${offers.length} offers`)

  const byVendorCode = new Map<string, Offer[]>()
  const byName = new Map<string, Offer[]>()

  for (const o of offers) {
    const vendorCode = o.vendorCode != null ? String(o.vendorCode) : undefined
    const name = o.name != null ? String(o.name) : undefined
    if (vendorCode) {
      const key = vendorCode.trim().toUpperCase()
      if (key) {
        if (!byVendorCode.has(key)) byVendorCode.set(key, [])
        byVendorCode.get(key)!.push(o)
      }
    }
    if (name) {
      const key = name.trim().toLowerCase()
      if (key) {
        if (!byName.has(key)) byName.set(key, [])
        byName.get(key)!.push(o)
      }
    }
  }

  function resolveDescription(group: Offer[]): { description: string | null; ambiguous: boolean } {
    const descriptions = new Set(
      group
        .map((o) => (o.description != null ? cleanDescription(String(o.description)) : ''))
        .filter((d) => d.length > 0)
    )
    if (descriptions.size === 0) return { description: null, ambiguous: false }
    if (descriptions.size > 1) return { description: null, ambiguous: true }
    return { description: [...descriptions][0], ambiguous: false }
  }

  const items = await withRetry(() =>
    prisma.onecStockItem.findMany({
      select: { id: true, article: true, name: true, description: true },
    })
  )
  console.log(`Total OnecStockItem rows: ${items.length}`)

  let matchedByArticle = 0
  let matchedByName = 0
  let ambiguousArticle = 0
  let ambiguousName = 0

  type Pending = { id: number; oldDescription: string | null; newDescription: string }
  const toUpdate: Pending[] = []
  let unchanged = 0

  for (const item of items) {
    let description: string | null = null
    let via: 'article' | 'name' | null = null

    if (item.article) {
      const key = item.article.trim().toUpperCase()
      const group = key ? byVendorCode.get(key) : undefined
      if (group) {
        const { description: d, ambiguous } = resolveDescription(group)
        if (ambiguous) {
          ambiguousArticle++
        } else if (d) {
          description = d
          via = 'article'
          matchedByArticle++
        }
      }
    }

    if (!description && item.name) {
      const key = item.name.trim().toLowerCase()
      const group = key ? byName.get(key) : undefined
      if (group) {
        const { description: d, ambiguous } = resolveDescription(group)
        if (ambiguous) {
          ambiguousName++
        } else if (d) {
          description = d
          via = 'name'
          matchedByName++
        }
      }
    }

    if (!description || !via) continue

    if ((item.description ?? '').trim() === description) {
      unchanged++
      continue
    }

    toUpdate.push({ id: item.id, oldDescription: item.description, newDescription: description })
  }

  // Write backup of every row about to be touched BEFORE any DB write.
  const backup = toUpdate.map((p) => ({ id: p.id, description: p.oldDescription }))
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2))
  console.log(`Backup written before any write: ${BACKUP_PATH} (${backup.length} rows)`)

  let filled = 0
  let changed = 0
  for (const p of toUpdate) {
    if (p.oldDescription == null || p.oldDescription.trim() === '') filled++
    else changed++
  }

  // Batched raw UPDATEs (CHUNK_SIZE rows/round-trip) instead of one prisma.update()
  // per row — 14.8k individual awaited round-trips to the Supabase pooler is slow
  // enough (~45min) that the pooler drops the connection mid-run ("Connection
  // terminated unexpectedly", observed 2026-08-17). Chunking cuts round-trips by
  // ~200x and each chunk retries once on a transient connection error.
  const CHUNK_SIZE = 200
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map((p) => Prisma.sql`(${p.id}::int, ${p.newDescription}::text)`)
    await withRetry(() =>
      prisma.$executeRaw`
        UPDATE "OnecStockItem" AS t
        SET "description" = v.description, "updatedAt" = now()
        FROM (VALUES ${Prisma.join(rows)}) AS v(id, description)
        WHERE t.id = v.id
      `
    )
    console.log(`Updated ${Math.min(i + CHUNK_SIZE, toUpdate.length)} / ${toUpdate.length}`)
  }

  console.log('---')
  console.log('Matched by article:', matchedByArticle)
  console.log('Matched by name (fallback):', matchedByName)
  console.log('Ambiguous article (skipped, multiple offers share vendorCode with different descriptions):', ambiguousArticle)
  console.log('Ambiguous name (skipped, multiple offers share exact name with different descriptions):', ambiguousName)
  console.log('---')
  console.log('Filled (was null/empty):', filled)
  console.log('Changed (had a different description already):', changed)
  console.log('Unchanged (already matched donballon value):', unchanged)
  console.log('---')
  console.log(`Backup of previous values written to ${BACKUP_PATH} (${backup.length} rows)`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
