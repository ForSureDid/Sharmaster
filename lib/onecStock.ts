// Storefront catalog data layer sourced from OnecStockItem/OnecCategory (1C sync).
// Parallel to lib/stock.ts (StockItem/Category) — kept separate rather than merged
// because the Product-table image/meta fallback that lib/stock.ts needs doesn't
// apply here (imageUrl/images live directly on OnecStockItem), and the category
// magic-number sort logic is replaced with name-based resolution against the real
// 1C tree instead of hardcoded ids.

import { unstable_cache } from 'next/cache'
import { db } from './db'
import { WORD_SYNONYMS } from './search-hints'

export type StockCard = {
  id: number
  slug: string | null
  name: string
  fullName: string | null
  brand: string | null
  stock: number
  pricePerPc: number
  imageUrl: string | null
  images: string[]
  material: string | null
  isBalloon: boolean
  sizeInches: string | null
  model: string | null
  unitsPerPackage: number | null
  packQty: number | null
  onSale: boolean
  salePercent: number | null
  isNew: boolean
  isNewPending: boolean
}

export type StockDetail = StockCard & {
  article: string | null
  barcode: string | null
}

export type NovinkaCard = StockCard & { isNew: boolean; isNewPending: boolean }

export type StockFilters = {
  categoryId?: number
  categoryIds?: number[]
  brand?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  inStockOnly?: boolean
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'smart'
  page?: number
  pageSize?: number
}

const SELECT_FIELDS = {
  id: true, slug: true, name: true, brand: true, sizeInches: true, packQty: true,
  stock: true, pricePerPc: true, imageUrl: true, images: true,
  onSale: true, salePercent: true, isNew: true, categoryId: true,
} as const

type RawItem = {
  id: number; slug: string | null; name: string; brand: string | null
  sizeInches: string | null; packQty: number | null; stock: number; pricePerPc: unknown
  imageUrl: string | null; images: string[]; onSale: boolean; salePercent: number | null; isNew: boolean
  categoryId: number | null
}

// OnecStockItem.images[] holds only the *extra* photos (scripts/link-onec-images.ts
// numbers them _1, _2, ...) — the head photo lives solely in imageUrl and is never
// duplicated into images[]. Card components render `images` as an ordered carousel
// and expect the head shot first, so it has to be prepended here.
function buildImages(imageUrl: string | null, images: string[]): string[] {
  if (!imageUrl) return images
  return [imageUrl, ...images.filter((u) => u !== imageUrl)]
}

// OnecStockItem has no isNewPending column (that's a StockItem-only pre-arrival
// concept from the donballon novelties workflow) — always false here.
//
// `brand` is null on every OnecStockItem row (1C sync never populates it) — lib/pack.ts's
// isLatex()/isSoldByPiece() (the "latex 18''/24''/36'' giants always sold individually,
// with a quick-add for the full pack" rule) relies on `material`/`brand` to detect latex,
// which silently broke that rule for the whole catalog after the OnecStockItem cutover
// (giants fell back to plain packQty-based pack-only selling). `material` is derived here
// from real OnecCategory subtree membership instead — the same latex-detection signal
// getStockItems already uses for smart-sort, just threaded through to the card shape.
//
// `isBalloon` (latex ∪ foil) drives lib/pack.ts's getDisplayPrice(): only for actual
// balloons is pricePerPc genuinely a per-single-piece price that should be multiplied
// by packQty to show a pack price. For every other category (сервировка, свечи,
// топперы, перья, etc.) 1C's price already IS the whole pack/set price — packQty
// there is descriptive only, multiplying again double-counts it.
function toCard(i: RawItem, latexCategoryIds: Set<number>, foilCategoryIds: Set<number>): StockCard {
  const isLatex = i.categoryId != null && latexCategoryIds.has(i.categoryId)
  const isFoil = i.categoryId != null && foilCategoryIds.has(i.categoryId)
  return {
    id: i.id, slug: i.slug, name: i.name, fullName: null, brand: i.brand,
    stock: i.stock, pricePerPc: Number(i.pricePerPc),
    imageUrl: i.imageUrl, images: buildImages(i.imageUrl, i.images),
    material: isLatex ? 'латекс' : null,
    isBalloon: isLatex || isFoil,
    sizeInches: i.sizeInches, model: null, unitsPerPackage: null,
    packQty: i.packQty, onSale: i.onSale, salePercent: i.salePercent,
    isNew: i.isNew, isNewPending: false,
  }
}

