'use server'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath, updateTag } from 'next/cache'
import { assignSlugsForNewRows } from '@/lib/onecImport'

// Synthetic onecId prefix for items an admin creates directly (not from 1C, not from
// the donballon-novelties agent — that one uses "donballon-novelty-"). Never collides
// with a real 1C GUID, so sync never touches these rows.
const ADMIN_ONEC_ID_PREFIX = 'admin-'

async function requireAdmin() {
  const session = await getSession()
  if (!session || session.role !== 'admin') throw new Error('Unauthorized')
  return session
}

export async function getAdminStats() {
  await requireAdmin()
  const [totalOrders, pendingOrders, totalUsers, revenueResult] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: 'Принят' } }),
    db.user.count(),
    db.order.aggregate({ _sum: { total: true } }),
  ])
  return {
    totalOrders,
    pendingOrders,
    totalUsers,
    totalRevenue: Number(revenueResult._sum.total ?? 0),
  }
}

export async function getAllOrders() {
  await requireAdmin()
  return db.order.findMany({
    include: {
      items: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateOrderStatus(orderId: number, status: string) {
  await requireAdmin()
  const VALID_STATUSES = ['Принят', 'Обрабатывается', 'В пути', 'Отгружен', 'Отменён']
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status')
  await db.order.update({ where: { id: orderId }, data: { status } })
  revalidatePath('/admin')
}

export async function getStockItems(search = '', page = 0) {
  await requireAdmin()
  const take = 50
  const skip = page * take
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } },
          { article: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [items, total] = await Promise.all([
    db.onecStockItem.findMany({
      where,
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take,
      skip,
    }),
    db.onecStockItem.count({ where }),
  ])

  return {
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      article: i.article,
      brand: i.brand,
      sizeInches: i.sizeInches,
      stock: i.stock,
      pricePerPc: Number(i.pricePerPc),
      imageUrl: i.imageUrl,
      onSale: i.onSale,
      salePercent: i.salePercent,
      stockOverride: i.stockOverride,
      priceOverride: i.priceOverride,
    })),
    total,
  }
}

export async function updateSizeInches(id: number, sizeInches: string | null) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id }, data: { sizeInches: sizeInches?.trim() || null } })
  revalidatePath('/admin')
  revalidatePath('/catalog')
  revalidatePath('/catalog/[slug]')
}

// Manual stock edits are protected from the next 1C sync via stockOverride — see
// lib/onecImport.ts's updateOfferChunk().
export async function updateStockQty(id: number, stock: number) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id }, data: { stock: Math.max(0, stock), stockOverride: true } })
  revalidatePath('/admin')
  updateTag('onecStockItems')
}

export async function releaseStockOverride(id: number) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id }, data: { stockOverride: false } })
  revalidatePath('/admin')
}

export async function updateManualPrice(id: number, price: number) {
  await requireAdmin()
  if (price < 0) throw new Error('Цена не может быть отрицательной')
  await db.onecStockItem.update({ where: { id }, data: { pricePerPc: price, priceOverride: true } })
  revalidatePath('/admin')
  revalidatePath('/catalog')
  updateTag('onecStockItems')
}

export async function releasePriceOverride(id: number) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id }, data: { priceOverride: false } })
  revalidatePath('/admin')
}

export async function getSaleItems(search = '', page = 0) {
  await requireAdmin()
  const take = 50
  const skip = page * take
  const where = {
    onSale: true,
    ...(search ? {
      OR: [
        { name:    { contains: search, mode: 'insensitive' as const } },
        { article: { contains: search, mode: 'insensitive' as const } },
        { brand:   { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  }
  const [items, total] = await Promise.all([
    db.onecStockItem.findMany({ where, orderBy: { name: 'asc' }, take, skip }),
    db.onecStockItem.count({ where }),
  ])
  return {
    items: items.map(i => ({
      id: i.id, name: i.name, article: i.article, brand: i.brand,
      stock: i.stock, pricePerPc: Number(i.pricePerPc),
      imageUrl: i.imageUrl, onSale: i.onSale, salePercent: i.salePercent,
    })),
    total,
  }
}

export async function updateSaleStatus(id: number, onSale: boolean, salePercent: number | null) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id }, data: { onSale, salePercent: onSale ? salePercent : null } })
  revalidatePath('/admin')
  revalidatePath('/sale')
  revalidatePath('/catalog')
  updateTag('onecStockItems')
}

export async function searchAllItems(query: string) {
  await requireAdmin()
  if (!query.trim()) return []
  const rows = await db.onecStockItem.findMany({
    where: {
      OR: [
        { name:    { contains: query, mode: 'insensitive' } },
        { article: { contains: query, mode: 'insensitive' } },
        { brand:   { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, article: true, brand: true, pricePerPc: true, onSale: true, salePercent: true },
    take: 12,
    orderBy: { name: 'asc' },
  })
  return rows.map(r => ({ ...r, pricePerPc: Number(r.pricePerPc) }))
}

// OnecCategory has no `level` column (unlike the old Category) — depth is computed by
// walking the parent chain, cheap enough for ~250 rows.
export async function getAdminMeta() {
  await requireAdmin()
  const [categories, brandRows] = await Promise.all([
    db.onecCategory.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: 'asc' } }),
    // Note: OnecStockItem.brand is mostly NULL — 1C rarely sends Изготовитель — so this
    // dropdown will be sparse. That's a 1C data-feed gap, not fixable here.
    db.onecStockItem.findMany({
      where: { brand: { not: null } },
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    }),
  ])

  const byId = new Map(categories.map(c => [c.id, c]))
  function levelOf(c: { id: number; parentId: number | null }): number {
    let level = 1
    let cur = c
    while (cur.parentId != null) {
      const parent = byId.get(cur.parentId)
      if (!parent) break
      level++
      cur = parent
    }
    return level
  }

  return {
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      level: levelOf(c),
    })),
    brands: brandRows.map(r => r.brand!).filter(Boolean),
  }
}

