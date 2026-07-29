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
import { baseSlug } from '@/lib/slug'

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
  groupOnecId: string | null
}

export type OnecGroup = {
  onecId: string
  name: string
  parentOnecId: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = any

// Recursively walks nested Группы/Группа (1C classifier groups can nest to any
// depth) into a flat parent-linked list, in parent-before-child order.
function walkGroups(nodes: XmlNode[], parentOnecId: string | null, out: OnecGroup[]) {
  for (const g of nodes) {
    const onecId = text(g?.Ид)
    if (!onecId) continue
    out.push({ onecId, name: text(g?.Наименование), parentOnecId })
    const children = asArray<XmlNode>(g?.Группы?.Группа)
    if (children.length) walkGroups(children, onecId, out)
  }
}

export function parseImportXml(bytes: Uint8Array): { products: OnecProduct[]; groups: OnecGroup[] } {
  const xml = decodeXml(bytes)
  const doc: XmlNode = parser.parse(xml)
  const root = doc?.КоммерческаяИнформация ?? {}

  const groups: OnecGroup[] = []
  const topGroups = asArray<XmlNode>(root?.Классификатор?.Группы?.Группа)
  walkGroups(topGroups, null, groups)
  const groupNameById = new Map(groups.map((g) => [g.onecId, g.name]))

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
    const groupOnecId = groupIds.find((id) => groupNameById.has(id)) ?? null
    const groupName = groupOnecId ? groupNameById.get(groupOnecId)! : ''

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
        groupOnecId,
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
        groupOnecId,
      })
    }
  }

  return { products, groups }
}

// Assigns a URL slug to rows that were just INSERTed (never touches existing rows —
// slug is deliberately absent from every ON CONFLICT DO UPDATE SET below, so a live
// product/category URL never changes under an admin's feet). Collisions are resolved
// against both the rest of this batch and whatever's already persisted: the lowest-id
// row in a name group keeps the clean slug, the rest get a "-{id}" suffix.
//
// Exported for reuse by app/admin/actions.ts — manually-created OnecStockItem rows
// need the same slugging as 1C-synced ones.
export async function assignSlugsForNewRows(
  table: 'OnecStockItem' | 'OnecCategory',
  newRows: { id: number; name: string }[]
): Promise<void> {
  if (newRows.length === 0) return

  const candidates = newRows.map((r) => ({ id: r.id, base: baseSlug(r.name) }))
  const baseSlugs = [...new Set(candidates.map((c) => c.base))]
  const taken = new Set(
    (
      await db.$queryRawUnsafe<{ slug: string }[]>(
        `SELECT slug FROM "${table}" WHERE slug = ANY($1)`,
        baseSlugs
      )
    ).map((r) => r.slug)
  )

  const byBase = new Map<string, typeof candidates>()
  for (const c of candidates) {
    if (!byBase.has(c.base)) byBase.set(c.base, [])
    byBase.get(c.base)!.push(c)
  }

  const updates: { id: number; slug: string }[] = []
  for (const [base, group] of byBase) {
    const sorted = [...group].sort((a, b) => a.id - b.id)
    sorted.forEach((c, i) => {
      const clean = i === 0 && !taken.has(base)
      updates.push({ id: c.id, slug: clean ? base : `${base}-${c.id}` })
    })
  }

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map((u) => Prisma.sql`(${u.id}::int, ${u.slug})`)
    await db.$executeRaw`
      UPDATE ${Prisma.raw(`"${table}"`)} AS t
      SET "slug" = v.slug
      FROM (VALUES ${Prisma.join(rows)}) AS v("id", slug)
      WHERE t."id" = v."id"
    `
  }
}

