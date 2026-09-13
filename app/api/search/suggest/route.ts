import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoreRelevance, getFuzzyItemIds, getVectorItemIds, toSearchResultItems, buildStockWhere } from "@/lib/onecStock";
import { parseSearchQuery, AUDIENCE_COLOR_BOOST } from "@/lib/searchQuery";

const SELECT_FOR_SUGGEST = {
  id: true, slug: true, name: true, brand: true,
  stock: true, pricePerPc: true, sizeInches: true, packQty: true,
  imageUrl: true, images: true, categoryId: true, article: true, barcode: true, colorGroup: true,
} as const;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  // Same natural-language pass the full catalog search uses: pulls out
  // color/shade/brand/size/price/occasion so a query like "розовые 12
  // дюймов" filters on the real columns instead of requiring "дюймов" to
  // literally appear in a product name.
  const parsed = parseSearchQuery(q);
  const hasStructure = parsed.colorGroups.length > 0 || parsed.shades.length > 0 || parsed.brands.length > 0 ||
    parsed.occasions.length > 0 || parsed.sizeInches !== null || parsed.minPrice !== null || parsed.maxPrice !== null;
  // A query that parses down to nothing at all (only stopwords/audience
  // words, e.g. "для мальчика" alone) falls back to the raw text instead of
  // silently dropping every constraint and matching the whole catalog.
  const textSearch = parsed.words.join(' ') || (hasStructure ? undefined : q);
  const words = (textSearch ?? q).split(/\s+/).filter(Boolean).slice(0, 4);
  const boostColorGroups = parsed.audience && parsed.colorGroups.length === 0 ? AUDIENCE_COLOR_BOOST[parsed.audience] : undefined;
  const articleQuery = parsed.articleCandidates[0];

  // ── Structured + exact/contains search ──────────────────────────────────
  const where = buildStockWhere({
    brands: parsed.brands.length > 0 ? parsed.brands : undefined,
    colorGroup: parsed.colorGroups[0],
    shade: parsed.shades[0],
    occasions: parsed.occasions.length > 0 ? parsed.occasions : undefined,
    sizeInches: parsed.sizeInches ?? undefined,
    minPrice: parsed.minPrice ?? undefined,
    maxPrice: parsed.maxPrice ?? undefined,
    search: textSearch,
  });

  const exactRows = await db.onecStockItem.findMany({
    where,
    select: SELECT_FOR_SUGGEST,
    take: 24,
  });

  // Score and rank exact results
  let scored = exactRows
    .map((r) => ({
      ...r,
      _score: scoreRelevance(r.name, r.brand, words, {
        article: r.article, barcode: r.barcode, articleQuery, colorGroup: r.colorGroup, boostColorGroups,
        quantity: parsed.quantity, stock: r.stock,
      }) + (r.stock > 0 ? 2 : 0),
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
      select: SELECT_FOR_SUGGEST,
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
