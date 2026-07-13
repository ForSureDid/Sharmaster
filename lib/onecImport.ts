// Parses CommerceML 2 (1С Розница "Обмен данными с сайтом") import.xml / offers.xml
// and upserts the results into the isolated OnecStockItem table.
//
// import.xml  = Классификатор (category groups) + Каталог/Товары/Товар (product master data)
// offers.xml  = ПакетПредложений/Предложения/Предложение (absolute current stock + price)
//
// 1C characteristics (color/size variants of one "product kind") are flattened: each
// ХарактеристикаТовара becomes its own OnecStockItem row, keyed by the compound
// "<ТоварИд>#<ХарактеристикаИд>" id — matching how this shop already treats each
// size/color as a separate SKU with its own article/barcode.

import { XMLParser } from 'fast-xml-parser'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    ['Группа', 'Товар', 'ХарактеристикаТовара', 'Предложение', 'Цена'].includes(name),
})

// Real 1C exports run into the thousands of rows (each size/color characteristic is
// its own row) — one Prisma call per row blew the 60s function budget even with the
// connection pool maxed out. Batches are applied as a single multi-row SQL statement
// each, so a whole sync is a handful of round-trips instead of thousands.
const CHUNK_SIZE = 200

// ─── Encoding ──────────────────────────────────────────────────────────────────

