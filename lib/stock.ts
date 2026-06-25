import { unstable_cache } from 'next/cache'
import { db } from './db'
import { WORD_SYNONYMS } from './search-hints'

export type StockCard = {
  id: number
  name: string
  fullName: string | null
  brand: string | null
  stock: number
  pricePerPc: number
  imageUrl: string | null
  images: string[]
  material: string | null
  sizeInches: string | null
  model: string | null
  unitsPerPackage: number | null
  onSale: boolean
  salePercent: number | null
}

export type StockDetail = StockCard & {
  article: string | null
  barcode: string | null
}

export type StockFilters = {
  categoryId?: number
  categoryIds?: number[]  // pre-expanded list; takes precedence over categoryId when set
  brand?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  inStockOnly?: boolean
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'smart'
  page?: number
  pageSize?: number
}

// Latex top-level ID 268 + its children; Foil top-level 275 + children
const LATEX_IDS = new Set([268, 269, 270, 271, 272, 273])
const FOIL_IDS  = new Set([275, 276, 277, 278, 279, 280, 281, 282, 283])

// User-visible size priorities for latex: 12 → 24 → 18 → 5 → 36 → rest
const LATEX_SIZE_RANK: Record<number, number> = { 12: 1, 24: 2, 18: 3, 5: 4, 36: 5 }

