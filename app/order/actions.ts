'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
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
    select: { id: true, stock: true, name: true, pricePerPc: true, article: true, imageUrl: true },
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
    stockRow: stockRow ? {
      name: stockRow.name,
      pricePerPc: Number(stockRow.pricePerPc),
      article: stockRow.article,
      imageUrl: stockRow.imageUrl,
    } : null,
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

// Fetches a product photo and re-encodes it as a small, fixed-size JPEG —
// keeps the order Excel light regardless of the source image's real
// dimensions/format (Supabase originals can be large PNG/WebP, see
// supabase-image-loader.ts), and ExcelJS's addImage only accepts jpeg/png/gif.
// Returns null on any failure (missing/broken image) so one bad photo never
// breaks the whole export — the row just renders with an empty photo cell.
async function fetchThumbnail(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    return await sharp(Buffer.from(bytes))
      .resize(64, 64, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .jpeg({ quality: 70 })
      .toBuffer()
  } catch {
    return null
  }
}

async function notifyTelegram(
  orderId: number,
  name: string,
  phone: string,
  address: string,
  resolved: { item: OrderItem; stockRow: { name: string; pricePerPc: number; article: string | null; imageUrl: string | null } | null }[],
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
    const items = resolved.map(({ item, stockRow }) => {
      const price = stockRow ? Number(stockRow.pricePerPc) : 0
      return {
        name: item.name,
        qty: item.qty,
        price,
        // Same order-wide percent applied to every line (see discountPercent above —
        // it's a single "Прогрессивная скидка" tier, not a per-item sale discount).
        discountedPrice: Math.round(price * (1 - discountPercent / 100)),
        article: stockRow?.article ?? '',
        imageUrl: stockRow?.imageUrl ?? null,
      }
    })

    // Fetch/resize all photos up front, in parallel — the sheet is built
    // synchronously below and addImage needs the buffer already in hand.
    const thumbnails = await Promise.all(
      items.map((item) => (item.imageUrl ? fetchThumbnail(item.imageUrl) : Promise.resolve(null)))
    )

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
      sheet.getCell(`B${r}`).value = item.article
      sheet.getCell(`D${r}`).value = item.name
      sheet.getCell(`E${r}`).value = item.qty
      sheet.getCell(`F${r}`).value = 'шт'
      sheet.getCell(`G${r}`).value = item.price
      sheet.getCell(`H${r}`).value = item.discountedPrice
      sheet.getCell(`I${r}`).value = item.price * item.qty

      const thumb = thumbnails[idx]
      if (thumb) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sharp's
        // Buffer<ArrayBuffer> vs ExcelJS's Buffer<ArrayBufferLike> is a real-node,
        // type-only mismatch (see @types/node's newer generic Buffer); harmless at runtime.
        const imageId = workbook.addImage({ buffer: thumb as any, extension: 'jpeg' })
        sheet.addImage(imageId, `C${r}:C${r}`)
      }
    })

    const shift = Math.max(0, itemCount - TEMPLATE_ITEM_ROWS)
    sheet.getCell(`I${TOTAL_ROW + shift}`).value = subtotal
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
    const sent = await sendWithRetry(orderId, 'sendDocument', () => {
      const form = new FormData()
      form.append('chat_id', chatId)
      form.append('caption', caption)
      form.append(
        'document',
        new Blob([new Uint8Array(buffer!)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Заказ-${orderId}.xlsx`,
      )
      return fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form })
    })
    // Document delivery never made it through (e.g. repeated Telegram 5xx/timeout)
    // — fall back to a text-only message so the manager at least learns the order
    // exists, rather than getting nothing at all.
    if (!sent) {
      await sendWithRetry(orderId, 'sendMessage (fallback after sendDocument failure)', () =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: caption }),
        })
      )
    }
  } else {
    await sendWithRetry(orderId, 'sendMessage', () =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption }),
      })
    )
  }
}

// Telegram's API occasionally 504s/times out on sendDocument (observed directly —
// a trivial 1KB test upload took 8s and a real one once failed outright), so a
// single failed attempt shouldn't mean the manager never hears about the order.
// Returns whether any attempt succeeded; logs and swallows the final failure —
// notifyTelegram is already fire-and-forget from placeOrder's perspective.
async function sendWithRetry(
  orderId: number,
  label: string,
  attempt: () => Promise<Response>,
  maxAttempts = 3,
  delaysMs = [2000, 5000],
): Promise<boolean> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await attempt()
      if (res.ok) return true
      console.error(`notifyTelegram: ${label} failed for order #${orderId} (attempt ${i}/${maxAttempts}):`, res.status, await res.text())
    } catch (err) {
      console.error(`notifyTelegram: ${label} threw for order #${orderId} (attempt ${i}/${maxAttempts}):`, err)
    }
    if (i < maxAttempts) await new Promise((r) => setTimeout(r, delaysMs[i - 1] ?? delaysMs.at(-1)))
  }
  return false
}
