import { unstable_cache } from 'next/cache'
import { db } from './db'

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
  brand?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  inStockOnly?: boolean
  sort?: 'price_asc' | 'price_desc' | 'name_asc'
  page?: number
  pageSize?: number
}

async function getDescendantCategoryIds(categoryId: number): Promise<number[]> {
  const cat = await db.category.findUnique({
    where: { id: categoryId },
    include: { children: { include: { children: true } } },
  })
  if (!cat) return [categoryId]
  const childIds = cat.children.map(c => c.id)
  const grandIds = cat.children.flatMap(c => c.children.map(g => g.id))
  return [categoryId, ...childIds, ...grandIds]
}

export async function getStockItems(filters: StockFilters = {}): Promise<{
  items: StockCard[]
  total: number
}> {
  const {
    page = 1, pageSize = 48,
    categoryId, brand,
    minPrice, maxPrice, search,
    inStockOnly = false, sort = 'price_asc',
  } = filters

  const categoryIds = categoryId ? await getDescendantCategoryIds(categoryId) : undefined

  const where = {
    ...(inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(brand ? { brand } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { pricePerPc: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {}),
    ...(search ? {
      AND: search.trim().split(/\s+/).filter(Boolean).map(word => ({
        OR: [
          { name:     { contains: word, mode: 'insensitive' as const } },
          { fullName: { contains: word, mode: 'insensitive' as const } },
          { brand:    { contains: word, mode: 'insensitive' as const } },
          { article:  { contains: word, mode: 'insensitive' as const } },
          { barcode:  { contains: word, mode: 'insensitive' as const } },
        ],
      })),
    } : {}),
  }

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

async function _getSaleItems(limit = 8): Promise<StockCard[]> {
  const rawItems = await db.stockItem.findMany({
    where: { onSale: true },
    select: { id: true, name: true, fullName: true, brand: true, stock: true, pricePerPc: true, imageUrl: true, images: true, productId: true, onSale: true, salePercent: true },
    orderBy: { pricePerPc: 'asc' },
    take: limit,
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
  _getSaleItems,
  ['saleItems'],
  { revalidate: 300, tags: ['stockItems'] }
)
