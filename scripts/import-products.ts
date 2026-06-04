import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\wЀ-ӿ-]/g, '')
    .replace(/-+/g, '-')
}

function parseDecimal(val: string | undefined): number {
  if (!val?.trim()) return 0
  return parseFloat(val.replace(',', '.')) || 0
}

function parseIntOrNull(val: string | undefined): number | null {
  if (!val?.trim()) return null
  const n = parseInt(val.trim())
  return isNaN(n) ? null : n
}

function parseDate(val: string | undefined): Date | null {
  if (!val?.trim()) return null
  const [day, month, year] = val.trim().split('.')
  if (!day || !month || !year) return null
  const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
  return isNaN(d.getTime()) ? null : d
}

async function main() {
  const csvPath = resolve(process.cwd(), 'Donballon.csv')
  const raw = readFileSync(csvPath, 'utf-8').replace(/^﻿/, '') // strip BOM

  console.log('Parsing CSV...')
  const records: Record<string, string>[] = parse(raw, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  })
  console.log(`  ${records.length} rows parsed`)

  // ── Build category sets ───────────────────────────────────────────────────
  const cat1Set = new Set<string>()
  const cat2Set = new Set<string>() // key: "c1|c2"
  const cat3Set = new Set<string>() // key: "c1|c2|c3"

  for (const row of records) {
    const c1 = row['Категория 1']?.trim()
    const c2 = row['Категория 2']?.trim()
    const c3 = row['Категория 3']?.trim()
    if (c1) cat1Set.add(c1)
    if (c1 && c2) cat2Set.add(`${c1}|${c2}`)
    if (c1 && c2 && c3) cat3Set.add(`${c1}|${c2}|${c3}`)
  }

  async function findOrCreate(name: string, level: number, parentId: number | null) {
    const existing = await prisma.category.findFirst({ where: { name, parentId } })
    if (existing) return existing
    return prisma.category.create({ data: { name, slug: toSlug(name), level, parentId } })
  }

  // ── Insert level 1 ───────────────────────────────────────────────────────
  console.log(`Creating ${cat1Set.size} level-1 categories...`)
  const cat1Map = new Map<string, number>()
  for (const name of cat1Set) {
    const cat = await findOrCreate(name, 1, null)
    cat1Map.set(name, cat.id)
  }

  // ── Insert level 2 ───────────────────────────────────────────────────────
  console.log(`Creating ${cat2Set.size} level-2 categories...`)
  const cat2Map = new Map<string, number>()
  for (const key of cat2Set) {
    const [c1, c2] = key.split('|')
    const cat = await findOrCreate(c2, 2, cat1Map.get(c1)!)
    cat2Map.set(key, cat.id)
  }

  // ── Insert level 3 ───────────────────────────────────────────────────────
  console.log(`Creating ${cat3Set.size} level-3 categories...`)
  const cat3Map = new Map<string, number>()
  for (const key of cat3Set) {
    const [c1, c2, c3] = key.split('|')
    const cat = await findOrCreate(c3, 3, cat2Map.get(`${c1}|${c2}`)!)
    cat3Map.set(key, cat.id)
  }

  // ── Insert products in batches ────────────────────────────────────────────
  console.log('Importing products...')
  const BATCH = 500
  let total = 0
  let skipped = 0

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const data = []

    for (const row of batch) {
      const rawId = row['ID элемента']?.trim()
      const id = parseInt(rawId)
      if (!id) { skipped++; continue }

      const c1 = row['Категория 1']?.trim()
      const c2 = row['Категория 2']?.trim()
      const c3 = row['Категория 3']?.trim()

      let categoryId: number | null = null
      if (c1 && c2 && c3) categoryId = cat3Map.get(`${c1}|${c2}|${c3}`) ?? null
      else if (c1 && c2) categoryId = cat2Map.get(`${c1}|${c2}`) ?? null
      else if (c1) categoryId = cat1Map.get(c1) ?? null

      const holidays = row['Праздник']
        ? row['Праздник'].split(';').map(h => h.trim()).filter(Boolean)
        : []

      const saleRaw = row['КраснаяЦена']?.trim()

      data.push({
        id,
        name: row['Описание для анонса']?.trim() || '',
        description: row['Описание']?.trim() || null,
        price: parseDecimal(row['Цена']),
        salePrice: saleRaw ? parseDecimal(saleRaw) : null,
        vatRate: row['Ставка НДС']?.trim() || null,
        imageUrl: row['Изображения']?.trim() || null,
        videoUrl: row['Видео на youtube']?.trim() || null,
        categoryId,
        collection: row['Коллекция']?.trim() || null,
        holidays,
        model: row['Модель']?.trim() || null,
        material: row['Материал']?.trim() || null,
        shade: row['Оттенок']?.trim() || null,
        color: row['Цвет']?.trim() || null,
        colorGroup: row['Группа цвета [COLOR] {IP_PROP347}']?.trim() || null,
        sizeInches: row['РазмерДюймов']?.trim() || null,
        weight: row['Вес']?.trim() || null,
        minQuantity: parseIntOrNull(row['Кратность продаж']) ?? 1,
        unitsPerPackage: parseIntOrNull(row['Единиц в упаковке']),
        unitsPerBox: parseIntOrNull(row['Единиц в коробке']),
        barcode: row['ШтрихКод']?.trim() || null,
        manufacturer: row['Производитель']?.trim() || null,
        countryOfOrigin: row['Страна происхождения']?.trim() || null,
        isActive: row['Активность {IE_ACTIVE}']?.trim() === 'Да',
        expectedRestockDate: parseDate(row['Планируемая дата поступления']),
      })
    }

    await prisma.product.createMany({ data, skipDuplicates: true })
    total += data.length
    process.stdout.write(`\r  ${total}/${records.length} products inserted`)
  }

  console.log(`\nDone! ${total} products imported, ${skipped} rows skipped.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
