// Storefront catalog data layer sourced from OnecStockItem/OnecCategory (1C sync).
// Parallel to lib/stock.ts (StockItem/Category) — kept separate rather than merged
// because the Product-table image/meta fallback that lib/stock.ts needs doesn't
// apply here (imageUrl/images live directly on OnecStockItem), and the category
// magic-number sort logic is replaced with name-based resolution against the real
// 1C tree instead of hardcoded ids.

import { unstable_cache } from 'next/cache'
import { db } from './db'
import { WORD_SYNONYMS } from './search-hints'
import { parseSearchQuery, stemRu, AUDIENCE_COLOR_BOOST, type ParsedSearchQuery } from './searchQuery'
import { embedQuery } from './embeddings'
import { getPackSize, isSoldByPiece, getDisplayPrice } from './pack'

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
  isHit: boolean
  // See DISCOUNT_EXCLUDED_TOP_NAMES below — false for gas equipment, helium, balloon
  // treatment gel, ORACAL film, and electric pumps. Carried onto CartItem exactly like
  // isBalloon so the cart/checkout discount calc (context/CartContext.tsx,
  // app/order/actions.ts) never applies the progressive discount to these.
  discountEligible: boolean
}

export type StockDetail = StockCard & {
  article: string | null
  barcode: string | null
  description: string | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  occasion: string | null
  color: string | null
  shade: string | null
  weightGrams: number | null
}

export type NovinkaCard = StockCard & { isNew: boolean; isNewPending: boolean }

export type StockFilters = {
  categoryId?: number
  categoryIds?: number[]
  brand?: string
  brands?: string[]
  sizeInches?: string
  shade?: string
  colorGroup?: string
  occasions?: string[]
  minPrice?: number
  maxPrice?: number
  search?: string
  inStockOnly?: boolean
  isNewPending?: boolean
  onSale?: boolean
  isHit?: boolean
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'smart' | 'hit'
  page?: number
  pageSize?: number
}

const SELECT_FIELDS = {
  id: true, slug: true, name: true, brand: true, sizeInches: true, packQty: true,
  stock: true, pricePerPc: true, imageUrl: true, images: true,
  onSale: true, salePercent: true, isNew: true, isNewPending: true, isHit: true, categoryId: true,
} as const

type RawItem = {
  id: number; slug: string | null; name: string; brand: string | null
  sizeInches: string | null; packQty: number | null; stock: number; pricePerPc: unknown
  imageUrl: string | null; images: string[]; onSale: boolean; salePercent: number | null; isNew: boolean
  isNewPending: boolean; isHit: boolean; categoryId: number | null
}

// OnecStockItem.images[] holds only the *extra* photos (scripts/link-onec-images.ts
// numbers them _1, _2, ...) — the head photo lives solely in imageUrl and is never
// duplicated into images[]. Card components render `images` as an ordered carousel
// and expect the head shot first, so it has to be prepended here.
function buildImages(imageUrl: string | null, images: string[]): string[] {
  if (!imageUrl) return images
  return [imageUrl, ...images.filter((u) => u !== imageUrl)]
}

// Electric pumps ("Насос электрический ...") share a flat category (Компрессоры и
// насосы / Насосы) with hand pumps, which stay discount-eligible — so this can't be
// a category exclusion and has to key off the name prefix 1C consistently uses.
function isElectricPump(name: string): boolean {
  return /^насос электрическ/i.test(name.trim())
}

// Shared by toCard() (customer-facing cards) and app/order/actions.ts (server-side
// checkout re-verification) so the two can never disagree about which line items the
// "прогрессивная скидка" excludes.
export function computeDiscountEligible(categoryId: number | null, name: string, flags: CategoryFlags): boolean {
  const isExcludedCategory = categoryId != null && flags.discountExcluded.has(categoryId)
  return !isExcludedCategory && !isElectricPump(name)
}

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
function toCard(i: RawItem, flags: CategoryFlags): StockCard {
  const isLatex = i.categoryId != null && flags.latex.has(i.categoryId)
  const isFoil = i.categoryId != null && flags.foil.has(i.categoryId)
  const discountEligible = computeDiscountEligible(i.categoryId, i.name, flags)
  return {
    id: i.id, slug: i.slug, name: i.name, fullName: null, brand: i.brand,
    stock: i.stock, pricePerPc: Number(i.pricePerPc),
    imageUrl: i.imageUrl, images: buildImages(i.imageUrl, i.images),
    material: isLatex ? 'латекс' : null,
    isBalloon: isLatex || isFoil,
    sizeInches: i.sizeInches, model: null, unitsPerPackage: null,
    packQty: i.packQty, onSale: i.onSale, salePercent: i.salePercent,
    isNew: i.isNew, isNewPending: i.isNewPending, isHit: i.isHit,
    discountEligible,
  }
}