function decodeXml(bytes: Uint8Array): string {
  // Sniff the XML prolog's declared encoding from the first ~200 bytes (ASCII-safe
  // region) before committing to a decoder — 1C sometimes exports windows-1251.
  const prolog = Buffer.from(bytes.slice(0, 200)).toString('latin1')
  const m = /encoding="([^"]+)"/i.exec(prolog)
  const encoding = m?.[1]?.toLowerCase() ?? 'utf-8'
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function text(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

// ─── import.xml ────────────────────────────────────────────────────────────────

export type OnecProduct = {
  onecId: string
  article: string
  name: string
  barcode: string
  brand: string
  countryOfOrigin: string
  description: string
  groupName: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = any

export function parseImportXml(bytes: Uint8Array): OnecProduct[] {
  const xml = decodeXml(bytes)
  const doc: XmlNode = parser.parse(xml)
  const root = doc?.КоммерческаяИнформация ?? {}

  // Top-level classifier groups only (flatten — no nested depth for this pass).
  const groupNameById = new Map<string, string>()
  const topGroups = asArray<XmlNode>(root?.Классификатор?.Группы?.Группа)
  for (const g of topGroups) {
    const id = text(g?.Ид)
    const name = text(g?.Наименование)
    if (id) groupNameById.set(id, name)
  }

  const products: OnecProduct[] = []
  const tovары = asArray<XmlNode>(root?.Каталог?.Товары?.Товар)

  for (const t of tovары) {
    const baseId = text(t?.Ид)
    if (!baseId) continue

    const baseArticle = text(t?.Артикул)
    const baseName = text(t?.Наименование)
    const baseBarcode = text(t?.Штрихкод)
    const brand = text(t?.Изготовитель?.Наименование)
    const countryOfOrigin = text(t?.СтранаПроисхождения)
    const description = text(t?.Описание)

    const groupIds = asArray<XmlNode>(t?.Группы?.Ид).map(text)
    const groupName = groupIds.map((id) => groupNameById.get(id)).find(Boolean) ?? ''

    const characteristics = asArray<XmlNode>(t?.ХарактеристикиТовара?.ХарактеристикаТовара)

    if (characteristics.length === 0) {
      products.push({
        onecId: baseId,
        article: baseArticle,
        name: baseName,
        barcode: baseBarcode,
        brand,
        countryOfOrigin,
        description,
        groupName,
      })
      continue
    }

    for (const c of characteristics) {
      const charId = text(c?.Ид)
      if (!charId) continue
      const charName = text(c?.Наименование)
      products.push({
        onecId: `${baseId}#${charId}`,
        article: text(c?.Артикул) || baseArticle,
        name: [baseName, charName].filter(Boolean).join(' '),
        barcode: text(c?.Штрихкод) || baseBarcode,
        brand,
        countryOfOrigin,
        description,
        groupName,
      })
    }
  }

  return products
}

async function upsertProductChunk(chunk: OnecProduct[]): Promise<{ created: number; updated: number }> {
  const rows = chunk.map(
    (p) => Prisma.sql`(
      ${p.onecId}, ${p.article || null}, ${p.name}, ${p.barcode || null}, ${p.brand || null},
      ${p.countryOfOrigin || null}, ${p.description || null}, ${p.groupName || null}, 0, 0, true, now(), now()
    )`
  )

  // The "xmax = 0" check is a standard Postgres idiom to tell apart a freshly
  // INSERTed row from one that hit the ON CONFLICT UPDATE branch, in one round trip.
  // isNew is intentionally NOT in the DO UPDATE SET — new items keep isNew=true until
  // admin reviews them; updates to existing items leave their isNew flag untouched.
  const result = await db.$queryRaw<{ inserted: boolean }[]>`
    INSERT INTO "OnecStockItem"
      ("onecId", "article", "name", "barcode", "brand", "countryOfOrigin", "description", "groupName", "stock", "pricePerPc", "isNew", "createdAt", "updatedAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("onecId") DO UPDATE SET
      "article" = EXCLUDED."article",
      "name" = EXCLUDED."name",
      "barcode" = EXCLUDED."barcode",
      "brand" = EXCLUDED."brand",
      "countryOfOrigin" = EXCLUDED."countryOfOrigin",
      "description" = EXCLUDED."description",
      "groupName" = EXCLUDED."groupName",
      "updatedAt" = now()
    RETURNING (xmax = 0) AS inserted
  `

  const created = result.filter((r) => r.inserted).length
  return { created, updated: result.length - created }
}

export async function applyImportXml(
  products: OnecProduct[]
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE)
    try {
      const r = await upsertProductChunk(chunk)
      created += r.created
      updated += r.updated
    } catch (e) {
      // Fall back to one-row-at-a-time so a single bad row in the batch (e.g. a
      // "name" unique-constraint collision) doesn't drop the other 199.
      for (const p of chunk) {
        try {
          const r = await upsertProductChunk([p])
          created += r.created
          updated += r.updated
        } catch (rowErr) {
          errors.push(`${p.onecId} (${p.name}): ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
        }
      }
    }
  }

  // Clear isNew on 1C items that already have a matching StockItem (article / barcode / name).
  // Only truly NEW items (no match in the site catalog) should stay marked as новинка.
  await db.$executeRaw`
    UPDATE "OnecStockItem" o SET "isNew" = false
    WHERE o."isNew" = true
    AND (
      (o."article" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "StockItem" s WHERE s."article" = o."article"
      ))
      OR (o."barcode" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "StockItem" s WHERE s."barcode" = o."barcode"
      ))
      OR EXISTS (
        SELECT 1 FROM "StockItem" s WHERE s."name" = o."name"
      )
    )
  `

  return { created, updated, errors }
}

// ─── offers.xml ────────────────────────────────────────────────────────────────

export type OnecOffer = {
  onecId: string
  stock: number
  price: number | null
}

export function parseOffersXml(bytes: Uint8Array): OnecOffer[] {
  const xml = decodeXml(bytes)
  const doc: XmlNode = parser.parse(xml)
  const root = doc?.КоммерческаяИнформация ?? {}

  const offers: OnecOffer[] = []
  const предложения = asArray<XmlNode>(root?.ПакетПредложений?.Предложения?.Предложение)

  for (const o of предложения) {
    const onecId = text(o?.Ид)
    if (!onecId) continue

    const stock = num(o?.Количество) ?? 0
    const prices = asArray<XmlNode>(o?.Цены?.Цена)
    const price = prices.length > 0 ? num(prices[0]?.ЦенаЗаЕдиницу) : null

    offers.push({ onecId, stock: Math.max(0, Math.round(stock)), price })
  }

  return offers
}

async function updateOfferChunk(chunk: OnecOffer[]): Promise<number> {
  // Explicit casts are required on every column of the row constructor — Postgres
  // can't infer types for a derived VALUES table the way it can for a plain INSERT,
  // and silently defaults untyped literals to text, which then fails to unify with
  // the real integer/decimal columns on assignment.
  const rows = chunk.map(
    (o) => Prisma.sql`(${o.onecId}::text, ${o.stock}::int, ${o.price}::decimal)`
  )

  // COALESCE keeps the existing price when 1C didn't send one for this offer,
  // instead of clobbering it with NULL/0.
  const result = await db.$executeRaw`
    UPDATE "OnecStockItem" AS t
    SET "stock" = v.stock, "pricePerPc" = COALESCE(v.price, t."pricePerPc"), "updatedAt" = now()
    FROM (VALUES ${Prisma.join(rows)}) AS v("onecId", "stock", "price")
    WHERE t."onecId" = v."onecId"
  `
  return result
}

export async function applyOffersXml(
  offers: OnecOffer[]
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < offers.length; i += CHUNK_SIZE) {
    const chunk = offers.slice(i, i + CHUNK_SIZE)
    try {
      const matched = await updateOfferChunk(chunk)
      updated += matched
      skipped += chunk.length - matched
    } catch (e) {
      for (const o of chunk) {
        try {
          const matched = await updateOfferChunk([o])
          updated += matched
          skipped += 1 - matched
        } catch (rowErr) {
          errors.push(`${o.onecId}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
        }
      }
    }
  }

  return { updated, skipped, errors }
}
