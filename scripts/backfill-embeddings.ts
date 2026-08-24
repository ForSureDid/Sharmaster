// One-off (resumable) backfill: computes OpenAI embeddings for every visible
// OnecStockItem missing one, and writes them into the pgvector `embedding` column
// added by migration 20260824000000_add_onec_stockitem_embedding.
//
// The `embedding` column is deliberately NOT in prisma/schema.prisma (same as the
// pg_trgm GIN indexes) so all access here goes through $queryRaw/$executeRaw.
//
// Resumable: only selects rows where embedding IS NULL, so re-running after an
// interruption just continues. Does NOT refresh embeddings for rows that already
// have one (see lib/onecStock.ts's getVectorItemIds comment for the staleness note).

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

import { embedTexts } from '../lib/embeddings'

const BATCH_SIZE = 100
const LIMIT = process.argv.includes('--limit')
  ? Number(process.argv[process.argv.indexOf('--limit') + 1])
  : undefined

type Row = { id: number; name: string; brand: string | null; occasion: string | null; categoryName: string | null }

function buildInputText(row: Row): string {
  const text = [row.name, row.brand, row.categoryName, row.occasion].filter(Boolean).join(' ')
  // A handful of 1C rows have an empty name and nothing else to fall back on —
  // OpenAI's embeddings endpoint rejects an empty string outright, which fails
  // the whole batch it's in. These items have no searchable text anyway.
  return text || 'товар без названия'
}

async function main() {
  const [{ count }] = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "OnecStockItem" WHERE "isHidden" = false AND embedding IS NULL
  `
  const total = Number(count)
  console.log(`${total} items missing embeddings${LIMIT ? ` (capped at --limit ${LIMIT} this run)` : ''}`)

  let done = 0
  while (true) {
    if (LIMIT && done >= LIMIT) break
    const take = Math.min(BATCH_SIZE, LIMIT ? LIMIT - done : BATCH_SIZE)

    const rows = await db.$queryRaw<Row[]>`
      SELECT s.id, s.name, s.brand, s.occasion, c.name AS "categoryName"
      FROM "OnecStockItem" s
      LEFT JOIN "OnecCategory" c ON c.id = s."categoryId"
      WHERE s."isHidden" = false AND s.embedding IS NULL
      ORDER BY s.id
      LIMIT ${take}
    `
    if (rows.length === 0) break

    const texts = rows.map(buildInputText)
    const vectors = await embedTexts(texts)

    await Promise.all(
      rows.map((row, i) => {
        const literal = `[${vectors[i].join(',')}]`
        return db.$executeRaw`UPDATE "OnecStockItem" SET embedding = ${literal}::vector WHERE id = ${row.id}`
      })
    )

    done += rows.length
    console.log(`${done}${LIMIT ? `/${Math.min(total, LIMIT)}` : `/${total}`} done`)
  }

  console.log('Backfill complete.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