function extractLatexSize(name: string): number {
  // Sempertex: "R12 ...", "R5 ..."
  const rMatch = /^R(\d+)\s/.exec(name)
  if (rMatch) return parseInt(rMatch[1])
  // Other brands: "(12''/30 см)" pattern
  const inchMatch = /\((\d+)''/.exec(name)
  if (inchMatch) return parseInt(inchMatch[1])
  return 0
}

function latexSizeOrder(name: string): number {
  return LATEX_SIZE_RANK[extractLatexSize(name)] ?? 6
}

// Relevance score for a search query against one item.
// Higher = more relevant. Scoring tiers:
//   exact name match   → +12/word
//   prefix of name     → +6/word
//   word-boundary hit  → +3/word
//   substring          → +1/word (already guaranteed by WHERE clause)
//   brand exact        → +4/word   brand prefix → +2   brand substring → +1
export function scoreRelevance(
  name: string,
  fullName: string | null,
  brand: string | null,
  words: string[],
): number {
  let score = 0
  const short  = name.toLowerCase()
  const full   = (fullName ?? name).toLowerCase()
  const bLow   = (brand ?? '').toLowerCase()

  for (const word of words) {
    const w = word.toLowerCase()

    if (short === w || full === w) {
      score += 12
    } else if (short.startsWith(w + ' ') || short.startsWith(w) || full.startsWith(w + ' ') || full.startsWith(w)) {
      score += 6
    } else if (short.includes(' ' + w) || full.includes(' ' + w)) {
      score += 3
    } else {
      score += 1
    }

    if (bLow === w) score += 4
    else if (bLow.startsWith(w)) score += 2
    else if (bLow.includes(w)) score += 1
  }

  return score
}

// Fuzzy search via pg_trgm — returns ranked IDs of items whose name/fullName/brand
// is similar to the query (handles typos, wrong endings, etc.).
// Requires the pg_trgm extension and GIN indexes created by migration 20260624000000.
export async function getFuzzyItemIds(query: string, limit = 200): Promise<number[]> {
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM "StockItem"
    WHERE
      word_similarity(${query}::text, name) > 0.25
      OR ("fullName" IS NOT NULL AND word_similarity(${query}::text, "fullName") > 0.25)
      OR (brand IS NOT NULL AND similarity(${query}::text, brand) > 0.3)
    ORDER BY
      GREATEST(
        word_similarity(${query}::text, name),
        COALESCE(word_similarity(${query}::text, "fullName"), 0),
        COALESCE(similarity(${query}::text, brand), 0)
      ) DESC,
      CASE WHEN stock > 0 THEN 1 ELSE 0 END DESC
    LIMIT ${limit}
  `
  return rows.map((r) => Number(r.id))
}

export async function getDescendantCategoryIds(categoryId: number): Promise<number[]> {
  const cat = await db.category.findUnique({
    where: { id: categoryId },
    include: { children: { include: { children: true } } },
  })
  if (!cat) return [categoryId]
  const childIds = cat.children.map(c => c.id)
  const grandIds = cat.children.flatMap(c => c.children.map(g => g.id))
  return [categoryId, ...childIds, ...grandIds]
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
    ...(inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(brand ? { brand } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { pricePerPc: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {}),
    ...(search ? {
      AND: search.trim().split(/\s+/).filter(Boolean).map(word => {
        const variants = [word, ...(WORD_SYNONYMS[word.toLowerCase()] ?? [])]
        return {
          OR: variants.flatMap(w => [
            { name:     { contains: w, mode: 'insensitive' as const } },
            { fullName: { contains: w, mode: 'insensitive' as const } },
            { brand:    { contains: w, mode: 'insensitive' as const } },
            { article:  { contains: w, mode: 'insensitive' as const } },
            { barcode:  { contains: w, mode: 'insensitive' as const } },
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
  return db.stockItem.findMany({
    where,
    select: { id: true, name: true, fullName: true, brand: true, stock: true, categoryId: true },
  })
}

const fetchAllForSmartSort = unstable_cache(
  _fetchAllForSmartSort,
  ['stock-smart-sort'],
  { revalidate: 300, tags: ['stockItems'] }
)

export async function getStockItems(filters: StockFilters = {}): Promise<{
  items: StockCard[]
  total: number
}> {
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

  // ── Smart sort: two-pass (all IDs → JS sort → paginate → full fetch) ─────────
  if (sort === 'smart') {
    const isLatex = categoryIds != null && categoryIds.some(id => LATEX_IDS.has(id))
    const isFoil  = categoryIds != null && categoryIds.some(id => FOIL_IDS.has(id))

    // Stable cache key: sort category IDs numerically
    const stableCatIds = categoryIds ? [...categoryIds].sort((a, b) => a - b) : null
    const allRows = [...(await fetchAllForSmartSort(
      stableCatIds,
      brand ?? null,
      minPrice ?? null,
      maxPrice ?? null,
      search ?? null,
      inStockOnly,
    ))]

    if (search) {
      // Search active: sort by relevance first, then in-stock, then alpha
      const words = search.trim().split(/\s+/).filter(Boolean)
      allRows.sort((a, b) =>
        scoreRelevance(b.name, b.fullName, b.brand, words) -
        scoreRelevance(a.name, a.fullName, a.brand, words) ||
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        a.name.localeCompare(b.name, 'ru')
      )
    } else if (isLatex) {
      allRows.sort((a, b) =>
        latexSizeOrder(a.name) - latexSizeOrder(b.name) ||
        a.name.localeCompare(b.name, 'ru')
      )
    } else if (isFoil) {
      allRows.sort((a, b) =>
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        a.name.localeCompare(b.name, 'ru')
      )
    } else {
      // Default: in-stock first → latex without print (cat 270) → Sempertex → alphabetical
      allRows.sort((a, b) =>
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        (b.categoryId === 270 ? 1 : 0) - (a.categoryId === 270 ? 1 : 0) ||
        (b.brand?.toLowerCase() === 'sempertex' ? 1 : 0) - (a.brand?.toLowerCase() === 'sempertex' ? 1 : 0) ||
        a.name.localeCompare(b.name, 'ru')
      )
    }

    let total = allRows.length
    let pageIds = allRows.slice((page - 1) * pageSize, page * pageSize).map(r => r.id)

    // ── Fuzzy fallback: zero exact results → try pg_trgm ────────────────────────
    if (search && total === 0) {
      const fuzzyIds = await getFuzzyItemIds(search, pageSize * 10)
      total = fuzzyIds.length
      pageIds = fuzzyIds.slice((page - 1) * pageSize, page * pageSize)
    }

    if (pageIds.length === 0) return { total, items: [] }

    const rawItems = await db.stockItem.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, name: true, fullName: true, brand: true, stock: true, pricePerPc: true, imageUrl: true, images: true, productId: true, onSale: true, salePercent: true },
    })
    const itemMap = new Map(rawItems.map(i => [i.id, i]))
    const orderedRaw = pageIds.map(id => itemMap.get(id)!).filter(Boolean)

    const linkedProductIds = orderedRaw.filter(i => i.productId != null).map(i => i.productId!)
    type ProductMeta = { imageUrl: string | null; images: string[]; material: string | null; sizeInches: string | null; model: string | null; unitsPerPackage: number | null }
    const productMetaMap = new Map<number, ProductMeta>()
    if (linkedProductIds.length > 0) {
      const products = await db.product.findMany({
        where: { id: { in: linkedProductIds } },
        select: { id: true, imageUrl: true, images: true, material: true, sizeInches: true, model: true, unitsPerPackage: true },
      })
      for (const p of products) productMetaMap.set(p.id, p)
    }

    return {
      total,
      items: orderedRaw.map(i => {
        const prod = i.productId != null ? productMetaMap.get(i.productId!) : undefined
        const { headUrl, allImages } = buildImages(i, prod)
        return {
          id: i.id, name: i.name, fullName: i.fullName, brand: i.brand,
          stock: i.stock, pricePerPc: Number(i.pricePerPc),
          imageUrl: headUrl, images: allImages,
          material: prod?.material ?? null, sizeInches: prod?.sizeInches ?? null,
          model: prod?.model ?? null, unitsPerPackage: prod?.unitsPerPackage ?? null,
          onSale: i.onSale, salePercent: i.salePercent,
        }
      }),
    }
  }

  // ── Explicit sort (price_asc / price_desc / name_asc) ─────────────────────────
  const orderBy =
    sort === 'price_desc' ? { pricePerPc: 'desc' as const } :
    sort === 'name_asc'   ? { name:       'asc'  as const } :
                            { pricePerPc: 'asc'  as const }

  const [rawItems, total] = await Promise.all([
    db.stockItem.findMany({
      where,
      select: { id: true, name: true, fullName: true, brand: true, stock: true, pricePerPc: true, imageUrl: true, images: true, productId: true, onSale: true, salePercent: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.stockItem.count({ where }),
  ])

  // Fetch product meta (images + pack logic fields) for linked products
  const linkedProductIds = rawItems.filter(i => i.productId != null).map(i => i.productId!)
  type ProductMeta = { imageUrl: string | null; images: string[]; material: string | null; sizeInches: string | null; model: string | null; unitsPerPackage: number | null }
  const productMetaMap = new Map<number, ProductMeta>()
  if (linkedProductIds.length > 0) {
    const products = await db.product.findMany({
      where: { id: { in: linkedProductIds } },
      select: { id: true, imageUrl: true, images: true, material: true, sizeInches: true, model: true, unitsPerPackage: true },
    })
    for (const p of products) productMetaMap.set(p.id, p)
  }

  return {
    items: rawItems.map(i => {
      const prod = i.productId != null ? productMetaMap.get(i.productId!) : undefined
      const { headUrl, allImages } = buildImages(i, prod)
      return {
        id: i.id,
        name: i.name,
        fullName: i.fullName,
        brand: i.brand,
        stock: i.stock,
        pricePerPc: Number(i.pricePerPc),
        imageUrl: headUrl,
        images: allImages,
        material: prod?.material ?? null,
        sizeInches: prod?.sizeInches ?? null,
        model: prod?.model ?? null,
        unitsPerPackage: prod?.unitsPerPackage ?? null,
        onSale: i.onSale,
        salePercent: i.salePercent,
      }
    }),
    total,
  }
}

function buildImages(
  item: { imageUrl: string | null; images: string[] },
  prod?: { imageUrl: string | null; images: string[] } | null
): { headUrl: string | null; allImages: string[] } {
  if (item.imageUrl) {
    return { headUrl: item.imageUrl, allImages: [item.imageUrl, ...item.images.filter(u => u !== item.imageUrl)] }
  }
  if (prod?.imageUrl) {
    const extras = prod.images ?? []
    return { headUrl: prod.imageUrl, allImages: [prod.imageUrl, ...extras.filter(u => u !== prod.imageUrl)] }
  }
  const allImages = item.images.length > 0 ? item.images : (prod?.images ?? [])
  return { headUrl: allImages[0] ?? null, allImages }
}

async function _getStockItemById(id: number): Promise<StockDetail | null> {
  const item = await db.stockItem.findUnique({
    where: { id },
    select: { id: true, name: true, fullName: true, brand: true, stock: true, pricePerPc: true, imageUrl: true, images: true, article: true, barcode: true, productId: true, onSale: true, salePercent: true },
  })
  if (!item) return null

  let prod: { imageUrl: string | null; images: string[]; material: string | null; sizeInches: string | null; model: string | null; unitsPerPackage: number | null } | null = null
  if (item.productId) {
    prod = await db.product.findUnique({
      where: { id: item.productId },
      select: { imageUrl: true, images: true, material: true, sizeInches: true, model: true, unitsPerPackage: true },
    })
  }

  const { headUrl, allImages } = buildImages(item, prod)
  return {
    id: item.id,
    name: item.name,
    fullName: item.fullName,
    brand: item.brand,
    stock: item.stock,
    pricePerPc: Number(item.pricePerPc),
    imageUrl: headUrl,
    images: allImages,
    material: prod?.material ?? null,
    sizeInches: prod?.sizeInches ?? null,
    model: prod?.model ?? null,
    unitsPerPackage: prod?.unitsPerPackage ?? null,
    onSale: item.onSale,
    salePercent: item.salePercent,
    article: item.article,
    barcode: item.barcode,
  }
}

export const getStockItemById = unstable_cache(
  _getStockItemById,
  ['stockItem'],
  { revalidate: 300, tags: ['stockItems'] }
)

async function _getSaleItems(limit?: number): Promise<StockCard[]> {
  const rawItems = await db.stockItem.findMany({
    where: { onSale: true },
    select: { id: true, name: true, fullName: true, brand: true, stock: true, pricePerPc: true, imageUrl: true, images: true, productId: true, onSale: true, salePercent: true },
    orderBy: { pricePerPc: 'asc' },
    ...(limit != null ? { take: limit } : {}),
  })

  const linkedProductIds = rawItems.filter(i => i.productId != null).map(i => i.productId!)
  type ProductMeta = { imageUrl: string | null; images: string[]; material: string | null; sizeInches: string | null; model: string | null; unitsPerPackage: number | null }
  const productMetaMap = new Map<number, ProductMeta>()
  if (linkedProductIds.length > 0) {
    const products = await db.product.findMany({
      where: { id: { in: linkedProductIds } },
      select: { id: true, imageUrl: true, images: true, material: true, sizeInches: true, model: true, unitsPerPackage: true },
    })
    for (const p of products) productMetaMap.set(p.id, p)
  }

  return rawItems.map(i => {
    const prod = i.productId != null ? productMetaMap.get(i.productId!) : undefined
    const { headUrl, allImages } = buildImages(i, prod)
    return {
      id: i.id,
      name: i.name,
      fullName: i.fullName,
      brand: i.brand,
      stock: i.stock,
      pricePerPc: Number(i.pricePerPc),
      imageUrl: headUrl,
      images: allImages,
      material: prod?.material ?? null,
      sizeInches: prod?.sizeInches ?? null,
      model: prod?.model ?? null,
      unitsPerPackage: prod?.unitsPerPackage ?? null,
      onSale: i.onSale,
      salePercent: i.salePercent,
    }
  })
}

export const getSaleItems = unstable_cache(
  () => _getSaleItems(8),
  ['saleItems'],
  { revalidate: 300, tags: ['stockItems'] }
)

export const getAllSaleItems = unstable_cache(
  () => _getSaleItems(),
  ['allSaleItems'],
  { revalidate: 300, tags: ['stockItems'] }
)
