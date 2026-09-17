// Starter kits ("Набор для новичков") — fixed-price bundles of OnecStockItem
// lines (see Kit/KitItem in prisma/schema.prisma). Composition pricing/stock
// is resolved live against OnecStockItem, same as any other product card —
// only Kit.price itself is frozen.

import { db } from './db'
import { resolveCategoryFlags, computeDiscountEligible } from './onecStock'
import { getPackSize, isSoldByPiece, getDisplayPrice, getMinQty, type PackItem } from './pack'

export type KitCompositionItem = {
  onecStockItemId: number
  article: string | null
  name: string
  brand: string | null
  imageUrl: string | null
  stock: number
  pricePerPc: number
  packSize: number | null
  byPiece: boolean
  // Per cart-unit price — pack price for pack-sold items, pricePerPc otherwise
  // (see lib/pack.ts's getDisplayPrice()). This is what CartItem.price/qty means.
  displayPrice: number
  salePrice: number | null
  isBalloon: boolean
  discountEligible: boolean
  minQty: number
  // Quantity locked into the kit, in cart units (packs for pack-sold items,
  // pieces otherwise) — the floor below which this line can't be reduced.
  qty: number
}

export type KitDetail = {
  id: number
  slug: string
  name: string
  description: string | null
  price: number
  images: string[]
  isActive: boolean
  items: KitCompositionItem[]
}

async function resolveComposition(
  kit: { id: number; slug: string; name: string; description: string | null; price: unknown; images: string[]; isActive: boolean },
  kitItems: { onecStockItemId: number; qty: number }[],
): Promise<KitDetail> {
  const ids = kitItems.map((i) => i.onecStockItemId)
  const [flags, rawItems] = await Promise.all([
    resolveCategoryFlags(),
    ids.length === 0 ? Promise.resolve([]) : db.onecStockItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, article: true, name: true, brand: true, imageUrl: true,
        stock: true, pricePerPc: true, packQty: true, categoryId: true,
        onSale: true, salePercent: true,
      },
    }),
  ])
  const byId = new Map(rawItems.map((r) => [r.id, r]))

  const items: KitCompositionItem[] = []
  for (const ki of kitItems) {
    const row = byId.get(ki.onecStockItemId)
    if (!row) continue // item deleted/hidden since the kit was composed — skip rather than crash the page
    const isLatex = row.categoryId != null && flags.latex.has(row.categoryId)
    const isFoil = row.categoryId != null && flags.foil.has(row.categoryId)
    const isBalloon = isLatex || isFoil
    const packInput: PackItem = {
      name: row.name, brand: row.brand, material: isLatex ? 'латекс' : null,
      packQty: row.packQty, isBalloon,
    }
    const packSize = getPackSize(packInput)
    const byPiece = isSoldByPiece(packInput)
    const pricePerPc = Number(row.pricePerPc)
    const displayPrice = getDisplayPrice({ ...packInput, pricePerPc })
    const salePrice = row.onSale && row.salePercent ? Math.round(displayPrice * (1 - row.salePercent / 100)) : null
    items.push({
      onecStockItemId: row.id, article: row.article, name: row.name, brand: row.brand,
      imageUrl: row.imageUrl, stock: row.stock, pricePerPc, packSize, byPiece,
      displayPrice, salePrice, isBalloon,
      discountEligible: computeDiscountEligible(row.categoryId, row.name, flags),
      minQty: getMinQty({ brand: row.brand, name: row.name }),
      qty: ki.qty,
    })
  }

  return {
    id: kit.id, slug: kit.slug, name: kit.name, description: kit.description,
    price: Number(kit.price), images: kit.images, isActive: kit.isActive, items,
  }
}

export async function getKitBySlug(slug: string): Promise<KitDetail | null> {
  const kit = await db.kit.findUnique({
    where: { slug },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!kit || !kit.isActive) return null
  return resolveComposition(kit, kit.items)
}

// Used to re-resolve a kit already sitting in the cart (id known, slug not) — the
// ghost-item guard in CartContext and placeOrder's server-side verification.
export async function getKitById(id: number): Promise<KitDetail | null> {
  const kit = await db.kit.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!kit || !kit.isActive) return null
  return resolveComposition(kit, kit.items)
}
