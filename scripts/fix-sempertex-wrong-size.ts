/**
 * Clears imageUrl for Sempertex items where the photo size doesn't match the name size.
 * e.g. R24 item linked to a Shar_5_13_sm photo → clear
 * e.g. R18 item linked to a Shar_12_30_sm photo → clear
 *
 * Run: npx tsx scripts/fix-sempertex-wrong-size.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Extract balloon size (inches) from DB name: "R18 015 красный" → 18
function sizeFromName(name: string): number | null {
  const m = name.match(/^R(\d+)\s/i)
  return m ? parseInt(m[1]) : null
}

// Extract balloon size (inches) from latex-balloons filename
// "Shar_18_46_sm_..." → 18,  "Shar_12_30_sm_..." → 12,  "Shar_5_13_sm_..." → 5
// "Shar_36_91_sm_..." → 36,  "Shar_24_61_sm_..." → 24
function sizeFromFilename(filename: string): number | null {
  const m = filename.match(/[Ss]har?_(\d+)_\d+_sm/i)
  return m ? parseInt(m[1]) : null
}

async function main() {
  // Load all starparty-style Sempertex with latex-balloons photos
  const items = await prisma.stockItem.findMany({
    where: {
      brand: { contains: 'sempertex', mode: 'insensitive' },
      imageUrl: { contains: 'latex-balloons' },
    },
    select: { id: true, name: true, imageUrl: true },
  })

  console.log(`Found ${items.length} Sempertex items with latex-balloons photo`)

  const toClear: number[] = []
  const ok: number[] = []

  for (const item of items) {
    const nameSize = sizeFromName(item.name)
    if (nameSize === null) continue // not starparty-style, skip

    const filename = item.imageUrl?.split('/').pop() ?? ''
    const photoSize = sizeFromFilename(filename)

    if (photoSize !== null && photoSize !== nameSize) {
      toClear.push(item.id)
      console.log(`  WRONG: "${item.name.slice(0, 45)}" [${nameSize}in] → photo ${photoSize}in (${filename.slice(0, 50)})`)
    } else {
      ok.push(item.id)
    }
  }

  console.log(`\n  Wrong size: ${toClear.length} → will clear`)
  console.log(`  Correct:    ${ok.length} → leave`)

  if (!toClear.length) { console.log('\nNothing to fix.'); return }

  console.log('\nClearing wrong photos...')
  const BATCH = 50
  let cleared = 0
  for (let i = 0; i < toClear.length; i += BATCH) {
    await prisma.stockItem.updateMany({
      where: { id: { in: toClear.slice(i, i + BATCH) } },
      data: { imageUrl: null, images: [] },
    })
    cleared += Math.min(BATCH, toClear.length - i)
    process.stdout.write(`\r  ${cleared}/${toClear.length}`)
  }

  console.log(`\n\n── Done ─────────────────────────────────`)
  console.log(`  Cleared: ${cleared} wrong-size photos`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
