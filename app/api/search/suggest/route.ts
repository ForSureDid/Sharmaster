import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoreRelevance, getFuzzyItemIds, getVectorItemIds, toSearchResultItems } from "@/lib/onecStock";
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
      imageUrl: true, images: true, categoryId: true,
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
  async function fillFrom(idsPromise: Promise<number[]>, take: number) {
    const knownIds = new Set(scored.map((r) => r.id));
    const ids = await idsPromise;
    const newIds = ids.filter((id) => !knownIds.has(id)).slice(0, take);
    if (newIds.length === 0) return;

    const rows = await db.onecStockItem.findMany({
      where: { id: { in: newIds }, isHidden: false },
      select: {
        id: true, slug: true, name: true, brand: true,
        stock: true, pricePerPc: true, sizeInches: true, packQty: true,
        imageUrl: true, images: true, categoryId: true,
      },
    });
    const ordered = newIds.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
    scored = [...scored, ...ordered.map((r) => ({ ...r, _score: 0 }))];
  }

  if (scored.length < 3 && q.length >= 3) {
    await fillFrom(getFuzzyItemIds(q, 12), 6 - scored.length);
  }

  // ── Vector fallback: last resort when neither exact nor trigram-fuzzy found enough ──
  if (scored.length < 3 && q.length >= 3) {
    await fillFrom(getVectorItemIds(q, 12), 6 - scored.length);
  }

  // Show the same isBalloon-aware price the catalog card shows (see toSearchResultItems)
  const items = await toSearchResultItems(scored);

  return NextResponse.json({ items });
}
