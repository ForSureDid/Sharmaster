/**
 * Generates slugs for all existing OnecStockItem + OnecCategory rows (one-off,
 * post-migration 20260725000000_add_onec_stockitem_pack_slug_sale). Going forward,
 * new rows get their slug assigned at insert time in lib/onecImport.ts — this script
 * only needs to run once to backfill what already existed before that landed.
 *
 * Preview (no writes):  npx tsx scripts/backfill-onec-slugs.ts
 * Apply:                npx tsx scripts/backfill-onec-slugs.ts --apply
 *
 * Backup (written on --apply before any update): scripts/backup-onec-slugs.json
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'
import { assignUniqueSlugs } from '../lib/slug'

dotenv.config()

const APPLY = process.argv.includes('--apply')
const BACKUP_PATH = 'scripts/backup-onec-slugs.json'
const BATCH = 200

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(APPLY ? '[APPLY MODE]' : '[PREVIEW — no writes]')

  const items = await prisma.onecStockItem.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  })
  const categories = await prisma.onecCategory.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  })

  const itemSlugs = assignUniqueSlugs(items)
  const categorySlugs = assignUniqueSlugs(categories)

  const itemSuffixed = [...itemSlugs.entries()].filter(([id, slug]) => slug.endsWith(`-${id}`)).length
  const categorySuffixed = [...categorySlugs.entries()].filter(([id, slug]) => slug.endsWith(`-${id}`)).length

  console.log(`OnecStockItem: ${items.length} without slug (${itemSuffixed} got a -id suffix due to name collision)`)
  console.log(`OnecCategory:  ${categories.length} without slug (${categorySuffixed} got a -id suffix due to name collision)`)
  console.log('\nSample (first 8 items):')
  items.slice(0, 8).forEach((it) => console.log(`   ${it.id}  "${it.name.slice(0, 50)}"  ->  ${itemSlugs.get(it.id)}`))

  if (!APPLY) {
    console.log('\nPreview only. Re-run with --apply to write.')
    return
  }

  writeFileSync(
    resolve(process.cwd(), BACKUP_PATH),
    JSON.stringify({ items: items.map((i) => i.id), categories: categories.map((c) => c.id) }, null, 2)
  )
  console.log(`\nBackup written: ${BACKUP_PATH}`)

  let updated = 0
  const errors: string[] = []
  const itemEntries = [...itemSlugs.entries()]
  for (let i = 0; i < itemEntries.length; i += BATCH) {
    const batch = itemEntries.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async ([id, slug]) => {
        try {
          await prisma.onecStockItem.update({ where: { id }, data: { slug } })
          updated++
        } catch (e) {
          errors.push(`item id=${id}: ${(e as Error).message.slice(0, 120)}`)
        }
      })
    )
    process.stdout.write(`\r  items ${Math.min(i + BATCH, itemEntries.length)}/${itemEntries.length}`)
  }
  console.log()

  let catUpdated = 0
  for (const [id, slug] of categorySlugs) {
    try {
      await prisma.onecCategory.update({ where: { id }, data: { slug } })
      catUpdated++
    } catch (e) {
      errors.push(`category id=${id}: ${(e as Error).message.slice(0, 120)}`)
    }
  }

  console.log('\n── Done ─────────────────────────────────')
  console.log(`  OnecStockItem updated: ${updated}/${itemEntries.length}`)
  console.log(`  OnecCategory updated:  ${catUpdated}/${categorySlugs.size}`)
  console.log(`  Errors: ${errors.length}`)
  errors.forEach((e) => console.log('  ERR:', e))

  const stillNull = await prisma.onecStockItem.count({ where: { slug: null } })
  console.log(`  Verify: ${stillNull} OnecStockItem rows still without slug`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
