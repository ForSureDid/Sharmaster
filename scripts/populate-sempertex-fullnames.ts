import * as pg from 'pg'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const filePath = resolve(process.cwd(), 'All the Files with material here/Наименования_полные_обновлённые.xlsx')
  const wb = XLSX.read(readFileSync(filePath), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: (string | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Build unique map: position name → fullName (skip where fullName == position)
  const updates = new Map<string, string>()
  for (const row of rows.slice(1)) {
    const pos = row[0]?.trim() ?? null
    const full = row[1]?.trim() ?? null
    if (!pos || !full || full === pos) continue
    if (!updates.has(pos)) updates.set(pos, full)
  }

  console.log(`Unique positions with a real fullName in Excel: ${updates.size}`)

  const client = new pg.Client({ connectionString: process.env.DIRECT_URL! })
  await client.connect()

  // Build VALUES list: ($1,$2), ($3,$4), ...
  const values: string[] = []
  const params: string[] = []
  let i = 1
  for (const [name, fullName] of updates) {
    values.push(`($${i}::text, $${i + 1}::text)`)
    params.push(name, fullName)
    i += 2
  }

  // Only update Sempertex StockItems — foil balloons are untouched
  const sql = `
    UPDATE "StockItem" AS s
    SET "fullName" = v."fullName"
    FROM (VALUES ${values.join(', ')}) AS v(name, "fullName")
    WHERE s.name = v.name
      AND s.brand = 'Sempertex'
  `

  const result = await client.query(sql, params)
  console.log(`Updated: ${result.rowCount} Sempertex StockItem rows`)

  await client.end()
}

main().catch(console.error)
