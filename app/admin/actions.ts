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
      stock: i.stock,
      pricePerPc: Number(i.pricePerPc),
      imageUrl: i.imageUrl,
      onSale: i.onSale,
      salePercent: i.salePercent,
    })),
    total,
  }
}

export async function updateStockQty(id: number, stock: number) {
  await requireAdmin()
  await db.stockItem.update({ where: { id }, data: { stock: Math.max(0, stock) } })
  revalidatePath('/admin')
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