export async function createStockItem(data: {
  name: string
  article?: string
  barcode?: string
  brand?: string
  sizeInches?: string
  stock: number
  pricePerPc: number
  categoryId?: number | null
  onSale: boolean
  salePercent?: number | null
  imageUrl?: string
  images?: string[]
}) {
  await requireAdmin()

  if (!data.name?.trim()) throw new Error('Название обязательно')
  if (data.pricePerPc < 0) throw new Error('Цена не может быть отрицательной')
  if (data.stock < 0)      throw new Error('Остаток не может быть отрицательным')

  // Duplicate guard — OnecStockItem.name has no DB-level unique constraint (unlike the
  // old StockItem), so this is an app-level check only.
  const dupe = await db.onecStockItem.findFirst({
    where: {
      OR: [
        { name: data.name.trim() },
        ...(data.article?.trim() ? [{ article: data.article.trim() }] : []),
      ],
    },
    select: { id: true, name: true, article: true },
  })
  if (dupe) {
    const by = dupe.article && data.article?.trim() === dupe.article
      ? `артикулу "${dupe.article}"`
      : `названию "${dupe.name}"`
    throw new Error(`Товар с таким ${by} уже есть в базе`)
  }

  const item = await db.onecStockItem.create({
    data: {
      onecId:     `${ADMIN_ONEC_ID_PREFIX}${randomUUID()}`,
      name:       data.name.trim(),
      article:    data.article?.trim()    || null,
      barcode:    data.barcode?.trim()    || null,
      brand:      data.brand?.trim()      || null,
      sizeInches: data.sizeInches?.trim() || null,
      stock:      data.stock,
      pricePerPc: data.pricePerPc,
      categoryId: data.categoryId ?? null,
      onSale:     data.onSale,
      salePercent: data.onSale ? (data.salePercent ?? null) : null,
      imageUrl:   data.imageUrl  || null,
      images:     data.images    ?? [],
      // Not 1C-managed at all — these flags are irrelevant here since sync will never
      // match this onecId, but set for consistency with items that do get absorbed.
      stockOverride: true,
      priceOverride: true,
    },
  })
  await assignSlugsForNewRows('OnecStockItem', [{ id: item.id, name: item.name }])

  revalidatePath('/')
  revalidatePath('/catalog')
  revalidatePath('/sale')
  revalidatePath('/admin')
  updateTag('onecStockItems')

  return { id: item.id, name: item.name }
}

export async function getNewArrivals(search = '', page = 0) {
  await requireAdmin()
  const take = 50
  const skip = page * take
  const baseWhere = search ? {
    OR: [
      { name:    { contains: search, mode: 'insensitive' as const } },
      { article: { contains: search, mode: 'insensitive' as const } },
      { brand:   { contains: search, mode: 'insensitive' as const } },
    ],
  } : {}
  const where = { OR: [{ isNew: true }, { isNewPending: true }], ...baseWhere }
  const [items, total] = await Promise.all([
    db.onecStockItem.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    db.onecStockItem.count({ where }),
  ])
  return {
    items: items.map(i => ({
      id: i.id, name: i.name, article: i.article, brand: i.brand,
      stock: i.stock, pricePerPc: Number(i.pricePerPc),
      imageUrl: i.imageUrl, isNew: i.isNew, isNewPending: i.isNewPending, createdAt: i.createdAt,
    })),
    total,
  }
}

export async function toggleNewArrival(stockItemId: number, isNew: boolean) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id: stockItemId }, data: { isNew, ...(isNew ? {} : { isNewPending: false }) } })
  revalidatePath('/admin')
  revalidatePath('/novinka')
  revalidatePath('/')
  updateTag('onecStockItems')
}

export async function setNewArrivalPending(stockItemId: number, pending: boolean) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id: stockItemId }, data: { isNewPending: pending, ...(pending ? { isNew: false } : {}) } })
  revalidatePath('/admin')
  revalidatePath('/novinka')
  revalidatePath('/')
  updateTag('onecStockItems')
}

