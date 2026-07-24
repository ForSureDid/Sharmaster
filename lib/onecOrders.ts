// Builds the CommerceML 2 sale XML that 1С Розница pulls via
// GET /api/1c-exchange?type=sale&mode=query, and tracks the query → success
// confirmation cycle on Order.onecQueuedAt / Order.onecExportedAt.
//
// Item → 1C nomenclature matching: OrderItem.onecStockItemId → OnecStockItem
// directly (every order placed after the storefront cutover to OnecStockItem
// has this set) — falls back to the legacy path (stockItemId → StockItem →
// OnecStockItem by article → barcode → name, same precedence the catalog
// import uses to clear isNew) for orders placed before the cutover. Matched
// items carry the real 1C "Ид" GUID so Розница fills the order lines
// automatically; unmatched ones get a synthetic id and are additionally
// listed in the order's Комментарий so the manager can add them by hand
// instead of silently losing them.

import { db } from '@/lib/db'
import type { Order, OrderItem, StockItem } from '@prisma/client'

// 1C polls every few minutes — a small cap keeps each response cheap while a
// backlog (e.g. after downtime) still drains within a handful of cycles.
const MAX_ORDERS_PER_EXCHANGE = 100

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

// 1C expects the order's local date/time, not UTC.
function almatyDateTime(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Almaty',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(d)
  const [date, time] = parts.split(' ')
  return { date, time }
}

type OrderWithItems = Order & { items: OrderItem[] }

// Resolve each order item to a 1C nomenclature GUID. Returns onecId or null.
async function buildOnecIdResolver(
  orders: OrderWithItems[]
): Promise<(item: OrderItem) => string | null> {
  const onecStockItemIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.onecStockItemId)).filter((id): id is number => id !== null)),
  ]
  const onecIdById = new Map<number, string>()
  if (onecStockItemIds.length) {
    const rows = await db.onecStockItem.findMany({
      where: { id: { in: onecStockItemIds } },
      select: { id: true, onecId: true },
    })
    for (const r of rows) onecIdById.set(r.id, r.onecId)
  }

  const stockItemIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.stockItemId)).filter((id): id is number => id !== null)),
  ]
  const stockItems = stockItemIds.length
    ? await db.stockItem.findMany({ where: { id: { in: stockItemIds } } })
    : []
  const stockById = new Map<number, StockItem>(stockItems.map((s) => [s.id, s]))

  const articles = [...new Set(stockItems.map((s) => s.article).filter((a): a is string => !!a))]
  const barcodes = [...new Set(stockItems.map((s) => s.barcode).filter((b): b is string => !!b))]
  const names = [
    ...new Set([
      ...stockItems.map((s) => s.name),
      ...orders.flatMap((o) => o.items.map((i) => i.name)),
    ]),
  ]

  const onecItems = await db.onecStockItem.findMany({
    where: {
      OR: [
        ...(articles.length ? [{ article: { in: articles } }] : []),
        ...(barcodes.length ? [{ barcode: { in: barcodes } }] : []),
        ...(names.length ? [{ name: { in: names } }] : []),
      ],
    },
    select: { onecId: true, article: true, barcode: true, name: true },
  })

  const byArticle = new Map<string, string>()
  const byBarcode = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const o of onecItems) {
    if (o.article && !byArticle.has(o.article)) byArticle.set(o.article, o.onecId)
    if (o.barcode && !byBarcode.has(o.barcode)) byBarcode.set(o.barcode, o.onecId)
    if (!byName.has(o.name)) byName.set(o.name, o.onecId)
  }

  return (item: OrderItem) => {
    if (item.onecStockItemId !== null) {
      const direct = onecIdById.get(item.onecStockItemId)
      if (direct) return direct
    }
    const stock = item.stockItemId !== null ? stockById.get(item.stockItemId) : undefined
    return (
      (stock?.article && byArticle.get(stock.article)) ||
      (stock?.barcode && byBarcode.get(stock.barcode)) ||
      (stock && byName.get(stock.name)) ||
      byName.get(item.name) ||
      null
    )
  }
}

