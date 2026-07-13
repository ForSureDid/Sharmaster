'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

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
  const VALID_STATUSES = ['Принят', 'Обрабатывается', 'В пути', 'Доставлен', 'Отменён']
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
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } },
          { article: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [items, total] = await Promise.all([
    db.stockItem.findMany({
      where,
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take,
      skip,
    }),
    db.stockItem.count({ where }),
  ])

  return {
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      fullName: i.fullName,
      article: i.article,
      brand: i.brand,
      sizeInches: i.sizeInches,
      stock: i.stock,
      pricePerPc: Number(i.pricePerPc),
      imageUrl: i.imageUrl,
      onSale: i.onSale,
      salePercent: i.salePercent,
    })),
    total,
  }
}

export async function updateSizeInches(id: number, sizeInches: string | null) {
  await requireAdmin()
  await db.stockItem.update({ where: { id }, data: { sizeInches: sizeInches?.trim() || null } })
  revalidatePath('/admin')
  revalidatePath('/catalog')
  revalidatePath('/catalog/[id]')
}

export async function updateStockQty(id: number, stock: number) {
  await requireAdmin()
  await db.stockItem.update({ where: { id }, data: { stock: Math.max(0, stock) } })
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
    db.stockItem.findMany({ where, orderBy: { name: 'asc' }, take, skip }),
    db.stockItem.count({ where }),
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
  await db.stockItem.update({ where: { id }, data: { onSale, salePercent: onSale ? salePercent : null } })
  revalidatePath('/admin')
  revalidatePath('/sale')
  revalidatePath('/catalog')
}

export async function searchAllItems(query: string) {
  await requireAdmin()
  if (!query.trim()) return []
  const rows = await db.stockItem.findMany({
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

export async function getAdminMeta() {
  await requireAdmin()
  const [categories, brandRows] = await Promise.all([
    db.category.findMany({ orderBy: { name: 'asc' } }),
    db.stockItem.findMany({
      where: { brand: { not: null } },
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    }),
  ])
  return {
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      level: c.level,
    })),
    brands: brandRows.map(r => r.brand!).filter(Boolean),
  }
}

