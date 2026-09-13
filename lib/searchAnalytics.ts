// Search analytics — logs every shopper-initiated catalog search (a
// /catalog?q=... page view, not every autocomplete keystroke) and reports on
// it for the admin "Поиск" tab. Best-effort: a logging failure must never
// break the catalog page, and reporting reads are admin-only, low-volume.
import { db } from './db'

export async function logSearch(query: string, resultCount: number): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed) return
  try {
    await db.searchEvent.create({
      data: { query: trimmed, normalizedQuery: trimmed.toLowerCase(), resultCount },
    })
  } catch {
    // analytics is best-effort — never let a logging failure break the catalog page
  }
}

export type SearchClickSource = 'suggest' | 'catalog'

// A click on a product while a search query was active — the autocomplete
// dropdown ("suggest") or a card in the /catalog?q=... results grid
// ("catalog"). Best-effort, same as logSearch: never let a beacon failure
// break the page that fired it.
export async function logSearchClick(query: string, itemId: number, source: SearchClickSource): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed || !Number.isFinite(itemId)) return
  try {
    await db.searchClickEvent.create({
      data: { query: trimmed, normalizedQuery: trimmed.toLowerCase(), itemId: Math.trunc(itemId), source },
    })
  } catch {
    // analytics is best-effort
  }
}

async function getSearchClickCounts(days: number): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const grouped = await db.searchClickEvent.groupBy({
    by: ['normalizedQuery'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  })
  return new Map(grouped.map((g) => [g.normalizedQuery, g._count._all]))
}

export type TopClickedSearchItem = {
  itemId: number
  itemName: string
  clicks: number
}

// What people actually buy/click after searching, regardless of which query
// got them there — the closest thing to "behavioral learning" (spec §36)
// this pass implements: a signal an admin can read, not yet fed back into
// ranking automatically.
export async function getTopClickedSearchItems(days = 30, limit = 20): Promise<TopClickedSearchItem[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const grouped = await db.searchClickEvent.groupBy({
    by: ['itemId'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { itemId: 'desc' } },
    take: limit,
  })
  if (grouped.length === 0) return []
  const items = await db.onecStockItem.findMany({
    where: { id: { in: grouped.map((g) => g.itemId) } },
    select: { id: true, name: true },
  })
  const nameById = new Map(items.map((i) => [i.id, i.name]))
  return grouped.map((g) => ({
    itemId: g.itemId,
    itemName: nameById.get(g.itemId) ?? `#${g.itemId}`,
    clicks: g._count._all,
  }))
}

export type PopularSearchQuery = {
  normalizedQuery: string
  sampleQuery: string
  count: number
  avgResults: number
  clicks: number
  lastSearchedAt: Date
}

export type ZeroResultSearchQuery = {
  normalizedQuery: string
  sampleQuery: string
  count: number
  lastSearchedAt: Date
}

// groupBy gives counts/averages per normalizedQuery but not the original
// (human-readable) casing — one extra findFirst per group fills that in.
// Fine at admin-report volume (a few dozen groups, cached-free is deliberate
// since this is read rarely and should always reflect the latest data).
async function attachSampleQuery<T extends { normalizedQuery: string }>(rows: T[]): Promise<(T & { sampleQuery: string })[]> {
  const samples = await Promise.all(rows.map((r) =>
    db.searchEvent.findFirst({
      where: { normalizedQuery: r.normalizedQuery },
      orderBy: { createdAt: 'desc' },
      select: { query: true },
    })
  ))
  return rows.map((r, i) => ({ ...r, sampleQuery: samples[i]?.query ?? r.normalizedQuery }))
}

export async function getPopularSearchQueries(days = 30, limit = 50): Promise<PopularSearchQuery[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [grouped, clickCounts] = await Promise.all([
    db.searchEvent.groupBy({
      by: ['normalizedQuery'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { resultCount: true },
      _max: { createdAt: true },
      orderBy: { _count: { normalizedQuery: 'desc' } },
      take: limit,
    }),
    getSearchClickCounts(days),
  ])
  const rows = grouped.map((g) => ({
    normalizedQuery: g.normalizedQuery,
    count: g._count._all,
    avgResults: Math.round((g._avg.resultCount ?? 0) * 10) / 10,
    clicks: clickCounts.get(g.normalizedQuery) ?? 0,
    lastSearchedAt: g._max.createdAt!,
  }))
  return attachSampleQuery(rows)
}

export async function getZeroResultSearchQueries(days = 30, limit = 50): Promise<ZeroResultSearchQuery[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const grouped = await db.searchEvent.groupBy({
    by: ['normalizedQuery'],
    where: { createdAt: { gte: since }, resultCount: 0 },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { normalizedQuery: 'desc' } },
    take: limit,
  })
  const rows = grouped.map((g) => ({
    normalizedQuery: g.normalizedQuery,
    count: g._count._all,
    lastSearchedAt: g._max.createdAt!,
  }))
  return attachSampleQuery(rows)
}