function orderToXml(order: OrderWithItems, resolveOnecId: (item: OrderItem) => string | null): {
  xml: string
  unmatched: string[]
} {
  const { date, time } = almatyDateTime(order.createdAt)
  const phoneDigits = order.phone.replace(/\D/g, '')
  const unmatched: string[] = []

  const itemsXml = order.items
    .map((item) => {
      const onecId = resolveOnecId(item)
      if (!onecId) unmatched.push(`${item.name} — ${item.qty} шт × ${item.price.toFixed(2)}`)
      const sum = item.price.mul(item.qty)
      return `      <Товар>
        <Ид>${esc(onecId ?? `site-item-${item.id}`)}</Ид>
        <Наименование>${esc(item.name)}</Наименование>
        <БазоваяЕдиница Код="796" НаименованиеПолное="Штука" МеждународноеСокращение="PCE">шт</БазоваяЕдиница>
        <ЦенаЗаЕдиницу>${item.price.toFixed(2)}</ЦенаЗаЕдиницу>
        <Количество>${item.qty}</Количество>
        <Сумма>${sum.toFixed(2)}</Сумма>
        <ЗначенияРеквизитов>
          <ЗначениеРеквизита><Наименование>ВидНоменклатуры</Наименование><Значение>Товар</Значение></ЗначениеРеквизита>
          <ЗначениеРеквизита><Наименование>ТипНоменклатуры</Наименование><Значение>Товар</Значение></ЗначениеРеквизита>
        </ЗначенияРеквизитов>
      </Товар>`
    })
    .join('\n')

  const commentParts: string[] = []
  if (unmatched.length) {
    commentParts.push(`НЕ НАЙДЕНЫ В 1С (добавьте вручную): ${unmatched.join('; ')}`)
  }

  const xml = `  <Документ>
    <Ид>${order.id}</Ид>
    <Номер>${order.id}</Номер>
    <Дата>${date}</Дата>
    <Время>${time}</Время>
    <ХозОперация>Заказ товара</ХозОперация>
    <Роль>Продавец</Роль>
    <Валюта>KZT</Валюта>
    <Курс>1</Курс>
    <Сумма>${order.total.toFixed(2)}</Сумма>
    <Контрагенты>
      <Контрагент>
        <Ид>${esc(phoneDigits || `site-user-${order.id}`)}</Ид>
        <Наименование>${esc(order.customerName)}</Наименование>
        <ПолноеНаименование>${esc(order.customerName)}</ПолноеНаименование>
        <Роль>Покупатель</Роль>
        <АдресРегистрации>
          <Представление>${esc(order.address)}</Представление>
        </АдресРегистрации>
        <Контакты>
          <Контакт>
            <Тип>ТелефонРабочий</Тип>
            <Значение>${esc(order.phone)}</Значение>
          </Контакт>
        </Контакты>
      </Контрагент>
    </Контрагенты>
    <Товары>
${itemsXml}
    </Товары>${commentParts.length ? `\n    <Комментарий>${esc(commentParts.join('\n'))}</Комментарий>` : ''}
  </Документ>`

  return { xml, unmatched }
}

export type SaleQueryResult = {
  xml: string
  orderCount: number
  unmatchedItems: string[]
}

// mode=query: render every not-yet-confirmed order and stamp onecQueuedAt.
// Orders queued by a previous cycle whose mode=success never arrived are
// naturally re-sent (1C dedupes by Документ/Ид), so nothing gets lost.
export async function buildSaleQueryXml(): Promise<SaleQueryResult> {
  const orders = await db.order.findMany({
    where: { onecExportedAt: null },
    include: { items: true },
    orderBy: { id: 'asc' },
    take: MAX_ORDERS_PER_EXCHANGE,
  })

  const resolveOnecId = await buildOnecIdResolver(orders)

  const unmatchedItems: string[] = []
  const documents = orders.map((o) => {
    const { xml, unmatched } = orderToXml(o, resolveOnecId)
    unmatchedItems.push(...unmatched.map((u) => `заказ №${o.id}: ${u}`))
    return xml
  })

  if (orders.length) {
    await db.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { onecQueuedAt: new Date() },
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация ВерсияСхемы="2.05" ДатаФормирования="${new Date().toISOString()}">
${documents.join('\n')}
</КоммерческаяИнформация>`

  return { xml, orderCount: orders.length, unmatchedItems }
}

// mode=success: 1C confirmed it received the last query response.
export async function confirmSaleExport(): Promise<number> {
  const { count } = await db.order.updateMany({
    where: { onecQueuedAt: { not: null }, onecExportedAt: null },
    data: { onecExportedAt: new Date() },
  })
  return count
}