export type SearchResultItem = {
  id: number
  slug: string | null
  name: string
  brand: string | null
  stock: number
  price: number
  packSize: number | null
  imageUrl: string | null
}

type SearchResultRow = {
  id: number
  slug: string | null
  name: string
  brand: string | null
  stock: number
  pricePerPc: unknown // Prisma Decimal
  sizeInches: string | null
  packQty: number | null
  imageUrl: string | null
  images: string[]
  categoryId: number | null
}

// Shared by /api/search/suggest and /api/search/popular — same isBalloon-aware price
// as toCard()/getDisplayPrice(). Without this, non-balloon packaged items (сервировка,
// пакеты, etc.) get pricePerPc wrongly multiplied by packQty a second time, since 1C's
// price for those categories already IS the whole pack price (see lib/pack.ts).
export async function toSearchResultItems(rows: SearchResultRow[]): Promise<SearchResultItem[]> {
  const flags = await resolveCategoryFlags()
  return rows.map((r) => {
    const isLatex = r.categoryId != null && flags.latex.has(r.categoryId)
    const isFoil = r.categoryId != null && flags.foil.has(r.categoryId)
    const packItem = {
      name: r.name, brand: r.brand, sizeInches: r.sizeInches, packQty: r.packQty,
      material: isLatex ? 'латекс' : null, isBalloon: isLatex || isFoil,
    }
    return {
      id: r.id, slug: r.slug, name: r.name, brand: r.brand, stock: r.stock,
      price: getDisplayPrice({ ...packItem, pricePerPc: Number(r.pricePerPc) }),
      packSize: isSoldByPiece(packItem) ? null : getPackSize(packItem),
      imageUrl: r.imageUrl ?? r.images[0] ?? null,
    }
  })
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

// Roots of the "прогрессивная скидка" (see lib/discounts.ts) exclusion — Mirasbek
// 2026-09-17: these aren't discountable goods (gas equipment/cylinders, helium
// itself, balloon-treatment gel, ORACAL vinyl film), so their subtrees are excluded
// from StockCard.discountEligible regardless of cart size. Electric pumps are
// handled separately (see isElectricPump) since they share a category with
// discount-eligible hand pumps.
const DISCOUNT_EXCLUDED_TOP_NAMES = [
  'Газовое оборудование',               // насадки и редукторы, аксессуары для баллонов
  'Гелий и баллоны',                     // гелий, гелий в портативном баллоне, пустые баллоны
  'Полимерный клей для шаров',           // "обработка" — гель для обработки латексных шаров
  'Пленка самоклеящаяся ORACAL',
]

type CategoryFlags = { latex: Set<number>; foil: Set<number>; foilDigit: Set<number>; latexNoPrint: Set<number>; discountExcluded: Set<number> }
// unstable_cache round-trips its return value through JSON, which can't represent
// a Set (comes back as `{}`, silently losing `.has`) — the cached layer works with
// plain arrays, and the exported wrapper below converts to Sets on every call.
type CategoryFlagsArrays = { latex: number[]; foil: number[]; foilDigit: number[]; latexNoPrint: number[]; discountExcluded: number[] }

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

  const discountExcluded = new Set<number>()
  for (const rootName of DISCOUNT_EXCLUDED_TOP_NAMES) {
    const rootId = findByName(rootName)
    if (rootId != null) for (const id of subtree(rootId)) discountExcluded.add(id)
  }

  return { latex: [...latex], foil: [...foil], foilDigit: [...foilDigit], latexNoPrint: [...latexNoPrint], discountExcluded: [...discountExcluded] }
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
    discountExcluded: new Set(a.discountExcluded),
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

export function scoreRelevance(
  name: string,
  brand: string | null,
  words: string[],
  extra?: {
    article?: string | null
    barcode?: string | null
    articleQuery?: string | null
    colorGroup?: string | null
    shade?: string | null
    boostColorGroups?: string[]
    stock?: number
    quantity?: number | null
  }
): number {
  let score = 0
  const short = name.toLowerCase()
  const bLow = (brand ?? '').toLowerCase()

  for (const word of words) {
    const w = word.toLowerCase()
    if (short === w) score += 12
    else if (short.startsWith(w + ' ') || short.startsWith(w)) score += 6
    else if (short.includes(' ' + w)) score += 3
    else if (short.includes(w)) score += 1

    if (bLow === w) score += 4
    else if (bLow.startsWith(w)) score += 2
    else if (bLow.includes(w)) score += 1
  }

  // Article match dominates everything else — a shopper who typed an article
  // number wants that exact product first (spec: "артикул должен иметь
  // максимальный приоритет").
  if (extra?.articleQuery) {
    const q = extra.articleQuery.toLowerCase()
    const article = (extra.article ?? '').toLowerCase().replace(/-/g, '')
    const barcode = (extra.barcode ?? '').toLowerCase()
    if (article && article === q) score += 1000
    else if (article && article.includes(q)) score += 500
    else if (barcode && barcode === q) score += 400
    else if (barcode && barcode.includes(q)) score += 150
  }

  if (extra?.boostColorGroups?.length && extra.colorGroup && extra.boostColorGroups.includes(extra.colorGroup)) {
    score += 30
  }

  if (extra?.quantity && extra.stock !== undefined && extra.stock >= extra.quantity) {
    score += 15
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

// Semantic fallback via pgvector — last resort after exact and pg_trgm-fuzzy both come up
// empty, e.g. descriptive queries that share no substring/spelling with any product name.
// Requires migration 20260824000000's `embedding` column + HNSW index.
const VECTOR_MAX_DISTANCE = 0.6 // cosine distance cutoff — tune after seeing real backfilled results

export async function getVectorItemIds(query: string, limit = 200): Promise<number[]> {
  const vector = await embedQuery(query)
  const literal = `[${vector.join(',')}]`
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM "OnecStockItem"
    WHERE
      "isHidden" = false
      AND embedding IS NOT NULL
      AND (embedding <=> ${literal}::vector) < ${VECTOR_MAX_DISTANCE}
    ORDER BY embedding <=> ${literal}::vector
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

export function buildStockWhere(opts: {
  categoryIds?: number[]
  brand?: string
  brands?: string[]
  sizeInches?: string
  shade?: string
  colorGroup?: string
  occasions?: string[]
  minPrice?: number
  maxPrice?: number
  search?: string
  inStockOnly?: boolean
  isNewPending?: boolean
  onSale?: boolean
  isHit?: boolean
}) {
  const { categoryIds, brand, brands, sizeInches, shade, colorGroup, occasions, minPrice, maxPrice, search, inStockOnly = false, isNewPending = false, onSale = false, isHit = false } = opts

  // Collected into one shared AND array (rather than each spreading its own top-level
  // OR/AND key) so multiple OR-groups active at once — e.g. novinki zone + occasion filter
  // — can't collide and silently overwrite each other via duplicate object keys.
  const andConditions: object[] = []
  // Same union as lib/onecStock.ts's _getNovinkaItems() (user decision 2026-07-30): every
  // product with novinka status, not just the donballon-agent isNewPending pipeline.
  if (isNewPending) andConditions.push({ OR: [{ isNewPending: true }, { isNew: true }] })
  // occasion stores multiple values in one row as "14 Февраля;8 Марта" — match any
  // selected occasion as a substring rather than an exact equals.
  if (occasions && occasions.length > 0) {
    andConditions.push({ OR: occasions.map((o) => ({ occasion: { contains: o, mode: 'insensitive' as const } })) })
  }
  if (search) {
    andConditions.push(...search.trim().split(/\s+/).filter(Boolean).map((word) => {
      const stem = stemRu(word.toLowerCase())
      // Try the word as typed, its crude stem (bridges "шаров" -> "шар" against
      // product names built from the singular), and any hand-curated synonyms
      // of either form.
      const variants = [...new Set([
        word, stem,
        ...(WORD_SYNONYMS[word.toLowerCase()] ?? []),
        ...(WORD_SYNONYMS[stem] ?? []),
      ])]
      return {
        OR: variants.flatMap((w) => [
          { name: { contains: w, mode: 'insensitive' as const } },
          { brand: { contains: w, mode: 'insensitive' as const } },
          { article: { contains: w, mode: 'insensitive' as const } },
          { barcode: { contains: w, mode: 'insensitive' as const } },
          { occasion: { contains: w, mode: 'insensitive' as const } },
          { colorGroup: { contains: w, mode: 'insensitive' as const } },
          { shade: { contains: w, mode: 'insensitive' as const } },
        ]),
      }
    }))
  }

  return {
    isHidden: false,
    ...(inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(onSale ? { onSale: true } : {}),
    ...(isHit ? { isHit: true } : {}),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(brands && brands.length > 0 ? { brand: { in: brands } } : brand ? { brand } : {}),
    ...(sizeInches ? { sizeInches } : {}),
    ...(shade ? { shade } : {}),
    ...(colorGroup ? { colorGroup } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { pricePerPc: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {}),
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  }
}

type SmartSortKey = {
  categoryIds: number[] | null
  brand: string | null
  brands: string[] | null
  sizeInches: string | null
  shade: string | null
  colorGroup: string | null
  occasions: string[] | null
  minPrice: number | null
  maxPrice: number | null
  search: string | null
  inStockOnly: boolean
  isNewPending: boolean
  onSale: boolean
  isHit: boolean
}

async function _fetchAllForSmartSort(key: SmartSortKey) {
  const where = buildStockWhere({
    categoryIds: key.categoryIds ?? undefined,
    brand: key.brand ?? undefined,
    brands: key.brands ?? undefined,
    sizeInches: key.sizeInches ?? undefined,
    shade: key.shade ?? undefined,
    colorGroup: key.colorGroup ?? undefined,
    occasions: key.occasions ?? undefined,
    minPrice: key.minPrice ?? undefined,
    maxPrice: key.maxPrice ?? undefined,
    search: key.search ?? undefined,
    inStockOnly: key.inStockOnly,
    isNewPending: key.isNewPending,
    onSale: key.onSale,
    isHit: key.isHit,
  })
  return db.onecStockItem.findMany({
    where,
    select: { id: true, name: true, brand: true, stock: true, categoryId: true, article: true, barcode: true, colorGroup: true },
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
async function fetchAllForSmartSort(key: SmartSortKey) {
  const isFullyUnfiltered = key.categoryIds == null && key.brand == null && key.brands == null && key.sizeInches == null && key.shade == null
    && key.colorGroup == null && key.occasions == null && key.minPrice == null && key.maxPrice == null && key.search == null
    && !key.inStockOnly && !key.isNewPending && !key.onSale && !key.isHit
  if (isFullyUnfiltered) {
    return _fetchAllForSmartSort(key)
  }
  return cachedFetchAllForSmartSort(key)
}

export async function getStockItems(filters: StockFilters = {}): Promise<{ items: StockCard[]; total: number }> {
  const {
    page = 1, pageSize = 48,
    categoryId, categoryIds: explicitCategoryIds, brand, brands,
    sizeInches, shade, colorGroup, occasions,
    minPrice, maxPrice, search,
    inStockOnly = false, isNewPending = false, onSale = false, isHit = false, sort = 'smart',
  } = filters

  const categoryIds = explicitCategoryIds
    ? explicitCategoryIds
    : categoryId ? await getDescendantCategoryIds(categoryId) : undefined

  // Natural-language layer: pull structured filters (color/shade/brand/size/
  // price/occasion) out of the free-text query. Explicit filters from the
  // catalog sidebar always win — the parsed query only fills in gaps the
  // sidebar left open, so combining a sidebar filter with a typed query never
  // fights itself.
  const parsed: ParsedSearchQuery | null = search ? parseSearchQuery(search) : null
  const explicitBrandSet = (brands && brands.length > 0) || !!brand
  const effBrands = !explicitBrandSet && parsed && parsed.brands.length > 0 ? parsed.brands : brands
  const effBrand = !explicitBrandSet && parsed && parsed.brands.length > 0 ? undefined : brand
  const effColorGroup = colorGroup ?? parsed?.colorGroups[0]
  const effShade = shade ?? parsed?.shades[0]
  const effOccasions = occasions && occasions.length > 0 ? occasions : (parsed && parsed.occasions.length > 0 ? parsed.occasions : occasions)
  const effSizeInches = sizeInches ?? parsed?.sizeInches ?? undefined
  const effMinPrice = minPrice ?? parsed?.minPrice ?? undefined
  const effMaxPrice = maxPrice ?? parsed?.maxPrice ?? undefined
  // Leftover free-text words after entities are pulled out — this is what
  // actually drives the per-word name/brand/article contains-match, so a
  // stray filler word (parsed out already) can no longer zero out results
  // just because it doesn't literally appear in any product name. Guarded so
  // a query that parses down to *nothing at all* (no structured filter, no
  // leftover words — e.g. "для мальчика" on its own) still falls back to the
  // raw text rather than silently dropping every constraint and returning
  // the whole catalog.
  const parsedHasStructure = !!parsed && (
    parsed.colorGroups.length > 0 || parsed.shades.length > 0 || parsed.brands.length > 0 ||
    parsed.occasions.length > 0 || parsed.sizeInches !== null || parsed.minPrice !== null || parsed.maxPrice !== null
  )
  const textSearch = parsed
    ? (parsed.words.join(' ') || (parsedHasStructure ? undefined : search))
    : search
  const articleQuery = parsed?.articleCandidates[0]
  const boostColorGroups = parsed?.audience && !effColorGroup ? AUDIENCE_COLOR_BOOST[parsed.audience] : undefined

  const where = buildStockWhere({
    categoryIds, brand: effBrand, brands: effBrands, sizeInches: effSizeInches, shade: effShade, colorGroup: effColorGroup,
    occasions: effOccasions, minPrice: effMinPrice, maxPrice: effMaxPrice, search: textSearch,
    inStockOnly, isNewPending, onSale, isHit,
  })

  if (sort === 'smart') {
    const flags = await resolveCategoryFlags()
    const isLatex = categoryIds != null && categoryIds.some((id) => flags.latex.has(id))
    const isFoil = categoryIds != null && categoryIds.some((id) => flags.foil.has(id))
    const isFoilDigit = categoryIds != null && categoryIds.length > 0 && categoryIds.every((id) => flags.foilDigit.has(id))

    const stableCatIds = categoryIds ? [...categoryIds].sort((a, b) => a - b) : null
    const allRows = [...(await fetchAllForSmartSort({
      categoryIds: stableCatIds, brand: effBrand ?? null, brands: effBrands ?? null, sizeInches: effSizeInches ?? null, shade: effShade ?? null,
      colorGroup: effColorGroup ?? null,
      occasions: effOccasions ?? null, minPrice: effMinPrice ?? null, maxPrice: effMaxPrice ?? null, search: textSearch ?? null,
      inStockOnly, isNewPending, onSale, isHit,
    }))]

    if (textSearch && textSearch.trim().length > 0) {
      const words = textSearch.trim().split(/\s+/).filter(Boolean)
      allRows.sort((a, b) =>
        scoreRelevance(b.name, b.brand, words, {
          article: b.article, barcode: b.barcode, articleQuery, colorGroup: b.colorGroup, boostColorGroups,
          quantity: parsed?.quantity, stock: b.stock,
        }) - scoreRelevance(a.name, a.brand, words, {
          article: a.article, barcode: a.barcode, articleQuery, colorGroup: a.colorGroup, boostColorGroups,
          quantity: parsed?.quantity, stock: a.stock,
        }) ||
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        a.name.localeCompare(b.name, 'ru')
      )
    } else if (isLatex) {
      allRows.sort((a, b) =>
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        latexSizeOrder(a.name) - latexSizeOrder(b.name) ||
        a.name.localeCompare(b.name, 'ru')
      )
    } else if (isFoilDigit) {
      allRows.sort((a, b) => {
        const [tagA, digA] = foilDigitGroupKey(a.name)
        const [tagB, digB] = foilDigitGroupKey(b.name)
        return (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || tagA.localeCompare(tagB, 'ru') || digA - digB
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

    // "Розовые хром 18" with no exact match: drop the two dimensions most
    // likely to over-constrain (size, then finish) — a size or shade parsed
    // out of free text — before giving up on structure entirely and falling
    // to trigram/vector fuzzy matching below (spec: "точных совпадений нет,
    // но мы нашли похожие варианты"). Only relaxes what the *query* implied,
    // never a filter the shopper explicitly picked in the sidebar.
    if (total === 0 && parsed && (parsed.sizeInches || parsed.shades.length > 0) && (sizeInches === undefined || shade === undefined)) {
      const relaxedWhere = buildStockWhere({
        categoryIds,
        brand: effBrand, brands: effBrands,
        sizeInches: sizeInches, // keep only if the shopper explicitly picked it
        shade: shade,
        colorGroup: effColorGroup,
        occasions: effOccasions, minPrice: effMinPrice, maxPrice: effMaxPrice, search: textSearch,
        inStockOnly, isNewPending, onSale, isHit,
      })
      const relaxedRows = await db.onecStockItem.findMany({ where: relaxedWhere, select: { id: true }, take: pageSize * 10 })
      if (relaxedRows.length > 0) {
        total = relaxedRows.length
        pageIds = relaxedRows.map((r) => r.id).slice((page - 1) * pageSize, page * pageSize)
      }
    }

    // Descriptive, intent-shaped queries ("шары для фотозоны", "что купить на
    // день рождения мальчика") rarely have a strong color/size/brand signal
    // and their leftover words often don't literally appear in any product
    // name either — trigram fuzzy matching won't rescue that. This is
    // exactly what the pgvector embedding search (getVectorItemIds) already
    // exists for, so hand it the query as soon as the structured+text pass
    // looks thin, instead of waiting for a hard zero further down.
    const looksDescriptive = !!parsed && parsed.words.length >= 2 &&
      !effColorGroup && !effShade && !effSizeInches && parsed.brands.length === 0 && parsed.occasions.length === 0
    if (search && looksDescriptive && total < 3) {
      const vectorIds = await getVectorItemIds(search, pageSize * 5)
      const known = new Set(allRows.map((r) => r.id))
      const extraIds = vectorIds.filter((id) => !known.has(id))
      if (extraIds.length > 0) {
        pageIds = [...pageIds, ...extraIds].slice(0, pageSize)
        total = Math.max(total, allRows.length + extraIds.length)
      }
    }

    if (search && total === 0) {
      const fuzzyIds = await getFuzzyItemIds(search, pageSize * 10)
      total = fuzzyIds.length
      pageIds = fuzzyIds.slice((page - 1) * pageSize, page * pageSize)
    }

    if (search && total === 0) {
      const vectorIds = await getVectorItemIds(search, pageSize * 10)
      total = vectorIds.length
      pageIds = vectorIds.slice((page - 1) * pageSize, page * pageSize)
    }

    if (pageIds.length === 0) return { total, items: [] }

    const rawItems = await db.onecStockItem.findMany({ where: { id: { in: pageIds } }, select: SELECT_FIELDS })
    const itemMap = new Map(rawItems.map((i) => [i.id, i]))
    const orderedRaw = pageIds.map((id) => itemMap.get(id)!).filter(Boolean)

    return { total, items: orderedRaw.map((i) => toCard(i, flags)) }
  }

  const orderBy =
    sort === 'hit' ? [{ isHit: 'desc' as const }, { pricePerPc: 'asc' as const }] :
    sort === 'price_desc' ? { pricePerPc: 'desc' as const } :
    sort === 'name_asc' ? { name: 'asc' as const } :
    { pricePerPc: 'asc' as const }

  const [flags, rawItems, total] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({ where, select: SELECT_FIELDS, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    db.onecStockItem.count({ where }),
  ])

  return { items: rawItems.map((i) => toCard(i, flags)), total }
}

// Detail-only fields (description, dimensions) — kept off SELECT_FIELDS since
// list/card queries never render them and shouldn't pay for the extra columns.
const DETAIL_ONLY_FIELDS = {
  article: true, barcode: true, isHidden: true,
  description: true, lengthMm: true, widthMm: true, heightMm: true,
  occasion: true, color: true, shade: true, weightGrams: true,
} as const

async function _getStockItemBySlug(slug: string): Promise<StockDetail | null> {
  const [flags, item] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findUnique({
      where: { slug },
      select: { ...SELECT_FIELDS, ...DETAIL_ONLY_FIELDS },
    }),
  ])
  // A hidden row (admin permanently unwanted, e.g. a duplicate/unwanted 1C offer
  // variant) must 404 the same as a genuinely missing item — a direct link should
  // stop resolving, not just drop out of listings.
  if (!item || item.isHidden) return null
  return {
    ...toCard(item, flags),
    article: item.article, barcode: item.barcode,
    description: item.description, lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm,
    occasion: item.occasion, color: item.color, shade: item.shade, weightGrams: item.weightGrams,
  }
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
      select: { ...SELECT_FIELDS, ...DETAIL_ONLY_FIELDS },
    }),
  ])
  // Same 404-not-just-delisted treatment as _getStockItemBySlug above.
  if (!item || item.isHidden) return null
  return {
    ...toCard(item, flags),
    article: item.article, barcode: item.barcode,
    description: item.description, lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm,
    occasion: item.occasion, color: item.color, shade: item.shade, weightGrams: item.weightGrams,
  }
}

export const getStockItemById = unstable_cache(
  _getStockItemById,
  ['onecStockItemById'],
  { revalidate: 300, tags: ['onecStockItems'] }
)

// ─── "Похожие товары" (product-page recommendations) ────────────────────────
//
// Not sales-based (see project memory — only ~15 orders exist so far, far too
// sparse for a real "bought together" signal). Content-based instead, scored
// within the same category by: shared occasion tags, matching color group,
// and overlapping meaningful words in the name. Padded with plain in-stock
// same-category items if too few candidates score above zero, so the section
// is never empty/thin in a sparsely-tagged category.

const NAME_STOPWORDS = new Set([
  'шар', 'шары', 'шарик', 'шарики', 'шт', 'уп', 'см', 'мм', 'ст', 'из', 'для', 'на', 'и', 'с', 'в', 'под', 'без',
])

function nameTokens(name: string): Set<string> {
  const words = name.toLowerCase().match(/\p{L}+/gu) ?? []
  return new Set(words.filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w)))
}

function similarityScore(
  source: { tokens: Set<string>; occasions: string[]; colorGroup: string | null },
  candidate: { name: string; occasion: string | null; colorGroup: string | null }
): number {
  let score = 0
  const candTokens = nameTokens(candidate.name)
  for (const t of candTokens) if (source.tokens.has(t)) score += 2

  if (candidate.occasion) {
    const candOccasions = candidate.occasion.split(';').map((o) => o.trim()).filter(Boolean)
    for (const o of candOccasions) if (source.occasions.includes(o)) score += 4
  }

  if (source.colorGroup && candidate.colorGroup && source.colorGroup === candidate.colorGroup) score += 3

  return score
}

async function _getSimilarStockItems(itemId: number, limit: number): Promise<StockCard[]> {
  const source = await db.onecStockItem.findUnique({
    where: { id: itemId },
    select: { name: true, occasion: true, colorGroup: true, categoryId: true },
  })
  if (!source || source.categoryId == null) return []

  const candidates = await db.onecStockItem.findMany({
    where: { isHidden: false, id: { not: itemId }, categoryId: source.categoryId, stock: { gt: 0 } },
    select: { id: true, name: true, occasion: true, colorGroup: true },
    take: 500,
  })
  if (candidates.length === 0) return []

  const sourceScoring = {
    tokens: nameTokens(source.name),
    occasions: source.occasion ? source.occasion.split(';').map((o) => o.trim()).filter(Boolean) : [],
    colorGroup: source.colorGroup,
  }

  const ranked = candidates
    .map((c) => ({ id: c.id, score: similarityScore(sourceScoring, c) }))
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, limit)

  const idOrder = new Map(ranked.map((r, i) => [r.id, i]))
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, select: SELECT_FIELDS }),
  ])
  return rawItems
    .map((i) => toCard(i, flags))
    .sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!)
}

