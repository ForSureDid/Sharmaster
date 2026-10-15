import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { baseSlug } from '@/lib/slug'
import { MIN_ITEMS, SHOWN_COLLECTIONS } from '@/lib/collectionsConfig'

// Mirrors donballon.ru/collections: every OnecStockItem.collection value
// (sharik.ru "Коллекция", hand-curated) becomes a landing tile. Pure colour
// buckets are left out — that's what the colour filter is for — and so are
// tiny collections that would render as a near-empty page.
export type CollectionTile = { name: string; slug: string; count: number; cover: string | null }

// Cover priority: donballon's own tile illustration (public/collections/db, scripts/_download-donballon-collection-icons.ts),
// then an AI-generated one; the older note below applies to the latter. Covers are AI-generated (scripts/generate-collection-covers.ts) and committed to
// public/collections/{slug}.webp; the list of slugs that actually have one is baked in
// via collection-covers.json so a missing file never renders a broken <Image>.
async function _getCollections(): Promise<CollectionTile[]> {
  const rows = await db.onecStockItem.findMany({
    where: { isHidden: false, collections: { isEmpty: false } },
    select: { collections: true },
  })
  const counts = new Map<string, number>()
  for (const r of rows) for (const c of r.collections) if (SHOWN_COLLECTIONS.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1)

  const used = new Set<string>()
  const tiles: CollectionTile[] = []
  for (const [name, count] of [...counts].filter(([, n]) => n >= MIN_ITEMS).sort((a, b) => b[1] - a[1])) {
    let slug = baseSlug(name)
    if (used.has(slug)) slug = `${slug}-${tiles.length}`
    used.add(slug)
    tiles.push({ name, slug, count, cover: null })
  }

  // Fallback cover = photo of the most-stocked item, for collections without a generated one.
  const icons = (await import('@/lib/collection-icons.json')).default as Record<string, string>
  const covers = (await import('@/lib/collection-covers.json')).default as string[]
  const withCover = new Set(covers)
  for (const t of tiles) {
    if (icons[t.slug]) { t.cover = `/collections/db/${t.slug}.${icons[t.slug]}`; continue }
    if (withCover.has(t.slug)) { t.cover = `/collections/${t.slug}.webp`; continue }
    const photo = await db.onecStockItem.findFirst({
      where: { isHidden: false, collections: { has: t.name }, imageUrl: { not: null } },
      select: { imageUrl: true },
      orderBy: { stock: 'desc' },
    })
    t.cover = photo?.imageUrl ?? null
  }
  return tiles
}

export const getCollections = unstable_cache(_getCollections, ['onec-collections'], {
  revalidate: 600,
  tags: ['onecStockItems'],
})

export async function getCollectionBySlug(slug: string): Promise<CollectionTile | null> {
  return (await getCollections()).find((t) => t.slug === slug) ?? null
}
