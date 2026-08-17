import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoreRelevance, getFuzzyItemIds } from "@/lib/onecStock";
import { getPackSize, isSoldByPiece } from "@/lib/pack";
import { WORD_SYNONYMS } from "@/lib/search-hints";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);

  // ── Exact/contains search ─────────────────────────────────────────────────────
  const exactRows = await db.onecStockItem.findMany({
    where: {
      isHidden: false,
      AND: words.map((word) => {
        const variants = [word, ...(WORD_SYNONYMS[word.toLowerCase()] ?? [])];
        return {
          OR: variants.flatMap((w) => [
            { name:  { contains: w, mode: "insensitive" as const } },
            { brand: { contains: w, mode: "insensitive" as const } },
          ]),
        };
      }),
    },
    select: {
      id: true, slug: true, name: true, brand: true,
      stock: true, pricePerPc: true, sizeInches: true, packQty: true,
      imageUrl: true, images: true,
    },
    take: 24,
  });

  // Score and rank exact results
  let scored = exactRows
    .map((r) => ({
      ...r,
      _score: scoreRelevance(r.name, r.brand, words) + (r.stock > 0 ? 2 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);

  // ── Fuzzy fallback: fill up to 6 when exact results are sparse ───────────────
  if (scored.length < 3 && q.length >= 3) {
    const exactIds = new Set(scored.map((r) => r.id));
    const fuzzyIds = await getFuzzyItemIds(q, 12);
    const newIds = fuzzyIds.filter((id) => !exactIds.has(id)).slice(0, 6 - scored.length);

    if (newIds.length > 0) {
      const fuzzyRows = await db.onecStockItem.findMany({
        where: { id: { in: newIds }, isHidden: false },
        select: {
          id: true, slug: true, name: true, brand: true,
          stock: true, pricePerPc: true, sizeInches: true, packQty: true,
          imageUrl: true, images: true,
        },
      });
      const ordered = newIds.map((id) => fuzzyRows.find((r) => r.id === id)!).filter(Boolean);
      scored = [
        ...scored,
        ...ordered.map((r) => ({ ...r, _score: 0 })),
      ];
    }
  }

  const items = scored.map((r) => {
    // Show the same price the catalog card shows: per pack when sold by pack
    const packSize = isSoldByPiece(r) ? null : getPackSize(r);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      brand: r.brand,
      stock: r.stock,
      price: Number(r.pricePerPc) * (packSize ?? 1),
      packSize,
      imageUrl: r.imageUrl ?? r.images[0] ?? null,
    };
  });

  return NextResponse.json({ items });
}
