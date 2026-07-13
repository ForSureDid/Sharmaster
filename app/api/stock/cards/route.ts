import { NextRequest, NextResponse } from "next/server";
import { getStockCardsByIds } from "@/lib/stock";

// GET /api/stock/cards?ids=1,2,3 → свежие карточки товаров (для избранного).
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 300);

  const items = await getStockCardsByIds(ids);
  return NextResponse.json({ items });
}
