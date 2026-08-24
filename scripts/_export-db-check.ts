import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as XLSX from 'xlsx'

dotenv.config()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const rawLines = fs.readFileSync('scraped-sharik-figurnye-bukety/raw.jsonl', 'utf-8').trim().split('\n')
  const scraped = rawLines.map(l => JSON.parse(l))
  const byArticle: Record<string, any> = {}
  for (const r of scraped) byArticle[r['Артикул']] = r

  const articles = scraped.map((r: any) => r['Артикул'])

  const dupGroups: any[] = await prisma.$queryRawUnsafe(
    `SELECT article FROM "OnecStockItem" WHERE article = ANY($1::text[]) GROUP BY article HAVING COUNT(*) > 1`,
    articles
  )
  const dupArticles = new Set(dupGroups.map((d: any) => d.article))

  const dbRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, article, name, brand, occasion, color, "weightGrams", "lengthMm", "widthMm", "heightMm"
     FROM "OnecStockItem" WHERE article = ANY($1::text[]) ORDER BY article`,
    articles
  )

  const updatedSheet: any[] = []
  const dupSheet: any[] = []
  const foundArticles = new Set<string>()

  for (const row of dbRows) {
    foundArticles.add(row.article)
    const s = byArticle[row.article]
    const entry = {
      'id (БД)': row.id,
      'Артикул': row.article,
      'Название (БД)': row.name,
      'brand (БД)': row.brand,
      'Торговая марка (скрейп)': s?.['Торговая марка'] || '',
      'occasion (БД)': row.occasion,
      'Событие (скрейп)': s?.['Событие'] || '',
      'color (БД)': row.color,
      'Цвет фольга (скрейп)': s?.['Цвет фольга'] || '',
      'weightGrams (БД)': row.weightGrams,
      'Вес брутто (скрейп)': s?.['Вес брутто'] || '',
      'lengthMm (БД)': row.lengthMm,
      'widthMm (БД)': row.widthMm,
      'heightMm (БД)': row.heightMm,
      'Размер (скрейп)': s?.['Размер'] || '',
      'Ссылка (скрейп)': s?.['Ссылка'] || '',
    }
    if (dupArticles.has(row.article)) {
      dupSheet.push(entry)
    } else {
      updatedSheet.push(entry)
    }
  }

  const notFoundSheet = scraped
    .filter((r: any) => !foundArticles.has(r['Артикул']))
    .map((r: any) => ({
      'Артикул': r['Артикул'],
      'Название': r['Название'],
      'Ссылка': r['Ссылка'],
      'Торговая марка (скрейп)': r['Торговая марка'],
    }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(updatedSheet), 'Обновлено в БД')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dupSheet), 'Дубли (не тронуто)')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notFoundSheet), 'Не найдено в БД')

  const outPath = 'All the Files with material here/Sharik-figurnye-bukety-DB-check.xlsx'
  XLSX.writeFile(wb, outPath)

  console.log('Обновлено в БД (лист 1):', updatedSheet.length)
  console.log('Дубли, не тронуто (лист 2):', dupSheet.length)
  console.log('Не найдено в БД (лист 3):', notFoundSheet.length)
  console.log('Saved to', outPath)

  await prisma.$disconnect()
}

main()