// Upserts the full 1C classifier tree and returns onecId → DB id, so products
// can resolve their categoryId. Two passes because a child group's DB row must
// exist before we can look up its parent's DB id.
export async function upsertOnecCategories(groups: OnecGroup[]): Promise<Map<string, number>> {
  const idByOnecId = new Map<string, number>()
  if (groups.length === 0) return idByOnecId

  const newlyInserted: { id: number; name: string }[] = []
  for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
    const chunk = groups.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map((g) => Prisma.sql`(${g.onecId}, ${g.name}, now(), now())`)
    const result = await db.$queryRaw<{ id: number; onecId: string; inserted: boolean }[]>`
      INSERT INTO "OnecCategory" ("onecId", "name", "createdAt", "updatedAt")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("onecId") DO UPDATE SET
        "name" = EXCLUDED."name",
        "updatedAt" = now()
      RETURNING id, "onecId", (xmax = 0) AS inserted
    `
    for (const r of result) {
      idByOnecId.set(r.onecId, r.id)
      if (r.inserted) newlyInserted.push({ id: r.id, name: chunk.find((g) => g.onecId === r.onecId)!.name })
    }
  }
  await assignSlugsForNewRows('OnecCategory', newlyInserted)

  const parentPairs = groups
    .filter((g) => g.parentOnecId && idByOnecId.has(g.onecId) && idByOnecId.has(g.parentOnecId))
    .map((g) => Prisma.sql`(${idByOnecId.get(g.onecId)}::int, ${idByOnecId.get(g.parentOnecId!)}::int)`)

  for (let i = 0; i < parentPairs.length; i += CHUNK_SIZE) {
    const chunk = parentPairs.slice(i, i + CHUNK_SIZE)
    await db.$executeRaw`
      UPDATE "OnecCategory" AS t
      SET "parentId" = v."parentId"
      FROM (VALUES ${Prisma.join(chunk)}) AS v("id", "parentId")
      WHERE t."id" = v."id"
    `
  }

  return idByOnecId
}

// The donballon-novelties agent (or an admin) inserts pending "coming soon" rows with
// isNewPending=true and a synthetic onecId (no real 1C GUID yet — see
// .claude/agents/donballon-novelties.md) so they can show on the storefront before 1C
// knows about them. Once the real product arrives through this sync, it must take over
// that same row (re-pointing onecId to the real 1C id) instead of creating a duplicate —
// this repoints matching pending rows just before the ON CONFLICT upsert below, by
// article, so the upsert's own conflict resolution merges into it naturally.
//
// Arrival flips the row from "Ожидайте поступления" to an active "Новинка": isNew is set
// true (same flag the admin's manual "Новинка" button sets — see toggleNewArrival in
// app/admin/actions.ts) while isNewPending is left true on purpose, matching that same
// manual flow. lib/onecStock.ts's _getNovinkaItems() filters on isNewPending alone, so the
// row keeps showing on /novinka; the isNewPending && !isNew "Ожидайте" badge logic in
// components/NovinkaGrid.tsx / StockContent.tsx flips off because isNew is now true, and
// the normal offers.xml sync (matched by the now-real onecId) fills in real stock/price so
// it's simply for sale. The photo/slug/etc are untouched since it's the same row. It stays
// on /novinka until an admin manually clears it via the "Убрать" button (toggleNewArrival
// with isNew=false, which also clears isNewPending) — no automatic expiry.
async function absorbDonballonNovelties(chunk: OnecProduct[]): Promise<void> {
  const withArticle = chunk.filter((p) => p.article)
  if (withArticle.length === 0) return
  const rows = withArticle.map((p) => Prisma.sql`(${p.article}::text, ${p.onecId}::text)`)
  await db.$executeRaw`
    UPDATE "OnecStockItem" t
    SET "onecId" = v."onecId", "isNew" = true
    FROM (VALUES ${Prisma.join(rows)}) AS v(article, "onecId")
    WHERE t."isNewPending" = true
      AND t."article" = v.article
      AND t."onecId" <> v."onecId"
  `
}

