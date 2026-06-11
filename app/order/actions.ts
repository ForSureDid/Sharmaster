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

  // ── Input validation ──────────────────────────────────────────────────────
  if (!items.length) return { ok: false, error: 'Корзина пуста' }
  if (items.length > 500) return { ok: false, error: 'Слишком много позиций в заказе' }

  const name = customerName.trim()
  const ph   = phone.trim()
  const addr = address.trim()

  if (!name)           return { ok: false, error: 'Укажите имя' }
  if (name.length > 200) return { ok: false, error: 'Имя слишком длинное' }
  if (!ph)             return { ok: false, error: 'Укажите номер телефона' }
  if (ph.length > 30)  return { ok: false, error: 'Некорректный номер телефона' }
  if (!/^\+?[\d\s\-()]{7,25}$/.test(ph)) return { ok: false, error: 'Некорректный формат телефона' }
  if (!addr)           return { ok: false, error: 'Укажите адрес доставки' }
  if (addr.length > 500) return { ok: false, error: 'Адрес слишком длинный' }

  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100_000) {
      return { ok: false, error: 'Некорректное количество товара' }
    }
  }

  // ── Resolve stock rows ────────────────────────────────────────────────────
  // Match by id first, fall back to name — handles stale localStorage cart ids
  const ids   = items.map(i => i.id)
  const names = items.map(i => i.name)

  const stockRows = await db.stockItem.findMany({
    where: { OR: [{ id: { in: ids } }, { name: { in: names } }] },
    select: { id: true, stock: true, name: true, pricePerPc: true },
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

  // ── Use server-side prices — never trust client-supplied price ────────────
  const total = resolved.reduce((sum, { item, stockRow }) => {
    const unitPrice = stockRow ? Number(stockRow.pricePerPc) : 0
    return sum + unitPrice * item.qty
  }, 0)

  const [order] = await db.$transaction([
    db.order.create({
      data: {
        customerName: name,
        phone: ph,
        address: addr,
        total,
        items: {
          create: resolved.map(({ item, stockRow }) => ({
            stockItemId: stockRow?.id ?? null,
            name: item.name,
            qty: item.qty,
            price: stockRow ? stockRow.pricePerPc : 0,
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
