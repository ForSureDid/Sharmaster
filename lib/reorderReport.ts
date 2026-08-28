import { db } from '@/lib/db'

// Target stock = avg daily consumption × this many days of cover.
const TARGET_DAYS_COVER = 14
// How far back to look at StockSnapshot history for the consumption rate.
const LOOKBACK_DAYS = 14
// Minimum units consumed within the lookback window to count as "actively
// selling" — filters out one-off noise (a single sale of a rarely-bought item).
const MIN_UNITS_SOLD = 3
// A StockSnapshot-based rate needs at least this many days of span before
// it's trusted over the site-orders fallback (see getReorderRecommendations).
const STOCK_MIN_DAYS_TO_TRUST = 7
// Site-orders fallback window — matches STOCK_MIN_DAYS_TO_TRUST so the two
// signals are directly comparable while snapshot history is still building up.
const SITE_FALLBACK_DAYS = 7

export type ReorderRow = {
  id: number
  article: string | null
  name: string
  brand: string | null
  currentStock: number
  avgDailyConsumption: number
  daysOfHistory: number
  targetStock: number
  reorderQty: number
  // "stock" = derived from StockSnapshot (channel-agnostic, includes
  // offline/1C sales) — trusted once it has enough days of history.
  // "site" = fallback derived from the site's own Order/OrderItem rows for
  // the last SITE_FALLBACK_DAYS days — used until StockSnapshot history
  // matures; undercounts demand for products that mostly sell offline.
  source: 'stock' | 'site'
  // true when reorderQty comes from OnecStockItem.reorderQtyOverride (admin
  // manually corrected it in the Дозаказ tab) rather than the calculation
  // above. avgDailyConsumption/targetStock/source stay as calculated context
  // when available, or zeroed out for an item the calculation didn't flag at all.
  overridden: boolean
}

type RawRow = {
  id: number
  article: string | null
  name: string
  brand: string | null
  currentStock: number
  totalConsumed: number
  daysSpanned: number
}

function toReorderRow(r: RawRow, source: ReorderRow['source']): ReorderRow {
  const daysOfHistory = Math.max(r.daysSpanned, 1)
  const avgDailyConsumption = r.totalConsumed / daysOfHistory
  const targetStock = Math.ceil(avgDailyConsumption * TARGET_DAYS_COVER)
  const reorderQty = Math.max(0, targetStock - r.currentStock)
  return {
    id: r.id,
    article: r.article,
    name: r.name,
    brand: r.brand,
    currentStock: r.currentStock,
    avgDailyConsumption: Math.round(avgDailyConsumption * 10) / 10,
    daysOfHistory: Math.round(daysOfHistory * 10) / 10,
    targetStock,
    reorderQty,
    source,
    overridden: false,
  }
}

// Consumption estimated from day-over-day drops in OnecStockItem.stock (via
// daily StockSnapshot rows) — channel-agnostic, so it captures offline/1C
// sales too, not just site orders. Only meaningful once enough days have
// accumulated (STOCK_MIN_DAYS_TO_TRUST); see scripts/snapshot-stock.ts.
async function getStockBasedRows(): Promise<Map<number, RawRow>> {
  const rows = await db.$queryRaw<RawRow[]>`
    WITH deltas AS (
      SELECT
        s."onecStockItemId" AS id,
        GREATEST(
          LAG(s.stock) OVER (PARTITION BY s."onecStockItemId" ORDER BY s."capturedAt") - s.stock,
          0
        ) AS consumed,
        s."capturedAt"
      FROM "StockSnapshot" s
      WHERE s."capturedAt" >= NOW() - (${LOOKBACK_DAYS}::int * INTERVAL '1 day')
    ),
    agg AS (
      SELECT
        id,
        COALESCE(SUM(consumed), 0)::int AS "totalConsumed",
        GREATEST(EXTRACT(EPOCH FROM (MAX("capturedAt") - MIN("capturedAt"))) / 86400.0, 0) AS "daysSpanned"
      FROM deltas
      GROUP BY id
    )
    SELECT
      o.id,
      o.article,
      o.name,
      o.brand,
      o.stock AS "currentStock",
      agg."totalConsumed",
      agg."daysSpanned"
    FROM agg
    JOIN "OnecStockItem" o ON o.id = agg.id
    WHERE agg."totalConsumed" >= ${MIN_UNITS_SOLD}
      AND o."isHidden" = false
  `
  return new Map(rows.map((r) => [r.id, r]))
}

// Fallback while StockSnapshot history is still thin: real site orders for
// the last week. Undercounts items that mostly sell offline/through 1C, so
// it's only used per-item until that item's stock-based signal matures.
async function getSiteOrderFallbackRows(): Promise<Map<number, RawRow>> {
  const rows = await db.$queryRaw<RawRow[]>`
    SELECT
      o.id,
      o.article,
      o.name,
      o.brand,
      o.stock AS "currentStock",
      SUM(oi.qty)::int AS "totalConsumed",
      ${SITE_FALLBACK_DAYS}::float AS "daysSpanned"
    FROM "OrderItem" oi
    JOIN "Order" ord ON ord.id = oi."orderId"
    JOIN "OnecStockItem" o ON o.id = oi."onecStockItemId"
    WHERE ord."createdAt" >= NOW() - (${SITE_FALLBACK_DAYS}::int * INTERVAL '1 day')
      AND oi."onecStockItemId" IS NOT NULL
      AND o."isHidden" = false
    GROUP BY o.id, o.article, o.name, o.brand, o.stock
    HAVING SUM(oi.qty) >= ${MIN_UNITS_SOLD}
  `
  return new Map(rows.map((r) => [r.id, r]))
}

export async function getReorderRecommendations(): Promise<ReorderRow[]> {
  const [stockRows, siteRows] = await Promise.all([getStockBasedRows(), getSiteOrderFallbackRows()])

  const merged = new Map<number, ReorderRow>()

  // Site-orders fallback first — cheap immediate coverage while snapshot
  // history builds up.
  for (const [id, r] of siteRows) merged.set(id, toReorderRow(r, 'site'))

  // Stock-based signal wins per item once it has enough days of history —
  // it's channel-agnostic (site + offline/1C), so it's strictly more
  // trustworthy than the site-only fallback once it's had time to mature.
  for (const [id, r] of stockRows) {
    if (r.daysSpanned >= STOCK_MIN_DAYS_TO_TRUST) merged.set(id, toReorderRow(r, 'stock'))
  }

  // Manual admin corrections always win. An override can also pull in an
  // item the calculation didn't flag at all — the admin knows something the
  // formula doesn't (e.g. an item that mostly sells offline with too little
  // history yet).
  const overrides = await db.onecStockItem.findMany({
    where: { reorderQtyOverride: { not: null }, isHidden: false },
    select: { id: true, article: true, name: true, brand: true, stock: true, reorderQtyOverride: true },
  })
  for (const o of overrides) {
    const existing = merged.get(o.id)
    merged.set(o.id, {
      id: o.id,
      article: o.article,
      name: o.name,
      brand: o.brand,
      currentStock: o.stock,
      avgDailyConsumption: existing?.avgDailyConsumption ?? 0,
      daysOfHistory: existing?.daysOfHistory ?? 0,
      targetStock: existing?.targetStock ?? o.reorderQtyOverride!,
      reorderQty: o.reorderQtyOverride!,
      source: existing?.source ?? 'site',
      overridden: true,
    })
  }

  return [...merged.values()]
    .filter((r) => r.reorderQty > 0)
    .sort((a, b) => b.reorderQty - a.reorderQty)
}