export async function createStockItem(data: {
  name: string
  fullName?: string
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

  // Duplicate guard
  const dupe = await db.stockItem.findFirst({
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

  const item = await db.stockItem.create({
    data: {
      name:       data.name.trim(),
      fullName:   data.fullName?.trim()   || null,
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
    },
  })

  revalidatePath('/')
  revalidatePath('/catalog')
  revalidatePath('/sale')
  revalidatePath('/admin')

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
    db.stockItem.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    db.stockItem.count({ where }),
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
  await db.stockItem.update({ where: { id: stockItemId }, data: { isNew, ...(isNew ? {} : { isNewPending: false }) } })
  revalidatePath('/admin')
  revalidatePath('/novinka')
}

export async function setNewArrivalPending(stockItemId: number, pending: boolean) {
  await requireAdmin()
  await db.stockItem.update({ where: { id: stockItemId }, data: { isNewPending: pending, ...(pending ? { isNew: false } : {}) } })
  revalidatePath('/admin')
  revalidatePath('/novinka')
}

// Search any StockItem for adding to novinka (excludes already-marked ones)
export async function searchStockForNovinka(query: string) {
  await requireAdmin()
  if (!query.trim()) return []
  const rows = await db.stockItem.findMany({
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

// 1C items that are marked isNew (appeared in a sync for the first time)
export async function getOnecNewItems(search = '', page = 0) {
  await requireAdmin()
  const take = 50
  const skip = page * take
  const where = {
    isNew: true,
    ...(search ? {
      OR: [
        { name:    { contains: search, mode: 'insensitive' as const } },
        { article: { contains: search, mode: 'insensitive' as const } },
        { brand:   { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  }
  const [rows, total] = await Promise.all([
    db.onecStockItem.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    db.onecStockItem.count({ where }),
  ])

  // Try to find matching StockItem for each (by article or barcode)
  const articles = rows.filter(r => r.article).map(r => r.article!)
  const barcodes = rows.filter(r => r.barcode).map(r => r.barcode!)
  const matched = await db.stockItem.findMany({
    where: {
      OR: [
        ...(articles.length ? [{ article: { in: articles } }] : []),
        ...(barcodes.length ? [{ barcode: { in: barcodes } }]  : []),
      ],
    },
    select: { id: true, article: true, barcode: true, isNew: true },
  })
  const byArticle = new Map(matched.filter(m => m.article).map(m => [m.article!, m]))
  const byBarcode = new Map(matched.filter(m => m.barcode).map(m => [m.barcode!, m]))

  return {
    items: rows.map(r => {
      const si = (r.article ? byArticle.get(r.article) : undefined)
                ?? (r.barcode ? byBarcode.get(r.barcode) : undefined)
      return {
        id: r.id, onecId: r.onecId, name: r.name,
        article: r.article, barcode: r.barcode, brand: r.brand,
        stock: r.stock, pricePerPc: Number(r.pricePerPc),
        groupName: r.groupName, createdAt: r.createdAt,
        stockItemId:    si?.id     ?? null,
        stockItemIsNew: si?.isNew  ?? null,
        inCatalog:      !!si,
      }
    }),
    total,
  }
}

export async function dismissOnecNewItem(onecId: number) {
  await requireAdmin()
  await db.onecStockItem.update({ where: { id: onecId }, data: { isNew: false } })
}

export async function markStockItemNewFromOnec(onecId: number) {
  await requireAdmin()
  const onecItem = await db.onecStockItem.findUnique({ where: { id: onecId } })
  if (!onecItem) throw new Error('1С товар не найден')

  // Find matching StockItem
  const stockItem = await db.stockItem.findFirst({
    where: {
      OR: [
        ...(onecItem.article ? [{ article: onecItem.article }] : []),
        ...(onecItem.barcode ? [{ barcode: onecItem.barcode }] : []),
      ],
    },
    select: { id: true },
  })

  if (!stockItem) throw new Error('Товар не найден в каталоге сайта (нет совпадения по артикулу/штрихкоду)')

  await db.stockItem.update({ where: { id: stockItem.id }, data: { isNew: true, isNewPending: false } })
  await db.onecStockItem.update({ where: { id: onecId }, data: { isNew: false } })
  revalidatePath('/admin')
  revalidatePath('/')
  return { stockItemId: stockItem.id }
}

export type OnecSyncRow = {
  onecId: number
  name: string
  article: string | null
  barcode: string | null
  stockItemId: number
  stockItemName: string
  oldStock: number
  newStock: number
  oldPrice: number
  newPrice: number
}

export async function previewOnecStockSync(): Promise<{ rows: OnecSyncRow[]; unmatched: number }> {
  await requireAdmin()

  const [onecItems, stockItems] = await Promise.all([
    db.onecStockItem.findMany({ select: { id: true, onecId: true, name: true, article: true, barcode: true, stock: true, pricePerPc: true } }),
    db.stockItem.findMany({ select: { id: true, name: true, article: true, barcode: true, stock: true, pricePerPc: true } }),
  ])

  const byArticle = new Map(stockItems.filter(s => s.article).map(s => [s.article!, s]))
  const byBarcode = new Map(stockItems.filter(s => s.barcode).map(s => [s.barcode!, s]))

  const rows: OnecSyncRow[] = []
  let unmatched = 0

  for (const o of onecItems) {
    const match = (o.article && byArticle.get(o.article)) || (o.barcode && byBarcode.get(o.barcode)) || null
    if (!match) { unmatched++; continue }

    const newPrice = Number(o.pricePerPc)
    const oldPrice = Number(match.pricePerPc)
    if (o.stock === match.stock && Math.abs(newPrice - oldPrice) < 0.01) continue

    rows.push({
      onecId: o.id,
      name: o.name,
      article: o.article,
      barcode: o.barcode,
      stockItemId: match.id,
      stockItemName: match.name,
      oldStock: match.stock,
      newStock: o.stock,
      oldPrice,
      newPrice,
    })
  }

  return { rows, unmatched }
}

export async function applyOnecStockSync(rowIds: number[]): Promise<{ updated: number; errors: string[] }> {
  await requireAdmin()
  if (!rowIds.length) throw new Error('Нет строк для применения')

  const onecItems = await db.onecStockItem.findMany({
    where: { id: { in: rowIds } },
    select: { id: true, name: true, article: true, barcode: true, stock: true, pricePerPc: true },
  })

  const stockItems = await db.stockItem.findMany({
    select: { id: true, article: true, barcode: true },
  })
  const byArticle = new Map(stockItems.filter(s => s.article).map(s => [s.article!, s]))
  const byBarcode = new Map(stockItems.filter(s => s.barcode).map(s => [s.barcode!, s]))

  const errors: string[] = []
  let updated = 0

  await Promise.all(onecItems.map(async o => {
    const match = (o.article && byArticle.get(o.article)) || (o.barcode && byBarcode.get(o.barcode)) || null
    if (!match) { errors.push(`Не найден на сайте: "${o.name}"`); return }
    try {
      await db.stockItem.update({
        where: { id: match.id },
        data: { stock: o.stock, pricePerPc: Number(o.pricePerPc) },
      })
      updated++
    } catch {
      errors.push(`Ошибка обновления: "${o.name}"`)
    }
  }))

  return { updated, errors }
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

export async function bulkCreateItems(rows: Array<{
  article: string; name: string; fullName: string; barcode: string
  brand: string; sizeInches: string; stock: number | null; price: number | null
}>) {
  await requireAdmin()
  if (!rows.length) throw new Error('Нет строк для создания')

  // Re-check conflicts right before inserting (race-condition guard)
  const articles = rows.filter(r => r.article).map(r => r.article)
  const names    = rows.map(r => r.name)

  const existing = await db.stockItem.findMany({
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

  for (const r of toCreate) {
    try {
      await db.stockItem.create({
        data: {
          name:       r.name,
          fullName:   r.fullName   || null,
          article:    r.article    || null,
          barcode:    r.barcode    || null,
          brand:      r.brand      || null,
          sizeInches: r.sizeInches || null,
          stock:      r.stock   ?? 0,
          pricePerPc: r.price   ?? 0,
          onSale:     false,
          images:     [],
        },
      })
      created++
    } catch {
      errors.push(r.name)
    }
  }

  revalidatePath('/')
  revalidatePath('/catalog')
  revalidatePath('/admin')

  return { created, skipped, errors }
}
