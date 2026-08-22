// Pack size / unit-of-sale rules for stock items.
//
// StockItem.packQty (количество шаров в упаковке, filled per-brand in the DB)
// is the source of truth:
//   packQty >= 2 → sold by pack of packQty
//   packQty <= 1 → sold individually
// The brand tables below are a legacy fallback for items where packQty
// is not filled yet (Belbal, Everts, Chinese brands, …).

export type PackItem = {
  name: string;
  fullName?: string | null;
  brand?: string | null;
  material?: string | null;
  sizeInches?: string | null;
  model?: string | null;
  unitsPerPackage?: number | null;
  packQty?: number | null;
  isBalloon?: boolean;
};

// Brands that are always latex — used as fallback when material field is missing.
const LATEX_BRANDS = ["512", "забав", "sempertex", "белбал", "belbal", "эвертс", "everts", "shai", "yuhang", "юханг"];

function isLatex(item: PackItem): boolean {
  return (
    (item.material ?? "").toLowerCase().includes("латекс") ||
    LATEX_BRANDS.some((kw) => (item.brand ?? "").toLowerCase().includes(kw))
  );
}

// Some non-standard products encode the pack count in the name (e.g. "100шт").
function parsePackFromName(name: string): number | null {
  const m = name.match(/\b(\d+)\s*шт\b/i);
  const n = m ? parseInt(m[1]) : null;
  return n && n > 1 ? n : null;
}

// Extract inch size from name when sizeInches DB field is not populated.
// Handles "(18''/46 см)" and Sempertex "R18 ..." patterns.
function parseSizeFromName(name: string): string {
  const r = /^R(\d+)\s/.exec(name);
  if (r) return r[1];
  const inch = /\((\d+)''/.exec(name);
  if (inch) return inch[1];
  return "";
}

// Latex "giants" — sold per piece, with a quick-add button for a full pack.
const BY_PIECE_SIZES = new Set(["18", "24", "36"]);

// Legacy heuristic pack tables per brand.
function legacyPackSize(item: PackItem): number | null {
  if (!isLatex(item)) return null;

  const brand = (item.brand ?? "").toLowerCase();
  const size = item.sizeInches ?? parseSizeFromName(item.fullName ?? item.name);

  if (brand.includes("512")) {
    if (size === "36") return null; // pack of 1 = individual
    const t: Record<string, number> = { "5": 100, "12": 100, "18": 10, "24": 3 };
    if (size in t) return t[size];
    return parsePackFromName(item.name) ?? 100;
  }

  if (brand.includes("забав")) {
    const t: Record<string, number> = { "12": 50, "18": 25, "24": 10 };
    return t[size] ?? 50;
  }

  if (brand.includes("sempertex")) {
    if (size === "18") {
      const isChrome = ((item.model ?? "") + " " + item.name).toLowerCase().includes("хром");
      return isChrome ? 10 : 25;
    }
    const t: Record<string, number> = {
      "1/3": 50, "2/5": 50, "2/6": 50, "3/8": 50,
      "5": 100, "6": 100, "10": 100,
      "12": 50, "16": 25, "116": 50,
      "24": 3, "36": 10,
    };
    return t[size] ?? 50;
  }

  if (brand.includes("белбал") || brand.includes("belbal")) {
    if (size === "12") return 50;
    if (size === "24") return null; // pack of 1 = individual
    return item.unitsPerPackage ?? 50;
  }

  if (brand.includes("эвертс") || brand.includes("everts")) {
    const t: Record<string, number> = { "5": 100, "12": 50 };
    return t[size] ?? 50;
  }

  if (brand.includes("shai")) return 50;
  if (brand.includes("yuhang") || brand.includes("юханг")) return 100;

  return item.unitsPerPackage ?? 50;
}

// Returns the pack size (>= 2), or null when no pack is known.
// For by-piece items this is the size of the optional "+ упаковка" quick-add.
export function getPackSize(item: PackItem): number | null {
  if (item.packQty != null) return item.packQty > 1 ? item.packQty : null;
  return legacyPackSize(item);
}

// True when the item is sold per piece (price shown as ₸/шт).
// Latex 18"/24"/36" are always by piece — the customer can still add
// a full pack of packQty via the secondary button.
export function isSoldByPiece(item: PackItem): boolean {
  if (isLatex(item)) {
    const size = item.sizeInches ?? parseSizeFromName(item.fullName ?? item.name);
    if (BY_PIECE_SIZES.has(size)) return true;
  }
  if (item.packQty != null) return item.packQty <= 1;
  return false;
}

// Minimum order quantity for items that are sold per-piece (not bundled into a
// priced pack) but still can't be ordered in less than N — e.g. thin foil
// digits that need at least a few together to look right. Mirasbek 2026-08-22:
// СмайлБерри's foil digits ("Цифры") must be ordered in 3s minimum.
const MIN_QTY_RULES: { brand: string; namePattern: RegExp; minQty: number }[] = [
  { brand: "смайлберри", namePattern: /цифр/i, minQty: 3 },
];

export function getMinQty(item: { brand?: string | null; name: string }): number {
  const brand = (item.brand ?? "").toLowerCase();
  const rule = MIN_QTY_RULES.find((r) => brand.includes(r.brand) && r.namePattern.test(item.name));
  return rule?.minQty ?? 1;
}

// Pack price for display. For actual balloons (item.isBalloon), pricePerPc is
// genuinely the price of one single balloon, so the pack price is pricePerPc*packSize.
// For every other category (сервировка, свечи, топперы, перья, коробки, etc.) 1C's
// price already IS the whole pack/set price — packQty there is a descriptive "how many
// pieces are in this pack" count, not a per-unit multiplier, so multiplying again would
// double-count it. item.isBalloon is only set on OnecStockItem-backed cards (see
// lib/onecStock.ts's toCard()) — legacy StockItem-backed items (item.isBalloon
// undefined) fall back to the old always-multiply behavior.
export function getDisplayPrice(item: PackItem & { pricePerPc: number }): number {
  if (isSoldByPiece(item)) return item.pricePerPc;
  const packSize = getPackSize(item);
  if (!packSize) return item.pricePerPc;
  return item.isBalloon === false ? item.pricePerPc : item.pricePerPc * packSize;
}
