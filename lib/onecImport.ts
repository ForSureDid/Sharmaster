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
import { db } from '@/lib/db'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    ['Группа', 'Товар', 'ХарактеристикаТовара', 'Предложение', 'Цена'].includes(name),
})

const CHUNK_SIZE = 50

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

export async function applyImportXml(
  products: OnecProduct[]
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      chunk.map(async (p) => {
        try {
          const existing = await db.onecStockItem.findUnique({
            where: { onecId: p.onecId },
            select: { id: true },
          })
          await db.onecStockItem.upsert({
            where: { onecId: p.onecId },
            update: {
              article: p.article || null,
              name: p.name,
              barcode: p.barcode || null,
              brand: p.brand || null,
              countryOfOrigin: p.countryOfOrigin || null,
              description: p.description || null,
              groupName: p.groupName || null,
            },
            create: {
              onecId: p.onecId,
              article: p.article || null,
              name: p.name,
              barcode: p.barcode || null,
              brand: p.brand || null,
              countryOfOrigin: p.countryOfOrigin || null,
              description: p.description || null,
              groupName: p.groupName || null,
              stock: 0,
              pricePerPc: 0,
            },
          })
          if (existing) updated++
          else created++
        } catch (e) {
          errors.push(`${p.onecId} (${p.name}): ${e instanceof Error ? e.message : String(e)}`)
        }
      })
    )
  }

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

export async function applyOffersXml(
  offers: OnecOffer[]
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < offers.length; i += CHUNK_SIZE) {
    const chunk = offers.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      chunk.map(async (o) => {
        try {
          const existing = await db.onecStockItem.findUnique({
            where: { onecId: o.onecId },
            select: { id: true },
          })
          if (!existing) {
            skipped++
            return
          }
          await db.onecStockItem.update({
            where: { onecId: o.onecId },
            data: {
              stock: o.stock,
              ...(o.price !== null ? { pricePerPc: o.price } : {}),
            },
          })
          updated++
        } catch (e) {
          errors.push(`${o.onecId}: ${e instanceof Error ? e.message : String(e)}`)
        }
      })
    )
  }

  return { updated, skipped, errors }
}
