import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoreRelevance, getFuzzyItemIds } from "@/lib/stock";
import { WORD_SYNONYMS } from "@/lib/search-hints";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);

  // ── Exact/contains search ─────────────────────────────────────────────────────
  const exactRows = await db.stockItem.findMany({
    where: {
      AND: words.map((word) => {
        const variants = [word, ...(WORD_SYNONYMS[word.toLowerCase()] ?? [])];
        return {
          OR: variants.flatMap((w) => [
            { name:     { contains: w, mode: "insensitive" as const } },
            { fullName: { contains: w, mode: "insensitive" as const } },
            { brand:    { contains: w, mode: "insensitive" as const } },
          ]),
        };
      }),
    },
    select: {
      id: true, name: true, fullName: true, brand: true,
      stock: true, pricePerPc: true,
      imageUrl: true, images: true, productId: true,
    },
    take: 24,
  });

  // Score and rank exact results
  let scored = exactRows
    .map((r) => ({
      ...r,
      _score:
        scoreRelevance(r.name, r.fullName, r.brand, words) +
        (r.stock > 0 ? 2 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);

  // ── Fuzzy fallback: fill up to 6 when exact results are sparse ───────────────
  if (scored.length < 3 && q.length >= 3) {
    const exactIds = new Set(scored.map((r) => r.id));
    const fuzzyIds = await getFuzzyItemIds(q, 12);
    const newIds = fuzzyIds.filter((id) => !exactIds.has(id)).slice(0, 6 - scored.length);

    if (newIds.length > 0) {
      const fuzzyRows = await db.stockItem.findMany({
        where: { id: { in: newIds } },
        select: {
          id: true, name: true, fullName: true, brand: true,
          stock: true, pricePerPc: true,
          imageUrl: true, images: true, productId: true,
        },
      });
      const ordered = newIds.map((id) => fuzzyRows.find((r) => r.id === id)!).filter(Boolean);
      scored = [
        ...scored,
        ...ordered.map((r) => ({ ...r, _score: 0 })),
      ];
    }
  }

  // Resolve product images for items that lack their own
  const missingIds = scored
    .filter((r) => !r.imageUrl && r.images.length === 0 && r.productId != null)
    .map((r) => r.productId!);

  const productImgMap: Record<number, string | null> = {};
  if (missingIds.length > 0) {
    const prods = await db.product.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, imageUrl: true },
    });
    for (const p of prods) productImgMap[p.id] = p.imageUrl;
  }

  const items = scored.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    stock: r.stock,
    pricePerPc: Number(r.pricePerPc),
    imageUrl:
      r.imageUrl ??
      r.images[0] ??
      (r.productId != null ? (productImgMap[r.productId] ?? null) : null),
  }));

  return NextResponse.json({ items });
}
