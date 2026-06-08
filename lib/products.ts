import { db } from './db'

export type ProductCard = {
  id: number
  name: string
  price: number
  salePrice: number | null
  imageUrl: string | null
  colorGroup: string | null
  sizeInches: string | null
  manufacturer: string | null
}

export type ProductFilters = {
  categoryId?: number
  colorGroup?: string
  shade?: string
  sizeInches?: string
  minPrice?: number
  maxPrice?: number
  manufacturer?: string
  holiday?: string
  search?: string
  sort?: 'price_asc' | 'price_desc' | 'name_asc'
  page?: number
  pageSize?: number
}

async function getCategoryDescendantIds(categoryId: number): Promise<number[]> {
  const cat = await db.category.findUnique({
    where: { id: categoryId },
    include: { children: { include: { children: true } } },
  })
  if (!cat) return [categoryId]
  const childIds = cat.children.map(c => c.id)
  const grandIds = cat.children.flatMap(c => c.children.map(g => g.id))
  return [categoryId, ...childIds, ...grandIds]
}

export async function getProducts(filters: ProductFilters = {}): Promise<{
  items: ProductCard[]
  total: number
}> {
  const { page = 1, pageSize = 48, search, categoryId, colorGroup, shade, sizeInches, minPrice, maxPrice, manufacturer, holiday, sort = 'price_asc' } = filters

  const categoryIds = categoryId ? await getCategoryDescendantIds(categoryId) : undefined

  const where = {
    isActive: true,
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(colorGroup && { colorGroup }),
    ...(shade && { shade }),
    ...(sizeInches && { sizeInches }),
    ...(manufacturer && { manufacturer }),
    ...(holiday && { holidays: { has: holiday } }),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { price: { ...(minPrice && { gte: minPrice }), ...(maxPrice && { lte: maxPrice }) } }
      : {}),
    ...(search && {
      AND: search.trim().split(/\s+/).filter(Boolean).map(word => ({
        OR: [
          { name: { contains: word, mode: 'insensitive' as const } },
          { color: { contains: word, mode: 'insensitive' as const } },
          { colorGroup: { contains: word, mode: 'insensitive' as const } },
          { manufacturer: { contains: word, mode: 'insensitive' as const } },
          { material: { contains: word, mode: 'insensitive' as const } },
          ...(!isNaN(Number(word)) ? [{ id: Number(word) }] : []),
        ],
      })),
    }),
  }

  const orderBy =
    sort === 'price_desc' ? { price: 'desc' as const } :
    sort === 'name_asc'   ? { name:  'asc'  as const } :
                            { price: 'asc'  as const }

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        salePrice: true,
        imageUrl: true,
        colorGroup: true,
        sizeInches: true,
        manufacturer: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ])

  return {
    items: items.map(p => ({
      ...p,
      price: Number(p.price),
      salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    })),
    total,
  }
}

export async function getProductById(id: number) {
  const product = await db.product.findUnique({
    where: { id },
    include: { category: { include: { parent: { include: { parent: true } } } } },
  })
  if (!product) return null
  return {
    ...product,
    price: Number(product.price),
    salePrice: product.salePrice != null ? Number(product.salePrice) : null,
  }
}

export async function getCategories() {
  return db.category.findMany({
    where: { level: 1 },
    include: {
      children: {
        include: { children: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getCategoryById(id: number) {
  return db.category.findUnique({
    where: { id },
    include: {
      parent: { include: { parent: true } },
      children: { orderBy: { name: 'asc' } },
    },
  })
}

export async function getColorGroups(): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, colorGroup: { not: null } },
    select: { colorGroup: true },
    distinct: ['colorGroup'],
    orderBy: { colorGroup: 'asc' },
  })
  return rows.map(r => r.colorGroup!).filter(Boolean)
}

export async function getManufacturers(): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, manufacturer: { not: null } },
    select: { manufacturer: true },
    distinct: ['manufacturer'],
    orderBy: { manufacturer: 'asc' },
  })
  return rows.map(r => r.manufacturer!).filter(Boolean)
}

export async function getSizes(): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, sizeInches: { not: null } },
    select: { sizeInches: true },
    distinct: ['sizeInches'],
    orderBy: { sizeInches: 'asc' },
  })
  return rows.map(r => r.sizeInches!).filter(Boolean)
}

export async function getShades(): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, shade: { not: null } },
    select: { shade: true },
    distinct: ['shade'],
    orderBy: { shade: 'asc' },
  })
  return rows.map(r => r.shade!).filter(Boolean)
}