// ─── Category name-based flags (replaces lib/stock.ts's hardcoded Category ids) ──
//
// The old Category tree hardcoded LATEX_IDS/FOIL_IDS/FOIL_DIGIT_IDS as raw numeric
// ids. OnecCategory is a live, re-synced tree from 1C — ids aren't stable across a
// full rebuild in principle, so this resolves the same buckets by walking the real
// tree from known top-level/branch names instead.
const LATEX_TOP_NAME = 'Воздушные шары из латекса'
const FOIL_TOP_NAME = 'Воздушные шары из фольги'
const FOIL_DIGIT_NAME = 'Цифры'
const LATEX_NO_PRINT_NAME = 'Круглые без рисунка'

type CategoryFlags = { latex: Set<number>; foil: Set<number>; foilDigit: Set<number>; latexNoPrint: Set<number> }
// unstable_cache round-trips its return value through JSON, which can't represent
// a Set (comes back as `{}`, silently losing `.has`) — the cached layer works with
// plain arrays, and the exported wrapper below converts to Sets on every call.
type CategoryFlagsArrays = { latex: number[]; foil: number[]; foilDigit: number[]; latexNoPrint: number[] }

async function _resolveCategoryFlagsArrays(): Promise<CategoryFlagsArrays> {
  const all = await db.onecCategory.findMany({ select: { id: true, name: true, parentId: true } })
  const childrenOf = new Map<number | null, { id: number; name: string }[]>()
  for (const c of all) {
    const key = c.parentId
    if (!childrenOf.has(key)) childrenOf.set(key, [])
    childrenOf.get(key)!.push({ id: c.id, name: c.name })
  }

  function subtree(rootId: number): Set<number> {
    const out = new Set<number>([rootId])
    const stack = [rootId]
    while (stack.length) {
      const id = stack.pop()!
      for (const child of childrenOf.get(id) ?? []) {
        if (!out.has(child.id)) { out.add(child.id); stack.push(child.id) }
      }
    }
    return out
  }

  function findByName(name: string, withinParent?: Set<number>): number | null {
    const hit = all.find((c) => c.name === name && (withinParent ? withinParent.has(c.id) : true))
    return hit?.id ?? null
  }

  const latexTopId = findByName(LATEX_TOP_NAME)
  const foilTopId = findByName(FOIL_TOP_NAME)
  const latex = latexTopId != null ? subtree(latexTopId) : new Set<number>()
  const foil = foilTopId != null ? subtree(foilTopId) : new Set<number>()

  const foilDigitId = foilTopId != null ? findByName(FOIL_DIGIT_NAME, foil) : null
  const foilDigit = foilDigitId != null ? subtree(foilDigitId) : new Set<number>()

  const latexNoPrintId = latexTopId != null ? findByName(LATEX_NO_PRINT_NAME, latex) : null
  const latexNoPrint = latexNoPrintId != null ? subtree(latexNoPrintId) : new Set<number>()

  return { latex: [...latex], foil: [...foil], foilDigit: [...foilDigit], latexNoPrint: [...latexNoPrint] }
}

const cachedCategoryFlagsArrays = unstable_cache(
  _resolveCategoryFlagsArrays,
  ['onec-category-flags'],
  { revalidate: 3600, tags: ['categories'] }
)

export async function resolveCategoryFlags(): Promise<CategoryFlags> {
  const a = await cachedCategoryFlagsArrays()
  return {
    latex: new Set(a.latex), foil: new Set(a.foil),
    foilDigit: new Set(a.foilDigit), latexNoPrint: new Set(a.latexNoPrint),
  }
}

// User-visible size priorities for latex: 12 → 24 → 18 → 5 → 36 → rest
const LATEX_SIZE_RANK: Record<number, number> = { 12: 1, 24: 2, 18: 3, 5: 4, 36: 5 }