export const getSimilarStockItems = unstable_cache(
  (itemId: number) => _getSimilarStockItems(itemId, 12),
  ['onecSimilarStockItems'],
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
  return rawItems.map((i) => toCard(i, flags))
}

// 6, not 8 — the homepage "Акция" section is a single lg:grid-cols-6 row (see
// ProductGrid.tsx); 8 items wrapped an ugly partial second row.
export const getSaleItems = unstable_cache(() => _getSaleItems(6), ['onecSaleItems'], { revalidate: 300, tags: ['onecStockItems'] })
export const getAllSaleItems = unstable_cache(() => _getSaleItems(), ['onecAllSaleItems'], { revalidate: 300, tags: ['onecStockItems'] })

// Novelties tab shows the union of both novinka signals (user decision 2026-07-30 — every
// product with "novinka" status should show here, not just the donballon-agent pipeline):
//   - isNewPending: rows the donballon-novelties agent (.claude/agents/donballon-novelties.md)
//     or an admin inserted ahead of the goods actually arriving (migration
//     20260725020000_add_onec_stockitem_admin_fields), never touched by 1C sync.
//   - isNew: the generic flag the ordinary 1C catalog sync sets on any brand-new SKU
//     (cleared by admin review, or by applyImportXml's absorbDonballonNovelties() flipping
//     it true when a pending row's real product arrives — see lib/onecImport.ts).
// A row can have either flag alone or both; NovinkaGrid/StockContent's `isNewPending &&
// !isNew` check still tells "still awaiting arrival" apart from "active novinka" within
// this combined set.
async function _getNovinkaItems(): Promise<NovinkaCard[]> {
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({
      where: { OR: [{ isNewPending: true }, { isNew: true }], isHidden: false },
      select: SELECT_FIELDS,
      orderBy: [{ createdAt: 'desc' }],
    }),
  ])
  return rawItems.map((i) => toCard(i, flags))
}

