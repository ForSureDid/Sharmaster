'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import path from 'path'
import { amountInWords } from '@/lib/numberToWords'
import { getOneTimeDiscountPercent } from '@/lib/discounts'

class StockError extends Error {
  constructor(msg: string) { super(msg); this.name = 'StockError' }
}

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

  // Guests can browse and build a cart freely, but placing an order requires
  // an account — enforced here too, not just by the /order page's UI gate,
  // since this server action is directly callable regardless of what the
  // client renders.
  const session = await getSession()
  if (!session) return { ok: false, error: 'Войдите или зарегистрируйтесь, чтобы оформить заказ' }

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

  const stockRows = await db.onecStockItem.findMany({
    where: { OR: [{ id: { in: ids } }, { name: { in: names } }] },
    select: { id: true, stock: true, name: true, pricePerPc: true },
  })

  // Resolve each cart item to its real OnecStockItem
  const resolved = items.map(item => {
    const byId   = stockRows.find(s => s.id === item.id)
    const byName = stockRows.find(s => s.name === item.name)
    return { item, stockRow: byId ?? byName ?? null }
  })

  // Fast-path early return for obvious stock shortfalls (stale read — enforced atomically below)
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
  const subtotal = resolved.reduce((sum, { item, stockRow }) => {
    const unitPrice = stockRow ? Number(stockRow.pricePerPc) : 0
    return sum + unitPrice * item.qty
  }, 0)

  // "Прогрессивная скидка (разовая)" — see lib/discounts.ts / app/discounts.
  // Recomputed here from server-verified prices, never trusted from the client.
  const discountPercent = getOneTimeDiscountPercent(subtotal)
  const discountAmount = Math.round(subtotal * discountPercent / 100)
  const total = subtotal - discountAmount

  // ── Atomic check-and-decrement inside one transaction ─────────────────────
  // updateMany with stock >= qty is a single conditional UPDATE in the DB —
  // if another request already consumed the stock, count === 0 and we abort.
  //
  // One updateMany per cart line, awaited in sequence, on a single connection
  // — Prisma's interactive-transaction default timeout is 5s, and a cart with
  // 40+ distinct line items (a real large order, not an edge case) can take
  // longer than that to get through every round trip, aborting the whole
  // transaction with P2028 ("query cannot be executed on an expired
  // transaction") right as the customer submits. Bumped generously — even the
  // 500-line-item cap (see the check above) stays well under this.
  let order: { id: number }
  try {
    order = await db.$transaction(async (tx) => {
      for (const { item, stockRow } of toDecrement) {
        const { count } = await tx.onecStockItem.updateMany({
          where: { id: stockRow!.id, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        })
        if (count === 0) {
          const cur = await tx.onecStockItem.findUnique({
            where: { id: stockRow!.id },
            select: { stock: true },
          })
          throw new StockError(
            `Недостаточно товара "${stockRow!.name}" на складе (доступно: ${cur?.stock ?? 0} шт.)`
          )
        }
      }
      const newOrder = await tx.order.create({
        data: {
          userId: session.userId,
          customerName: name,
          phone: ph,
          address: addr,
          total,
          items: {
            create: resolved.map(({ item, stockRow }) => ({
              onecStockItemId: stockRow?.id ?? null,
              name: item.name,
              qty: item.qty,
              price: stockRow ? stockRow.pricePerPc : 0,
            })),
          },
        },
      })

      // Clear the server-side cart mirror (User.cart) right here, atomically
      // with the order — don't rely on the client's clearCart() + debounced
      // saveCart() round trip, which silently never fires if the tab
      // closes/navigates away within the 800ms debounce window right after checkout.
      await tx.user.update({
        where: { id: session.userId },
        data: { cart: [], cartUpdatedAt: new Date() },
      })

      return newOrder
    }, { timeout: 60_000 })
  } catch (err) {
    if (err instanceof StockError) return { ok: false, error: err.message }
    throw err
  }

  revalidatePath('/catalog')

  notifyTelegram(order.id, name, ph, addr, resolved.map(({ item, stockRow }) => ({
    item,
    stockRow: stockRow ? { name: stockRow.name, pricePerPc: Number(stockRow.pricePerPc) } : null,
  })), subtotal, discountPercent, discountAmount, total).catch((err) => {
    console.error(`notifyTelegram failed for order #${order.id}:`, err)
  })

  return { ok: true, orderId: order.id }
}

