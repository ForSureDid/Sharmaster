import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import path from 'path'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { amountInWords } from '@/lib/numberToWords'

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'All the Files with material here',
  'order_template.xlsx'
)

const ITEMS_START_ROW = 9
const TEMPLATE_ITEM_ROWS = 25  // rows 9–33
const TOTAL_ROW = 34
const SUMMARY_ROW = 37
const WORDS_ROW = 39

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Validate id is a positive integer — prevent NaN / type confusion
  const orderId = parseInt(id, 10)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Auth: ownership comes from the signed session cookie, never from the client
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return new NextResponse('Not found', { status: 404 })

  // Same rule as getMyOrders: own by userId, or by phone only for legacy
  // orders with no userId — prevents cross-user leakage via shared phones.
  const owns =
    order.userId === session.userId ||
    (order.userId === null && !!session.phone && order.phone === session.phone)
  if (!owns) return new NextResponse('Forbidden', { status: 403 })

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(TEMPLATE_PATH)
  const sheet = workbook.worksheets[0]

  // ── Header ───────────────────────────────────────────────────────────────────
  sheet.getCell('A1').value = `Заказ покупателя №${order.id}`
  sheet.getCell('B6').value = `${order.customerName}, ${order.address}. Тел: ${order.phone}`

  // ── Items ────────────────────────────────────────────────────────────────────
  const itemCount = order.items.length

  if (itemCount > TEMPLATE_ITEM_ROWS) {
    const extra = itemCount - TEMPLATE_ITEM_ROWS
    sheet.duplicateRow(ITEMS_START_ROW + TEMPLATE_ITEM_ROWS - 1, extra, true)
  }

  order.items.forEach((item, idx) => {
    const r = ITEMS_START_ROW + idx
    sheet.getCell(`A${r}`).value = idx + 1
    sheet.getCell(`B${r}`).value = ''
    sheet.getCell(`C${r}`).value = item.name
    sheet.getCell(`D${r}`).value = item.qty
    sheet.getCell(`E${r}`).value = 'шт'
    sheet.getCell(`F${r}`).value = Number(item.price)
    sheet.getCell(`G${r}`).value = Number(item.price) * item.qty
  })

  // ── Footer (shifts down if extra rows were inserted) ─────────────────────────
  const shift = Math.max(0, itemCount - TEMPLATE_ITEM_ROWS)
  const total = Number(order.total)

  sheet.getCell(`G${TOTAL_ROW + shift}`).value = total

  sheet.getCell(`A${SUMMARY_ROW + shift}`).value =
    `Всего наименований ${itemCount}, на сумму ${total.toLocaleString('ru-RU')} тг.`

  const words = amountInWords(total)
  sheet.getCell(`A${WORDS_ROW + shift}`).value =
    words.charAt(0).toUpperCase() + words.slice(1)

  // ── Output ───────────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''%D0%97%D0%B0%D0%BA%D0%B0%D0%B7-${order.id}.xlsx`,
      'Cache-Control': 'no-store',
    },
  })
}
