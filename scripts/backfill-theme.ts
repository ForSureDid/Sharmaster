// One-off (resumable) backfill: classifies the real licensed franchise/character
// theme behind each visible OnecStockItem's product PHOTO — "Pixel Hero" -> Minecraft,
// "Блоки, Девочки" -> Roblox, etc. — via gpt-6-luna vision, and writes it into the
// `theme` column (migration 20261004000000_add_onec_stockitem_theme).
//
// Why from the photo and not the 1C name: the 1C/donballon name routinely uses the
// manufacturer's own euphemism instead of the real franchise (Falali calls its
// Minecraft line "Пиксельный герой", its Roblox line "Блоки") — a word/synonym
// dictionary would have to be maintained by hand per product line. Classifying the
// photo instead costs API tokens but zero ongoing manual mapping work — see the
// 2026-10-04 conversation that validated 10/10 on a manual test batch.
//
// Resumable: only selects visible rows with a photo and theme IS NULL. A row the
// model can't place is written as the literal string "unknown" (not left NULL) so
// a re-run doesn't re-spend tokens classifying it again — see lib/onecStock.ts's
// buildStockWhere and WORD_SYNONYMS in lib/search-hints.ts for how "unknown" is
// simply never searched for and never surfaced to shoppers.
//
// When a row gets a real (non-"unknown") theme, this also immediately recomputes
// its embedding (name+brand+category+occasion+theme) so the pgvector fallback in
// lib/onecStock.ts's getVectorItemIds benefits too, without waiting for a separate
// backfill-embeddings.ts run (which skips rows that already have an embedding).

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

import OpenAI from 'openai'
import { embedTexts } from '../lib/embeddings'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BATCH_SIZE = 50
const CONCURRENCY = 8
const LIMIT = process.argv.includes('--limit')
  ? Number(process.argv[process.argv.indexOf('--limit') + 1])
  : undefined
// --ids 123,456 reclassifies specific rows regardless of their current theme —
// useful for spot-checking and for redoing a row after a bad guess, without
// having to NULL out theme for the whole queue in front of it.
const IDS = process.argv.includes('--ids')
  ? process.argv[process.argv.indexOf('--ids') + 1].split(',').map(Number)
  : undefined
// --category-roots "Воздушные шары из латекса,Воздушные шары из фольги" scopes
// the backfill to those top categories' full subtree — printed/shaped balloons
// are where licensed characters actually show up; décor (plates, napkins, gift
// bags) can be a separate, later pass once this pilot's hit-rate is known.
const CATEGORY_ROOTS = process.argv.includes('--category-roots')
  ? process.argv[process.argv.indexOf('--category-roots') + 1].split(',')
  : undefined

type Row = {
  id: number
  name: string
  brand: string | null
  occasion: string | null
  categoryName: string | null
  photoUrl: string
}

const PROMPT = `Ты каталогизатор товаров для магазина праздничных шаров (Казахстан). Тебе даны название товара из 1С (может НЕ отражать реальную тематику — поставщики часто используют свой эвфемизм вместо названия франшизы, например "Пиксельный герой" это Minecraft, а "Блоки" это Roblox) и фото этого товара.

Определи РЕАЛЬНУЮ тематику/франшизу — игру, мультфильм, фильм или медиа-бренд — к которой относится персонаж/дизайн на фото. Отвечай на английском:
- именем САМОГО персонажа, если он сам по себе узнаваем и ищется отдельно от франшизы (например "Spider-Man", "Batman", "Hulk", "Elsa" — покупатель ищет именно это имя, а не "Marvel"/"DC"/"Frozen");
- общим названием франшизы/студии (например "Minecraft", "Roblox", "Marvel", "Frozen"), только если на фото НЕТ одного узнаваемого именного героя — просто лого бренда, групповой монтаж нескольких персонажей, или стилистика без конкретного лица;
- "unknown", если на фото нет узнаваемого лицензированного персонажа/франшизы (обычный шар без рисунка, абстрактный узор, цветы, буквы/цифры без темы и т.п.) — это нормальный и ожидаемый ответ для большинства товаров.

Строго JSON без пояснений: {"theme": "...", "confidence": "high|medium|low"}`

function buildInputText(row: Row, theme: string): string {
  return [row.name, row.brand, row.categoryName, row.occasion, theme].filter(Boolean).join(' ')
}

// gpt-6-luna over gpt-4o-mini: same (or better — cleaner franchise-vs-character
// canonicalization) accuracy on the 2026-10-04 validation batch at ~1/7th the
// cost (~6.7x fewer tokens per image AND a lower $/token rate). Takes
// max_completion_tokens, not the older max_tokens.
const VISION_MODEL = 'gpt-6-luna'