function extractLatexSize(name: string): number {
  const rMatch = /^R(\d+)\s/.exec(name)
  if (rMatch) return parseInt(rMatch[1])
  const inchMatch = /\((\d+)''/.exec(name)
  if (inchMatch) return parseInt(inchMatch[1])
  return 0
}

function latexSizeOrder(name: string): number {
  return LATEX_SIZE_RANK[extractLatexSize(name)] ?? 6
}

function foilDigitGroupKey(name: string): [string, number] {
  const m = /(цифр[а-я]*[\s,]+)(?:\d+['"]\s+)?(\d{1,2})/i.exec(name)
  if (!m) return [name.toLowerCase(), 999]
  const digit = parseInt(m[2])
  const prefix = name.slice(0, m.index) + m[1]
  const suffix = name.slice(m.index + m[0].length)
  return [(prefix + '\x00' + suffix).toLowerCase(), digit]
}

export function scoreRelevance(name: string, brand: string | null, words: string[]): number {
  let score = 0
  const short = name.toLowerCase()
  const bLow = (brand ?? '').toLowerCase()

  for (const word of words) {
    const w = word.toLowerCase()
    if (short === w) score += 12
    else if (short.startsWith(w + ' ') || short.startsWith(w)) score += 6
    else if (short.includes(' ' + w)) score += 3
    else score += 1

    if (bLow === w) score += 4
    else if (bLow.startsWith(w)) score += 2
    else if (bLow.includes(w)) score += 1
  }
  return score
}

// Fuzzy search via pg_trgm — requires migration 20260725000000's GIN indexes.
export async function getFuzzyItemIds(query: string, limit = 200): Promise<number[]> {
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM "OnecStockItem"
    WHERE
      "isHidden" = false
      AND (
        word_similarity(${query}::text, name) > 0.25
        OR (brand IS NOT NULL AND similarity(${query}::text, brand) > 0.3)
      )
    ORDER BY
      GREATEST(
        word_similarity(${query}::text, name),
        COALESCE(similarity(${query}::text, brand), 0)
      ) DESC,
      CASE WHEN stock > 0 THEN 1 ELSE 0 END DESC
    LIMIT ${limit}
  `
  return rows.map((r) => Number(r.id))
}

export async function getDescendantCategoryIds(categoryId: number): Promise<number[]> {
  const cat = await db.onecCategory.findUnique({
    where: { id: categoryId },
    include: { children: { include: { children: { include: { children: true } } } } },
  })
  if (!cat) return [categoryId]
  const l2 = cat.children
  const l3 = l2.flatMap((c) => c.children)
  const l4 = l3.flatMap((c) => c.children)
  return [categoryId, ...l2.map((c) => c.id), ...l3.map((c) => c.id), ...l4.map((c) => c.id)]
}

export async function getOnecCategoryBySlug(slug: string): Promise<{ id: number; name: string; slug: string | null } | null> {
  return db.onecCategory.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } })
}

function buildStockWhere(opts: {
  categoryIds?: number[]
  brand?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  inStockOnly?: boolean
}) {
  const { categoryIds, brand, minPrice, maxPrice, search, inStockOnly = false } = opts
  return {
    isHidden: false,
    ...(inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(brand ? { brand } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { pricePerPc: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {}),
    ...(search ? {
      AND: search.trim().split(/\s+/).filter(Boolean).map((word) => {
        const variants = [word, ...(WORD_SYNONYMS[word.toLowerCase()] ?? [])]
        return {
          OR: variants.flatMap((w) => [
            { name: { contains: w, mode: 'insensitive' as const } },
            { brand: { contains: w, mode: 'insensitive' as const } },
            { article: { contains: w, mode: 'insensitive' as const } },
            { barcode: { contains: w, mode: 'insensitive' as const } },
          ]),
        }
      }),
    } : {}),
  }
}

async function _fetchAllForSmartSort(
  categoryIds: number[] | null,
  brand: string | null,
  minPrice: number | null,
  maxPrice: number | null,
  search: string | null,
  inStockOnly: boolean,
) {
  const where = buildStockWhere({
    categoryIds: categoryIds ?? undefined,
    brand: brand ?? undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: maxPrice ?? undefined,
    search: search ?? undefined,
    inStockOnly,
  })
  return db.onecStockItem.findMany({
    where,
    select: { id: true, name: true, brand: true, stock: true, categoryId: true },
  })
}

const cachedFetchAllForSmartSort = unstable_cache(
  _fetchAllForSmartSort,
  ['onec-stock-smart-sort'],
  { revalidate: 300, tags: ['onecStockItems'] }
)

// A fully unfiltered catalog scan is 25k+ rows (~3.3MB selected), over Next's 2MB
// data-cache entry limit — falls back to an uncached fetch for that one case (still
// a fast, plain indexed query; Postgres does it in milliseconds, the cost is
// payload transfer, not caching). Every category-filtered view is comfortably
// under the limit and gets the normal 5-minute cache.
async function fetchAllForSmartSort(
  categoryIds: number[] | null,
  brand: string | null,
  minPrice: number | null,
  maxPrice: number | null,
  search: string | null,
  inStockOnly: boolean,
) {
  const isFullyUnfiltered = categoryIds == null && brand == null && minPrice == null && maxPrice == null && search == null && !inStockOnly
  if (isFullyUnfiltered) {
    return _fetchAllForSmartSort(categoryIds, brand, minPrice, maxPrice, search, inStockOnly)
  }
  return cachedFetchAllForSmartSort(categoryIds, brand, minPrice, maxPrice, search, inStockOnly)
}

export async function getStockItems(filters: StockFilters = {}): Promise<{ items: StockCard[]; total: number }> {
  const {
    page = 1, pageSize = 48,
    categoryId, categoryIds: explicitCategoryIds, brand,
    minPrice, maxPrice, search,
    inStockOnly = false, sort = 'smart',
  } = filters

  const categoryIds = explicitCategoryIds
    ? explicitCategoryIds
    : categoryId ? await getDescendantCategoryIds(categoryId) : undefined

  const where = buildStockWhere({ categoryIds, brand, minPrice, maxPrice, search, inStockOnly })

  if (sort === 'smart') {
    const flags = await resolveCategoryFlags()
    const isLatex = categoryIds != null && categoryIds.some((id) => flags.latex.has(id))
    const isFoil = categoryIds != null && categoryIds.some((id) => flags.foil.has(id))
    const isFoilDigit = categoryIds != null && categoryIds.length > 0 && categoryIds.every((id) => flags.foilDigit.has(id))

    const stableCatIds = categoryIds ? [...categoryIds].sort((a, b) => a - b) : null
    const allRows = [...(await fetchAllForSmartSort(
      stableCatIds, brand ?? null, minPrice ?? null, maxPrice ?? null, search ?? null, inStockOnly,
    ))]

    if (search) {
      const words = search.trim().split(/\s+/).filter(Boolean)
      allRows.sort((a, b) =>
        scoreRelevance(b.name, b.brand, words) - scoreRelevance(a.name, a.brand, words) ||
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        a.name.localeCompare(b.name, 'ru')
      )
    } else if (isLatex) {
      allRows.sort((a, b) => latexSizeOrder(a.name) - latexSizeOrder(b.name) || a.name.localeCompare(b.name, 'ru'))
    } else if (isFoilDigit) {
      allRows.sort((a, b) => {
        const [tagA, digA] = foilDigitGroupKey(a.name)
        const [tagB, digB] = foilDigitGroupKey(b.name)
        return tagA.localeCompare(tagB, 'ru') || digA - digB || (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0)
      })
    } else if (isFoil) {
      allRows.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || a.name.localeCompare(b.name, 'ru'))
    } else {
      allRows.sort((a, b) =>
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        ((b.categoryId != null && flags.latexNoPrint.has(b.categoryId)) ? 1 : 0) - ((a.categoryId != null && flags.latexNoPrint.has(a.categoryId)) ? 1 : 0) ||
        (b.brand?.toLowerCase() === 'sempertex' ? 1 : 0) - (a.brand?.toLowerCase() === 'sempertex' ? 1 : 0) ||
        a.name.localeCompare(b.name, 'ru')
      )
    }

    let total = allRows.length
    let pageIds = allRows.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id)

    if (search && total === 0) {
      const fuzzyIds = await getFuzzyItemIds(search, pageSize * 10)
      total = fuzzyIds.length
      pageIds = fuzzyIds.slice((page - 1) * pageSize, page * pageSize)
    }

    if (pageIds.length === 0) return { total, items: [] }

    const rawItems = await db.onecStockItem.findMany({ where: { id: { in: pageIds } }, select: SELECT_FIELDS })
    const itemMap = new Map(rawItems.map((i) => [i.id, i]))
    const orderedRaw = pageIds.map((id) => itemMap.get(id)!).filter(Boolean)

    return { total, items: orderedRaw.map((i) => toCard(i, flags.latex, flags.foil)) }
  }

  const orderBy =
    sort === 'price_desc' ? { pricePerPc: 'desc' as const } :
    sort === 'name_asc' ? { name: 'asc' as const } :
    { pricePerPc: 'asc' as const }

  const [flags, rawItems, total] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({ where, select: SELECT_FIELDS, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    db.onecStockItem.count({ where }),
  ])

  return { items: rawItems.map((i) => toCard(i, flags.latex, flags.foil)), total }
}

async function _getStockItemBySlug(slug: string): Promise<StockDetail | null> {
  const [flags, item] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findUnique({
      where: { slug },
      select: { ...SELECT_FIELDS, article: true, barcode: true, isHidden: true },
    }),
  ])
  // A hidden row (admin permanently unwanted, e.g. a duplicate/unwanted 1C offer
  // variant) must 404 the same as a genuinely missing item — a direct link should
  // stop resolving, not just drop out of listings.
  if (!item || item.isHidden) return null
  return { ...toCard(item, flags.latex, flags.foil), article: item.article, barcode: item.barcode }
}

export const getStockItemBySlug = unstable_cache(
  _getStockItemBySlug,
  ['onecStockItemBySlug'],
  { revalidate: 300, tags: ['onecStockItems'] }
)

async function _getStockItemById(id: number): Promise<StockDetail | null> {
  const [flags, item] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findUnique({
      where: { id },
      select: { ...SELECT_FIELDS, article: true, barcode: true, isHidden: true },
    }),
  ])
  // Same 404-not-just-delisted treatment as _getStockItemBySlug above.
  if (!item || item.isHidden) return null
  return { ...toCard(item, flags.latex, flags.foil), article: item.article, barcode: item.barcode }
}

export const getStockItemById = unstable_cache(
  _getStockItemById,
  ['onecStockItemById'],
  { revalidate: 300, tags: ['onecStockItems'] }
)

async function _getSaleItems(limit?: number): Promise<StockCard[]> {
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({
      where: { onSale: true, isHidden: false },
      select: SELECT_FIELDS,
      orderBy: { pricePerPc: 'asc' },
      ...(limit != null ? { take: limit } : {}),
    }),
  ])
  return rawItems.map((i) => toCard(i, flags.latex, flags.foil))
}

export const getSaleItems = unstable_cache(() => _getSaleItems(8), ['onecSaleItems'], { revalidate: 300, tags: ['onecStockItems'] })
export const getAllSaleItems = unstable_cache(() => _getSaleItems(), ['onecAllSaleItems'], { revalidate: 300, tags: ['onecStockItems'] })

// Novelties are rows the donballon-novelties agent (.claude/agents/donballon-novelties.md)
// or an admin inserted ahead of the goods actually arriving — OnecStockItem.isNewPending
// (migration 20260725020000_add_onec_stockitem_admin_fields), never touched by 1C sync.
// Deliberately NOT the generic OnecStockItem.isNew flag: that one is also set by the
// ordinary 1C catalog sync for any brand-new SKU and is never cleared automatically, so
// filtering on it alone surfaced every "new since sync began" item ever, not just
// upcoming donballon novelties. When the real product arrives via 1C, applyImportXml's
// absorbDonballonNovelties() matches it to this row by article and clears isNewPending,
// so it naturally drops off this tab with no manual cleanup and no duplicate row.
async function _getNovinkaItems(): Promise<NovinkaCard[]> {
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({
      where: { isNewPending: true, isHidden: false },
      select: SELECT_FIELDS,
      orderBy: [{ createdAt: 'desc' }],
    }),
  ])
  return rawItems.map((i) => toCard(i, flags.latex, flags.foil))
}

export const getNovinkaItems = unstable_cache(_getNovinkaItems, ['onecNovinkaItems'], { revalidate: 60, tags: ['onecStockItems'] })

// Not cached — избранное персонально, должно показывать актуальные цены/наличие.
export async function getStockCardsByIds(ids: number[]): Promise<StockCard[]> {
  if (ids.length === 0) return []
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({ where: { id: { in: ids }, isHidden: false }, select: SELECT_FIELDS }),
  ])
  const byId = new Map(rawItems.map((i) => [i.id, toCard(i, flags.latex, flags.foil)]))
  return ids.map((id) => byId.get(id)).filter((c): c is StockCard => Boolean(c))
}

// Top-level categories + their direct children, for the catalog sidebar/mega-menu.
export const getOnecCategories = unstable_cache(
  () => db.onecCategory.findMany({
    where: { parentId: null },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true,
      children: { orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } },
    },
  }),
  ['onec-categories'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getOnecBrands = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.onecStockItem.findMany({ where: { brand: { not: null } }, select: { brand: true }, distinct: ['brand'], orderBy: { brand: 'asc' } })
    return rows.map((r) => r.brand!).filter(Boolean)
  },
  ['onec-brands'],
  { revalidate: 3600, tags: ['filters'] }
)
