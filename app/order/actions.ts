'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

type OrderItem = { id: number; qty: number; name: string; price: number }

export type PlaceOrderResult =
  | { ok: true; orderId: number }
  | { ok: false; error: string }

export async function placeOrder(input: {
  customerName: string
  phone: string
  address: string
  items: OrderItem[]
}): Promise<PlaceOrderResult> {
  const { customerName, phone, address, items } = input

  if (!items.length) return { ok: false, error: 'Корзина пуста' }
  if (!customerName.trim()) return { ok: false, error: 'Укажите имя' }
  if (!phone.trim()) return { ok: false, error: 'Укажите номер телефона' }
  if (!address.trim()) return { ok: false, error: 'Укажите адрес доставки' }

  // Match by id first, fall back to name — handles stale localStorage cart ids
  const ids = items.map(i => i.id)
  const names = items.map(i => i.name)

  const stockRows = await db.stockItem.findMany({
    where: { OR: [{ id: { in: ids } }, { name: { in: names } }] },
    select: { id: true, stock: true, name: true },
  })

  // Resolve each cart item to its real StockItem
  const resolved = items.map(item => {
    const byId   = stockRows.find(s => s.id === item.id)
    const byName = stockRows.find(s => s.name === item.name)
    return { item, stockRow: byId ?? byName ?? null }
  })

  for (const { item, stockRow } of resolved) {
    if (!stockRow) continue
    if (stockRow.stock < item.qty) {
      return {
        ok: false,
        error: `Недостаточно товара "${stockRow.name}" на складе (доступно: ${stockRow.stock} шт.)`,
      }
    }
  }

  const toDecrement = resolved.filter(r => r.stockRow !== null)
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)

  const [order] = await db.$transaction([
    db.order.create({
      data: {
        customerName,
        phone,
        address,
        total,
        items: {
          create: resolved.map(({ item, stockRow }) => ({
            stockItemId: stockRow?.id ?? null,
            name: item.name,
            qty: item.qty,
            price: item.price,
          })),
        },
      },
    }),
    ...toDecrement.map(({ item, stockRow }) =>
      db.stockItem.update({
        where: { id: stockRow!.id },
        data: { stock: { decrement: item.qty } },
      })
    ),
  ])

  revalidatePath('/catalog')

  return { ok: true, orderId: order.id }
}
