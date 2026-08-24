import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSearchResultItems } from "@/lib/onecStock";

// Powers the "Популярные товары" column of the header search dropdown's
// empty-query discovery panel. Reuses the existing "Хит продаж" flag rather
// than standing up separate popularity tracking.
export const revalidate = 300;

export async function GET() {
  const rows = await db.onecStockItem.findMany({
    where: { isHidden: false, isHit: true, stock: { gt: 0 } },
    select: {
      id: true, slug: true, name: true, brand: true,
      stock: true, pricePerPc: true, sizeInches: true, packQty: true,
      imageUrl: true, images: true, categoryId: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  const items = await toSearchResultItems(rows);

  return NextResponse.json({ items });
}
