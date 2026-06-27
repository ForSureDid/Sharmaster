import { config } from 'dotenv'
config()

import pg from 'pg'
import ExcelJS from 'exceljs'
import path from 'path'
import { amountInWords } from '../lib/numberToWords.js'

const TEMPLATE_PATH = path.join(process.cwd(), 'All the Files with material here', 'order_template.xlsx')
const ITEMS_START_ROW = 9
const TEMPLATE_ITEM_ROWS = 25
const TOTAL_ROW = 34
const SUMMARY_ROW = 37
const WORDS_ROW = 39

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const { rows: [order] } = await pool.query(`
  SELECT id, "customerName", phone, address, total, "createdAt"
  FROM "Order" ORDER BY id DESC LIMIT 1
`)
if (!order) { console.log('No orders found'); process.exit(0) }

const { rows: items } = await pool.query(
  `SELECT name, qty, price FROM "OrderItem" WHERE "orderId" = $1`, [order.id]
)
await pool.end()

const dateStr = new Date(order.createdAt).toLocaleString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Almaty',
})

const caption = [
  `📅 ${dateStr}`,
  `🛒 Новый заказ #${order.id}`,
  `📞 ${order.phone}`,
  `📍 ${order.address}`,
].join('\n')

// Build Excel
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.readFile(TEMPLATE_PATH)
const sheet = workbook.worksheets[0]

sheet.getCell('A1').value = `Заказ покупателя №${order.id}`
sheet.getCell('B6').value = `${order.customerName}, ${order.address}. Тел: ${order.phone}`

const itemCount = items.length
if (itemCount > TEMPLATE_ITEM_ROWS) {
  sheet.duplicateRow(ITEMS_START_ROW + TEMPLATE_ITEM_ROWS - 1, itemCount - TEMPLATE_ITEM_ROWS, true)
}
items.forEach((item: { name: string; qty: number; price: string }, idx: number) => {
  const r = ITEMS_START_ROW + idx
  sheet.getCell(`A${r}`).value = idx + 1
  sheet.getCell(`B${r}`).value = ''
  sheet.getCell(`C${r}`).value = item.name
  sheet.getCell(`D${r}`).value = item.qty
  sheet.getCell(`E${r}`).value = 'шт'
  sheet.getCell(`F${r}`).value = Number(item.price)
  sheet.getCell(`G${r}`).value = Number(item.price) * item.qty
})

const total = Number(order.total)
const shift = Math.max(0, itemCount - TEMPLATE_ITEM_ROWS)
sheet.getCell(`G${TOTAL_ROW + shift}`).value = total
sheet.getCell(`A${SUMMARY_ROW + shift}`).value =
  `Всего наименований ${itemCount}, на сумму ${total.toLocaleString('ru-RU')} тг.`
const words = amountInWords(total)
sheet.getCell(`A${WORDS_ROW + shift}`).value = words.charAt(0).toUpperCase() + words.slice(1)

const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

const form = new FormData()
form.append('chat_id', process.env.TELEGRAM_CHAT_ID!)
form.append('caption', caption)
form.append(
  'document',
  new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  `Заказ-${order.id}.xlsx`,
)

const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
  method: 'POST',
  body: form,
})
const json = await res.json()
console.log(json.ok ? `✅ Sent order #${order.id}` : `❌ Failed: ${JSON.stringify(json)}`)