async function classifyTheme(row: Row): Promise<string> {
  const res = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${PROMPT}\n\nНазвание из 1С: ${row.name}` },
          { type: 'image_url', image_url: { url: row.photoUrl, detail: 'low' } },
        ],
      },
    ],
    max_completion_tokens: 60,
  })
  const raw = (res.choices[0].message.content ?? '').replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(raw) as { theme?: string; confidence?: string }
    const theme = (parsed.theme ?? '').trim()
    // Low confidence is treated the same as "unknown" — a wrong guess (e.g.
    // confusing an abstract pattern for a franchise) pollutes search worse than
    // just not tagging it, and "unknown" still makes the row resumable-skip.
    if (!theme || theme.toLowerCase() === 'unknown' || parsed.confidence === 'low') return 'unknown'
    return theme
  } catch {
    return 'unknown'
  }
}

async function processRow(row: Row): Promise<{ id: number; theme: string; status: 'ok' | 'error' }> {
  // OpenAI's image fetcher intermittently times out pulling from our self-hosted
  // Supabase storage (observed ~2/5 in a manual test batch, succeeding on immediate
  // retry both times) — worth a couple of in-process retries before giving up and
  // leaving the row for the next backfill run to pick up.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const theme = await classifyTheme(row)
      if (theme === 'unknown') {
        await db.$executeRaw`UPDATE "OnecStockItem" SET theme = 'unknown' WHERE id = ${row.id}`
      } else {
        const [vector] = await embedTexts([buildInputText(row, theme)])
        const literal = `[${vector.join(',')}]`
        await db.$executeRaw`UPDATE "OnecStockItem" SET theme = ${theme}, embedding = ${literal}::vector WHERE id = ${row.id}`
      }
      return { id: row.id, theme, status: 'ok' }
    } catch (e: any) {
      if (attempt === 3) {
        // A permanently broken photo URL (not a transient fetch timeout — e.g. id
        // 439619 had a corrupted "...png$0" imageUrl, a pre-existing data bug) must
        // not leave theme NULL: the main loop's query is WHERE theme IS NULL ORDER
        // BY id LIMIT 50, so a row that always re-matches gets re-selected and
        // re-retried forever, looping the whole script indefinitely instead of
        // moving past it. "error" is a distinct sentinel from "unknown" (no franchise
        // found) and from a real theme — `--ids` can specifically retry it later
        // once/if the underlying data issue (bad URL, etc.) is fixed.
        console.error(`  [${row.id}] ERROR after ${attempt} attempts: ${e.message}`)
        await db.$executeRaw`UPDATE "OnecStockItem" SET theme = 'error' WHERE id = ${row.id}`
        return { id: row.id, theme: '', status: 'error' }
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  return { id: row.id, theme: '', status: 'error' }
}

// Simple fixed-size worker pool over a shared queue — avoids firing 50 vision
// requests at once into OpenAI's rate limiter.
async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function runOne() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runOne))
  return results
}

// Resolves --category-roots (top-level OnecCategory names) to the full set of
// descendant category ids, via a recursive CTE — kept local/raw instead of
// importing lib/onecStock.ts's getDescendantCategoryIds so this script's own
// dotenv.config()-before-DB-env-read ordering (see lib/db.ts) isn't disturbed
// by that module's top-level `db` client.
async function resolveCategoryIds(rootNames: string[]): Promise<number[]> {
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    WITH RECURSIVE roots AS (
      SELECT id FROM "OnecCategory" WHERE name = ANY(${rootNames})
    ), tree AS (
      SELECT id FROM roots
      UNION ALL
      SELECT c.id FROM "OnecCategory" c JOIN tree t ON c."parentId" = t.id
    )
    SELECT id FROM tree
  `
  return rows.map((r) => r.id)
}

async function main() {
  if (IDS) {
    const rows = await db.$queryRaw<Row[]>`
      SELECT s.id, s.name, s.brand, s.occasion, c.name AS "categoryName",
        COALESCE(s."imageUrl", s.images[1]) AS "photoUrl"
      FROM "OnecStockItem" s
      LEFT JOIN "OnecCategory" c ON c.id = s."categoryId"
      WHERE s.id = ANY(${IDS})
    `
    const results = await runPool(rows, CONCURRENCY, processRow)
    for (const r of results) console.log(`[${r.id}] -> ${r.theme || '(error)'}`)
    return
  }

  const categoryIds = CATEGORY_ROOTS ? await resolveCategoryIds(CATEGORY_ROOTS) : null
  if (CATEGORY_ROOTS && categoryIds!.length === 0) {
    console.log(`No categories matched --category-roots ${JSON.stringify(CATEGORY_ROOTS)} — check the exact names in OnecCategory.`)
    return
  }

  const [{ count }] = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "OnecStockItem"
    WHERE "isHidden" = false AND theme IS NULL AND ("imageUrl" IS NOT NULL OR array_length(images, 1) > 0)
      AND (${categoryIds === null} OR "categoryId" = ANY(${categoryIds ?? []}))
  `
  const total = Number(count)
  console.log(`${total} items missing a theme classification${CATEGORY_ROOTS ? ` in [${CATEGORY_ROOTS.join(', ')}]` : ''}${LIMIT ? ` (capped at --limit ${LIMIT} this run)` : ''}`)

  let done = 0
  let identified = 0
  while (true) {
    if (LIMIT && done >= LIMIT) break
    const take = Math.min(BATCH_SIZE, LIMIT ? LIMIT - done : BATCH_SIZE)

    const rows = await db.$queryRaw<Row[]>`
      SELECT s.id, s.name, s.brand, s.occasion, c.name AS "categoryName",
        COALESCE(s."imageUrl", s.images[1]) AS "photoUrl"
      FROM "OnecStockItem" s
      LEFT JOIN "OnecCategory" c ON c.id = s."categoryId"
      WHERE s."isHidden" = false AND s.theme IS NULL
        AND (s."imageUrl" IS NOT NULL OR array_length(s.images, 1) > 0)
        AND (${categoryIds === null} OR s."categoryId" = ANY(${categoryIds ?? []}))
      ORDER BY s.id
      LIMIT ${take}
    `
    if (rows.length === 0) break

    const results = await runPool(rows, CONCURRENCY, processRow)
    identified += results.filter((r) => r.status === 'ok' && r.theme !== 'unknown').length

    done += rows.length
    console.log(`${done}${LIMIT ? `/${Math.min(total, LIMIT)}` : `/${total}`} done (${identified} themed so far)`)
  }

  console.log(`Backfill complete. ${identified} items tagged with a real theme.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