export const getNovinkaItems = unstable_cache(_getNovinkaItems, ['onecNovinkaItems'], { revalidate: 60, tags: ['onecStockItems'] })

// Not cached — избранное персонально, должно показывать актуальные цены/наличие.
export async function getStockCardsByIds(ids: number[]): Promise<StockCard[]> {
  if (ids.length === 0) return []
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    db.onecStockItem.findMany({ where: { id: { in: ids }, isHidden: false }, select: SELECT_FIELDS }),
  ])
  const byId = new Map(rawItems.map((i) => [i.id, toCard(i, flags)]))
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

export type FilterOptions = { brands: string[]; sizes: string[]; shades: string[]; colors: string[]; occasions: string[] }

// Scoped to categoryIds (the active category's own subtree) so e.g. latex-only
// shades/brands never leak into the foil filter list, and vice versa — this is
// the "сепарация брендов" separation the sidebar filters rely on. Pass null for
// the unscoped/whole-catalog view.
export const getOnecFilterOptions = unstable_cache(
  async (categoryIds: number[] | null): Promise<FilterOptions> => {
    const where = { isHidden: false, ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) }
    const [brandRows, sizeRows, shadeRows, colorRows, occasionRows] = await Promise.all([
      db.onecStockItem.findMany({ where: { ...where, brand: { not: null } }, select: { brand: true }, distinct: ['brand'] }),
      db.onecStockItem.findMany({ where: { ...where, sizeInches: { not: null } }, select: { sizeInches: true }, distinct: ['sizeInches'] }),
      db.onecStockItem.findMany({ where: { ...where, shade: { not: null } }, select: { shade: true }, distinct: ['shade'] }),
      db.onecStockItem.findMany({ where: { ...where, colorGroup: { not: null } }, select: { colorGroup: true }, distinct: ['colorGroup'] }),
      db.onecStockItem.findMany({ where: { ...where, occasion: { not: null } }, select: { occasion: true }, distinct: ['occasion'] }),
    ])
    return {
      brands: brandRows.map((r) => r.brand!).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')),
      sizes: sizeRows.map((r) => r.sizeInches!).filter(Boolean).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b, 'ru')),
      shades: shadeRows.map((r) => r.shade!).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')),
      colors: colorRows.map((r) => r.colorGroup!).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')),
      // occasion stores multiple values per row as "14 Февраля;8 Марта" — split and
      // dedupe into individual options.
      occasions: [...new Set(occasionRows.flatMap((r) => r.occasion!.split(';').map((s) => s.trim()).filter(Boolean)))]
        .sort((a, b) => a.localeCompare(b, 'ru')),
    }
  },
  ['onec-filter-options'],
  { revalidate: 3600, tags: ['filters'] }
)
