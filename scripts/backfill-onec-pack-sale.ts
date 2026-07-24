/**
 * Carries hand-curated StockItem fields — packQty (фасовка по брендам), sizeInches,
 * onSale/salePercent — onto matching OnecStockItem rows, so this work isn't lost
 * when the storefront switches its primary catalog source to OnecStockItem.
 *
 * Match: StockItem.article == OnecStockItem.article (primary, ~93% overlap),
 *        else normalized StockItem.name == normalized OnecStockItem.name (fallback,
 *        mainly recovers the onSale set — most of those 8 rows lack an article).
 *
 * Preview (no writes):  npx tsx scripts/backfill-onec-pack-sale.ts
 * Apply:                npx tsx scripts/backfill-onec-pack-sale.ts --apply
 *
 * Backup (written on --apply before any update): scripts/backup-onec-pack-sale.json
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const APPLY = process.argv.includes('--apply')
const BACKUP_PATH = 'scripts/backup-onec-pack-sale.json'
const BATCH = 200

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')
}

type StockRow = {
  id: number; article: string | null; name: string
  packQty: number | null; sizeInches: string | null; onSale: boolean; salePercent: number | null
}

function hasCuratedData(s: StockRow): boolean {
  return s.packQty != null || s.sizeInches != null || s.onSale
}

async function main() {
  console.log(APPLY ? '[APPLY MODE]' : '[PREVIEW — no writes]')

  const stockItems = (await prisma.stockItem.findMany({
    where: { OR: [{ packQty: { not: null } }, { sizeInches: { not: null } }, { onSale: true }] },
    select: { id: true, article: true, name: true, packQty: true, sizeInches: true, onSale: true, salePercent: true },
  })).filter(hasCuratedData)

  const onecItems = await prisma.onecStockItem.findMany({
    select: { id: true, article: true, name: true },
  })
  const onecByArticle = new Map<string, typeof onecItems>()
  const onecByName = new Map<string, typeof onecItems>()
  for (const o of onecItems) {
    if (o.article) {
      const a = o.article.trim()
      if (!onecByArticle.has(a)) onecByArticle.set(a, [])
      onecByArticle.get(a)!.push(o)
    }
    const n = normalizeName(o.name)
    if (!onecByName.has(n)) onecByName.set(n, [])
    onecByName.get(n)!.push(o)
  }

  type Plan = {
    stock: StockRow; via: 'article' | 'name'; onecId: number
  }
  const plans: Plan[] = []
  const unmatched: StockRow[] = []
  const claimed = new Set<number>() // onec ids already claimed this run — first StockItem match wins

  for (const s of stockItems) {
    let candidates: typeof onecItems | undefined
    let via: 'article' | 'name' | null = null
    if (s.article) {
      candidates = onecByArticle.get(s.article.trim())
      if (candidates?.length) via = 'article'
    }
    if (!via) {
      candidates = onecByName.get(normalizeName(s.name))
      if (candidates?.length) via = 'name'
    }
    if (!via || !candidates?.length) { unmatched.push(s); continue }
    const target = candidates.find((c) => !claimed.has(c.id))
    if (!target) { unmatched.push(s); continue }
    claimed.add(target.id)
    plans.push({ stock: s, via, onecId: target.id })
  }

  const byArticle = plans.filter((p) => p.via === 'article').length
  const byName = plans.filter((p) => p.via === 'name').length
  const withPack = plans.filter((p) => p.stock.packQty != null).length
  const withSize = plans.filter((p) => p.stock.sizeInches != null).length
  const withSale = plans.filter((p) => p.stock.onSale).length

  console.log(`\nCurated StockItem rows (packQty/sizeInches/onSale): ${stockItems.length}`)
  console.log(`Matched: ${plans.length}  (by article: ${byArticle}, by name: ${byName})`)
  console.log(`Unmatched: ${unmatched.length}`)
  console.log(`Carrying over: packQty=${withPack} sizeInches=${withSize} onSale=${withSale}`)

  if (unmatched.length) {
    console.log('\nUnmatched (no OnecStockItem found by article or name):')
    unmatched.slice(0, 20).forEach((s) => console.log(`   [${s.article ?? 'no-article'}] "${s.name.slice(0, 55)}"`))
  }

  console.log('\nSample plan (first 10):')
  plans.slice(0, 10).forEach((p) =>
    console.log(`   [${p.via}] stock#${p.stock.id} -> onec#${p.onecId} packQty=${p.stock.packQty} sizeInches=${p.stock.sizeInches} onSale=${p.stock.onSale}/${p.stock.salePercent} "${p.stock.name.slice(0, 40)}"`)
  )

  if (!APPLY) {
    console.log('\nPreview only. Re-run with --apply to write.')
    return
  }

  const before = await prisma.onecStockItem.findMany({
    where: { id: { in: plans.map((p) => p.onecId) } },
    select: { id: true, packQty: true, sizeInches: true, onSale: true, salePercent: true },
  })
  writeFileSync(resolve(process.cwd(), BACKUP_PATH), JSON.stringify(before, null, 2))
  console.log(`\nBackup written: ${BACKUP_PATH} (${before.length} rows)`)

  let updated = 0
  const errors: string[] = []
  for (let i = 0; i < plans.length; i += BATCH) {
    const batch = plans.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (p) => {
        try {
          await prisma.onecStockItem.update({
            where: { id: p.onecId },
            data: {
              packQty: p.stock.packQty,
              sizeInches: p.stock.sizeInches,
              onSale: p.stock.onSale,
              salePercent: p.stock.salePercent,
            },
          })
          updated++
        } catch (e) {
          errors.push(`onec#${p.onecId} (stock#${p.stock.id}): ${(e as Error).message.slice(0, 120)}`)
        }
      })
    )
    process.stdout.write(`\r  ${Math.min(i + BATCH, plans.length)}/${plans.length}`)
  }
  console.log()

  console.log('\n── Done ─────────────────────────────────')
  console.log(`  Rows updated: ${updated}`)
  console.log(`  Errors: ${errors.length}`)
  errors.forEach((e) => console.log('  ERR:', e))

  const after = await prisma.onecStockItem.count({ where: { OR: [{ packQty: { not: null } }, { sizeInches: { not: null } }, { onSale: true }] } })
  console.log(`  Verify: ${after} OnecStockItem rows now have curated packQty/sizeInches/onSale data`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