async function upsertProductChunk(
  chunk: OnecProduct[],
  categoryIdByOnecId: Map<string, number>
): Promise<{ created: number; updated: number }> {
  await absorbDonballonNovelties(chunk)

  const rows = chunk.map(
    (p) => Prisma.sql`(
      ${p.onecId}, ${p.article || null}, ${p.name}, ${p.barcode || null}, ${p.brand || null},
      ${p.countryOfOrigin || null}, ${p.description || null}, ${p.groupName || null},
      ${p.groupOnecId ? categoryIdByOnecId.get(p.groupOnecId) ?? null : null}, 0, 0, true, now(), now()
    )`
  )

  // The "xmax = 0" check is a standard Postgres idiom to tell apart a freshly
  // INSERTed row from one that hit the ON CONFLICT UPDATE branch, in one round trip.
  // isNew is intentionally NOT in the DO UPDATE SET — new items keep isNew=true until
  // admin reviews them; updates to existing items leave their isNew flag untouched.
  // Same reasoning for packQty/sizeInches/onSale/salePercent/slug (hand-curated /
  // backfilled — see prisma/migrations/20260725000000_add_onec_stockitem_pack_slug_sale) —
  // they must survive every future sync untouched. isHidden (migration
  // 20260726000000_add_onec_stockitem_is_hidden) is the same: admin-only, never
  // referenced by this INSERT/UPDATE column list, so a hidden row stays hidden
  // across every future 1C sync. brand joined that list 2026-07-29: 1C almost never
  // sends Изготовитель, so it's backfilled from donballon's YML feed instead
  // (scripts/backfill-onec-brand-from-donballon.ts) — still set on INSERT (from 1C,
  // usually null) but no longer overwritten on UPDATE so the backfill survives sync.
  const result = await db.$queryRaw<{ id: number; onecId: string; inserted: boolean }[]>`
    INSERT INTO "OnecStockItem"
      ("onecId", "article", "name", "barcode", "brand", "countryOfOrigin", "description", "groupName", "categoryId", "stock", "pricePerPc", "isNew", "createdAt", "updatedAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("onecId") DO UPDATE SET
      "article" = EXCLUDED."article",
      "name" = EXCLUDED."name",
      "barcode" = EXCLUDED."barcode",
      "countryOfOrigin" = EXCLUDED."countryOfOrigin",
      "description" = EXCLUDED."description",
      "groupName" = EXCLUDED."groupName",
      "categoryId" = EXCLUDED."categoryId",
      "updatedAt" = now()
    RETURNING id, "onecId", (xmax = 0) AS inserted
  `

  const created = result.filter((r) => r.inserted)
  await assignSlugsForNewRows(
    'OnecStockItem',
    created.map((r) => ({ id: r.id, name: chunk.find((p) => p.onecId === r.onecId)!.name }))
  )
  return { created: created.length, updated: result.length - created.length }
}

export async function applyImportXml(
  products: OnecProduct[],
  categoryIdByOnecId: Map<string, number> = new Map()
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE)
    try {
      const r = await upsertProductChunk(chunk, categoryIdByOnecId)
      created += r.created
      updated += r.updated
    } catch (e) {
      // Fall back to one-row-at-a-time so a single bad row in the batch (e.g. a
      // "name" unique-constraint collision) doesn't drop the other 199.
      for (const p of chunk) {
        try {
          const r = await upsertProductChunk([p], categoryIdByOnecId)
          created += r.created
          updated += r.updated
        } catch (rowErr) {
          errors.push(`${p.onecId} (${p.name}): ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
        }
      }
    }
  }

  // Clear isNew on 1C items that already have a matching StockItem (article / barcode / name).
  // Exception: if the matched StockItem was already given novinka status (isNew or isNewPending),
  // leave OnecStockItem.isNew alone — the manager has already reviewed it and only they can change it.
  await db.$executeRaw`
    UPDATE "OnecStockItem" o SET "isNew" = false
    WHERE o."isNew" = true
    AND (
      (o."article" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "StockItem" s
        WHERE s."article" = o."article"
          AND s."isNew" = false AND s."isNewPending" = false
      ))
      OR (o."barcode" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "StockItem" s
        WHERE s."barcode" = o."barcode"
          AND s."isNew" = false AND s."isNewPending" = false
      ))
      OR EXISTS (
        SELECT 1 FROM "StockItem" s
        WHERE s."name" = o."name"
          AND s."isNew" = false AND s."isNewPending" = false
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
  // instead of clobbering it with NULL/0. stockOverride/priceOverride are set by the
  // admin panel (app/admin/actions.ts) when a manager manually edits stock/price for a
  // row — CASE skips that column here so the sync can't silently clobber it back.
  const result = await db.$executeRaw`
    UPDATE "OnecStockItem" AS t
    SET
      "stock" = CASE WHEN t."stockOverride" THEN t."stock" ELSE v.stock END,
      "pricePerPc" = CASE WHEN t."priceOverride" THEN t."pricePerPc" ELSE COALESCE(v.price, t."pricePerPc") END,
      "updatedAt" = now()
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