const TEMPLATE_PATH = path.join(process.cwd(), 'All the Files with material here', 'order_template.xlsx')
const ITEMS_START_ROW = 9
const TEMPLATE_ITEM_ROWS = 25
const TOTAL_ROW = 34
const SUMMARY_ROW = 37
const WORDS_ROW = 39

async function notifyTelegram(
  orderId: number,
  name: string,
  phone: string,
  address: string,
  resolved: { item: OrderItem; stockRow: { name: string; pricePerPc: number } | null }[],
  subtotal: number,
  discountPercent: number,
  discountAmount: number,
  total: number,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const dateStr = new Date().toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Almaty',
  })

  const caption = [
    `📅 ${dateStr}`,
    `🛒 Новый заказ #${orderId}`,
    `📞 ${phone}`,
    `📍 ${address}`,
    ...(discountPercent > 0 ? [`🏷️ Скидка ${discountPercent}% (−${discountAmount.toLocaleString('ru-RU')} тг): итого ${total.toLocaleString('ru-RU')} тг`] : []),
  ].join('\n')

  // Build Excel — kept separate from the Telegram send below so a template/formatting
  // failure (e.g. missing file, bad cell layout) can't silently swallow the whole
  // notification. Falls back to a text-only message if this throws.
  let buffer: Buffer | null = null
  try {
    const items = resolved.map(({ item, stockRow }) => ({
      name: item.name,
      qty: item.qty,
      price: stockRow ? Number(stockRow.pricePerPc) : 0,
    }))

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(TEMPLATE_PATH)
    const sheet = workbook.worksheets[0]

    sheet.getCell('A1').value = `Заказ покупателя №${orderId}`
    sheet.getCell('B6').value = `${name}, ${address}. Тел: ${phone}`

    const itemCount = items.length
    if (itemCount > TEMPLATE_ITEM_ROWS) {
      sheet.duplicateRow(ITEMS_START_ROW + TEMPLATE_ITEM_ROWS - 1, itemCount - TEMPLATE_ITEM_ROWS, true)
    }
    items.forEach((item, idx) => {
      const r = ITEMS_START_ROW + idx
      sheet.getCell(`A${r}`).value = idx + 1
      sheet.getCell(`B${r}`).value = ''
      sheet.getCell(`C${r}`).value = item.name
      sheet.getCell(`D${r}`).value = item.qty
      sheet.getCell(`E${r}`).value = 'шт'
      sheet.getCell(`F${r}`).value = item.price
      sheet.getCell(`G${r}`).value = item.price * item.qty
    })

    const shift = Math.max(0, itemCount - TEMPLATE_ITEM_ROWS)
    sheet.getCell(`G${TOTAL_ROW + shift}`).value = subtotal
    sheet.getCell(`A${SUMMARY_ROW + shift}`).value = discountPercent > 0
      ? `Всего наименований ${itemCount}, на сумму ${subtotal.toLocaleString('ru-RU')} тг. Скидка ${discountPercent}% (−${discountAmount.toLocaleString('ru-RU')} тг). Итого к оплате: ${total.toLocaleString('ru-RU')} тг.`
      : `Всего наименований ${itemCount}, на сумму ${total.toLocaleString('ru-RU')} тг.`
    const words = amountInWords(total)
    sheet.getCell(`A${WORDS_ROW + shift}`).value = words.charAt(0).toUpperCase() + words.slice(1)

    buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  } catch (err) {
    console.error(`notifyTelegram: failed to build order Excel for order #${orderId}:`, err)
  }

  if (buffer) {
    const form = new FormData()
    form.append('chat_id', chatId)
    form.append('caption', caption)
    form.append(
      'document',
      new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `Заказ-${orderId}.xlsx`,
    )
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      console.error(`notifyTelegram: sendDocument failed for order #${orderId}:`, res.status, await res.text())
    }
  } else {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: caption }),
    })
    if (!res.ok) {
      console.error(`notifyTelegram: sendMessage fallback failed for order #${orderId}:`, res.status, await res.text())
    }
  }
}
