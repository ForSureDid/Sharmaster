// Fills OnecStockItem.collections (the /collections tiles) from Donballon.xlsx "Коллекция"
// (matched by article, multi-value "A;B") plus our own sharik.ru `collection` folded into the
// donballon names (lib/collectionsConfig.ts SHARIK_TO_DONBALLON). Idempotent: recomputes the
// array for every row it can; touches only `collections`. Dry run by default.
//   npx tsx scripts/_apply-donballon-collections.ts [--apply]
import 'dotenv/config'
import { Client } from 'pg'
import ExcelJS from 'exceljs'
import { SHARIK_TO_DONBALLON } from '../lib/collectionsConfig'

async function main() {
  const apply = process.argv.includes('--apply')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile('All the Files with material here/Donballon.xlsx')
  const ws = wb.worksheets[0]
  const head = (ws.getRow(1).values as any[]).map((v) => String(v ?? '').trim())
  const ci = head.indexOf('Коллекция'), ai = head.indexOf('Артикул')
  const fromXlsx = new Map<string, string[]>()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const col = String(row.getCell(ci).value ?? '').trim(), art = String(row.getCell(ai).value ?? '').trim().toLowerCase()
    if (col && art) fromXlsx.set(art, col.split(';').map((s) => s.trim()).filter(Boolean))
  })

  const c = new Client({ connectionString: process.env.DIRECT_URL }); await c.connect()
  const { rows } = await c.query(`select id, article, collection from "OnecStockItem"`)
  const updates: { id: number; cols: string[] }[] = []
  for (const r of rows) {
    const set = new Set<string>(fromXlsx.get((r.article ?? '').trim().toLowerCase()) ?? [])
    const mapped = r.collection ? SHARIK_TO_DONBALLON[r.collection] : undefined
    if (mapped) set.add(mapped)
    if (set.size) updates.push({ id: r.id, cols: [...set] })
  }
  console.log('rows with collections:', updates.length)
  if (apply) {
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500)
      await c.query(
        `update "OnecStockItem" t set collections = string_to_array(v.cols, ';') from (select unnest($1::int[]) id, unnest($2::text[]) cols) v where t.id = v.id`,
        [chunk.map((u) => u.id), chunk.map((u) => u.cols.join(';'))],
      )
    }
  }
  await c.end()
}
main()