// Search any OnecStockItem for adding to novinka (excludes already-marked ones)
export async function searchStockForNovinka(query: string) {
  await requireAdmin()
  if (!query.trim()) return []
  const rows = await db.onecStockItem.findMany({
    where: {
      isNew: false,
      isNewPending: false,
      OR: [
        { name:    { contains: query, mode: 'insensitive' } },
        { article: { contains: query, mode: 'insensitive' } },
        { brand:   { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, article: true, brand: true, stock: true, pricePerPc: true },
    take: 8,
    orderBy: { name: 'asc' },
  })
  return rows.map(r => ({ ...r, pricePerPc: Number(r.pricePerPc) }))
}

export async function getSyncStatus() {
  await requireAdmin()
  const [logs, onecItemCount] = await Promise.all([
    db.syncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.onecStockItem.count(),
  ])
  return {
    onecItemCount,
    logs: logs.map(l => ({
      id: l.id,
      source: l.source,
      status: l.status,
      created: l.created,
      updated: l.updated,
      skipped: l.skipped,
      message: l.message,
      createdAt: l.createdAt,
    })),
  }
}

export type OnecCategoryNode = {
  id: number
  name: string
  itemCount: number
  children: OnecCategoryNode[]
}

export async function getOnecCategoryTree(): Promise<{ tree: OnecCategoryNode[]; uncategorizedCount: number }> {
  await requireAdmin()
  const [categories, counts, uncategorizedCount] = await Promise.all([
    db.onecCategory.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: 'asc' } }),
    db.onecStockItem.groupBy({ by: ['categoryId'], _count: true, where: { categoryId: { not: null } } }),
    db.onecStockItem.count({ where: { categoryId: null } }),
  ])

  const countByCategoryId = new Map(counts.map(c => [c.categoryId, c._count]))
  const nodeById = new Map<number, OnecCategoryNode>()
  for (const c of categories) {
    nodeById.set(c.id, { id: c.id, name: c.name, itemCount: countByCategoryId.get(c.id) ?? 0, children: [] })
  }

  const tree: OnecCategoryNode[] = []
  for (const c of categories) {
    const node = nodeById.get(c.id)!
    if (c.parentId && nodeById.has(c.parentId)) {
      nodeById.get(c.parentId)!.children.push(node)
    } else {
      tree.push(node)
    }
  }

  return { tree, uncategorizedCount }
}

export async function getOnecItemsByCategory(categoryId: number | null, search = '', page = 0) {
  await requireAdmin()
  const take = 50
  const skip = page * take
  const where = {
    categoryId,
    ...(search ? {
      OR: [
        { name:    { contains: search, mode: 'insensitive' as const } },
        { article: { contains: search, mode: 'insensitive' as const } },
        { brand:   { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  }
  const [rows, total] = await Promise.all([
    db.onecStockItem.findMany({ where, orderBy: { name: 'asc' }, take, skip }),
    db.onecStockItem.count({ where }),
  ])

  return {
    items: rows.map(r => ({
      id: r.id, name: r.name, article: r.article, brand: r.brand,
      stock: r.stock, pricePerPc: Number(r.pricePerPc),
    })),
    total,
  }
}

export async function bulkCreateItems(rows: Array<{
  article: string; name: string; barcode: string
  brand: string; sizeInches: string; stock: number | null; price: number | null
}>) {
  await requireAdmin()
  if (!rows.length) throw new Error('Нет строк для создания')

  // Re-check conflicts right before inserting (race-condition guard)
  const articles = rows.filter(r => r.article).map(r => r.article)
  const names    = rows.map(r => r.name)

  const existing = await db.onecStockItem.findMany({
    where: {
      OR: [
        ...(articles.length ? [{ article: { in: articles } }] : []),
        { name: { in: names } },
      ],
    },
    select: { article: true, name: true },
  })
  const dupArticles = new Set(existing.filter(e => e.article).map(e => e.article!))
  const dupNames    = new Set(existing.map(e => e.name))

  const toCreate = rows.filter(r =>
    !(r.article && dupArticles.has(r.article)) && !dupNames.has(r.name)
  )
  const skipped = rows.length - toCreate.length

  let created = 0
  const errors: string[] = []
  const createdRows: { id: number; name: string }[] = []

  for (const r of toCreate) {
    try {
      const item = await db.onecStockItem.create({
        data: {
          onecId:     `${ADMIN_ONEC_ID_PREFIX}${randomUUID()}`,
          name:       r.name,
          article:    r.article    || null,
          barcode:    r.barcode    || null,
          brand:      r.brand      || null,
          sizeInches: r.sizeInches || null,
          stock:      r.stock   ?? 0,
          pricePerPc: r.price   ?? 0,
          onSale:     false,
          images:     [],
          stockOverride: true,
          priceOverride: true,
        },
      })
      created++
      createdRows.push({ id: item.id, name: item.name })
    } catch {
      errors.push(r.name)
    }
  }
  await assignSlugsForNewRows('OnecStockItem', createdRows)

  revalidatePath('/')
  revalidatePath('/catalog')
  revalidatePath('/admin')
  updateTag('onecStockItems')

  return { created, skipped, errors }
}
