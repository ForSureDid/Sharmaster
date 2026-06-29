"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import type { StockCard } from "@/lib/stock";
import { useCart } from "@/context/CartContext";

type Props = {
  items: StockCard[];
  total: number;
  page: number;
  totalPages: number;
  per: number;
};

type ViewMode = "grid" | "list";

// Brands that are always latex — used as fallback when material field is missing.
const LATEX_BRANDS = ["512", "забав", "sempertex", "белбал", "belbal", "эвертс", "everts", "shai", "yuhang", "юханг"];

// Some 512 non-standard products encode the pack count in the name (e.g. "100шт").
function parsePackFromName(name: string): number | null {
  const m = name.match(/\b(\d+)\s*шт\b/i);
  const n = m ? parseInt(m[1]) : null;
  return n && n > 1 ? n : null;
}

// Returns the required pack size, or null if the item is sold individually.
function getPackSize(item: StockCard): number | null {
  const isLatex =
    (item.material ?? "").toLowerCase().includes("латекс") ||
    LATEX_BRANDS.some((kw) => (item.brand ?? "").toLowerCase().includes(kw));
  if (!isLatex) return null;

  const brand = (item.brand ?? "").toLowerCase();
  const size = item.sizeInches ?? "";

  // ── 512 ────────────────────────────────────────────────────────────────────
  if (brand.includes("512")) {
    if (size === "36") return null; // pack of 1 = individual
    const t: Record<string, number> = { "5": 100, "12": 100, "18": 10, "24": 3 };
    if (size in t) return t[size];
    // Other 512 products: pack count is stated in the name
    return parsePackFromName(item.name) ?? 100;
  }

  // ── Забава ─────────────────────────────────────────────────────────────────
  if (brand.includes("забав")) {
    const t: Record<string, number> = { "12": 50, "18": 25, "24": 10 };
    return t[size] ?? 50;
  }

  // ── Sempertex ──────────────────────────────────────────────────────────────
  if (brand.includes("sempertex")) {
    if (size === "18") {
      const isChrome = ((item.model ?? "") + " " + item.name).toLowerCase().includes("хром");
      return isChrome ? 10 : 25;
    }
    const t: Record<string, number> = { "5": 100, "12": 50, "24": 3, "36": 10 };
    return t[size] ?? 50;
  }

  // ── Белбал / Belbal ────────────────────────────────────────────────────────
  if (brand.includes("белбал") || brand.includes("belbal")) {
    if (size === "12") return 50;
    if (size === "24") return null; // pack of 1 = individual
    return item.unitsPerPackage ?? 50;
  }

  // ── Эвертс / Everts ───────────────────────────────────────────────────────
  if (brand.includes("эвертс") || brand.includes("everts")) {
    const t: Record<string, number> = { "5": 100, "12": 50 };
    return t[size] ?? 50;
  }

  // ── Chinese brands ─────────────────────────────────────────────────────────
  if (brand.includes("shai")) return 50;
  if (brand.includes("yuhang") || brand.includes("юханг")) return 100;

  // ── Unknown latex brand — fall back to DB value ────────────────────────────
  return item.unitsPerPackage ?? 50;
}


function ImageCarousel({ images, name, sizes, priority }: { images: string[]; name: string; sizes: string; priority?: boolean }) {
  const [idx, setIdx] = useState(0);
  const total = images.length;

  const prev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx(i => (i - 1 + total) % total);
  }, [total]);

  const next = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx(i => (i + 1) % total);
  }, [total]);

  return (
    <>
      <Image
        src={images[idx]}
        alt={name}
        fill
        className="object-contain p-2 transition-opacity duration-200"
        sizes={sizes}
        priority={priority}
      />
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-600 hover:bg-white"
            aria-label="Предыдущее фото"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-600 hover:bg-white"
            aria-label="Следующее фото"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`rounded-full transition-all ${i === idx ? "w-3 h-1.5 bg-sky-500" : "w-1.5 h-1.5 bg-gray-300 hover:bg-sky-300"}`}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function StockCardGrid({ item, priority }: { item: StockCard; priority?: boolean }) {
  const { items, addToCart, updateQty } = useCart();
  const cartItem = items.find((i) => i.id === item.id);
  const inStock = item.stock > 0;
  const packSize = getPackSize(item);
  const packagePrice = packSize ? item.pricePerPc * packSize : item.pricePerPc;

  const displayName = item.fullName ?? item.name;
  const asCartProduct = {
    id: item.id,
    name: displayName,
    price: packagePrice,
    salePrice: null,
    imageUrl: item.imageUrl,
    colorGroup: null,
    sizeInches: null,
    manufacturer: item.brand,
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all flex flex-col group ${inStock ? "border-gray-100 hover:border-sky-200 hover:shadow-md" : "border-gray-100 opacity-60"}`}>
      <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {item.images.length > 0 ? (
          <ImageCarousel
            images={item.images}
            name={item.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
        {inStock ? (
          <span className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide z-10">
            В наличии
          </span>
        ) : (
          <span className="absolute top-2 right-2 bg-gray-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide z-10">
            Нет
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-1 mb-1">
          {item.brand && (
            <span className="text-[10px] bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded font-medium">{item.brand}</span>
          )}
        </div>
        <a href={`/catalog/${item.id}`} className="hover:text-sky-600 transition-colors">
          <h3 className="text-xs font-semibold text-gray-800 leading-snug flex-1 mb-3 line-clamp-3">{displayName}</h3>
        </a>

        <div className="mt-auto">
          <div className="text-base font-bold text-sky-600 mb-0.5">
            {packagePrice.toLocaleString()} ₸<span className="text-xs font-normal text-gray-400"> / {packSize ? "уп" : "шт"}</span>
          </div>
          {packSize && (
            <div className="text-[10px] text-gray-400 mb-2">
              {packSize} шт · {item.pricePerPc.toLocaleString()} ₸/шт
            </div>
          )}

          {cartItem ? (
            <div className="flex items-center justify-between border border-sky-300 rounded-lg overflow-hidden">
              <button
                onClick={() => updateQty(item.id, cartItem.qty - 1)}
                className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
              >−</button>
              <span className="flex-1 text-center text-sm font-bold text-sky-600">
                {cartItem.qty}{packSize ? " уп" : " шт"}
              </span>
              <button
                onClick={() => updateQty(item.id, cartItem.qty + 1)}
                className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
              >+</button>
            </div>
          ) : (
            <button
              onClick={() => addToCart(asCartProduct, packSize ?? null)}
              disabled={!inStock}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {!inStock ? "Нет в наличии" : packSize ? "В корзину (1 уп)" : "В корзину"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StockCardList({ item }: { item: StockCard }) {
  const { items, addToCart, updateQty } = useCart();
  const cartItem = items.find((i) => i.id === item.id);
  const inStock = item.stock > 0;
  const packSize = getPackSize(item);
  const packagePrice = packSize ? item.pricePerPc * packSize : item.pricePerPc;

  const displayName = item.fullName ?? item.name;
  const asCartProduct = {
    id: item.id,
    name: displayName,
    price: packagePrice,
    salePrice: null,
    imageUrl: item.imageUrl,
    colorGroup: null,
    sizeInches: null,
    manufacturer: item.brand,
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-sky-200 hover:shadow-md transition-all flex group">
      <div className="relative w-28 flex-shrink-0 bg-gray-50">
        {item.images.length > 0 ? (
          <ImageCarousel images={item.images} name={item.name} sizes="112px" />
        ) : (
          <div className="w-full h-full min-h-[80px] flex items-center justify-center">
            <svg className="w-7 h-7 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 p-4 flex items-center gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {item.brand && <span className="text-[10px] bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded font-medium">{item.brand}</span>}
            {inStock ? (
              <span className="text-[10px] text-green-600 font-medium">В наличии</span>
            ) : (
              <span className="text-[10px] text-gray-400">Нет в наличии</span>
            )}
          </div>
          <a href={`/catalog/${item.id}`} className="hover:text-sky-600 transition-colors">
            <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{displayName}</h3>
          </a>
        </div>
        <div className="flex-shrink-0 text-right min-w-[100px]">
          <p className="text-lg font-bold text-sky-600">{packagePrice.toLocaleString()} ₸</p>
          <p className="text-xs text-gray-400">за 1 {packSize ? "уп" : "шт"}</p>
          {packSize && (
            <p className="text-[10px] text-gray-400 mt-0.5">{packSize} шт · {item.pricePerPc.toLocaleString()} ₸/шт</p>
          )}
        </div>
        {cartItem ? (
          <div className="flex-shrink-0">
            <div className="flex items-center border border-sky-300 rounded-lg overflow-hidden">
              <button onClick={() => updateQty(item.id, cartItem.qty - 1)} className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 text-lg font-bold">−</button>
              <span className="w-12 text-center text-sm font-bold text-sky-600">{cartItem.qty}{packSize ? " уп" : ""}</span>
              <button onClick={() => updateQty(item.id, cartItem.qty + 1)} className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 text-lg font-bold">+</button>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0">
            <button
              onClick={() => addToCart(asCartProduct, packSize ?? null)}
              disabled={!inStock}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {packSize ? "1 уп" : "В корзину"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockContent({ items, total, page, totalPages, per }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [view, setView] = useState<ViewMode>("grid");
  const currentQ = sp.get("q") ?? "";
  const [searchDraft, setSearchDraft] = useState(currentQ);

  // Sync input when URL q changes (back/forward nav, header search)
  useEffect(() => {
    setSearchDraft(currentQ);
  }, [currentQ]);

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set(key, value);
    if (key !== "page") params.delete("page");
    router.push(`/catalog?${params.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    const q = searchDraft.trim();
    if (q) params.set("q", q); else params.delete("q");
    params.delete("page");
    router.push(`/catalog?${params.toString()}`);
  }

  function clearSearch() {
    setSearchDraft("");
    const params = new URLSearchParams(sp.toString());
    params.delete("q");
    params.delete("page");
    router.push(`/catalog?${params.toString()}`);
  }

  const sort = sp.get("sort") ?? "smart";

  return (
    <div className="flex-1 min-w-0">
      {/* Search bar */}
      <form onSubmit={submitSearch} className="mb-3">
        <div className="flex rounded-xl overflow-hidden border border-gray-200 focus-within:border-sky-300 transition-colors bg-white">
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Поиск по названию, артикулу, бренду..."
            className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            className="px-5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
          >
            Найти
          </button>
        </div>
      </form>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 flex-shrink-0">
          {currentQ ? (
            <>
              <span className="font-semibold text-gray-700">{total.toLocaleString()}</span>
              {" "}результатов по{" "}
              <span className="font-semibold text-sky-600">«{currentQ}»</span>
            </>
          ) : (
            <><span className="font-semibold text-gray-700">{total.toLocaleString()}</span> товаров</>
          )}
        </span>
        <div className="h-4 w-px bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 hidden sm:block">Сортировка:</span>
          <select
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-sky-300 bg-white text-gray-700 cursor-pointer"
          >
            <option value="smart">По умолчанию</option>
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
            <option value="name_asc">По названию А–Я</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-500 hidden sm:block">Показывать:</span>
          {[30, 48, 96].map((n) => (
            <button key={n} onClick={() => update("per", String(n))}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${per === n ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"}`}>
              {n}
            </button>
          ))}
          <div className="h-4 w-px bg-gray-200 mx-1" />
          <button onClick={() => setView("grid")}
            className={`p-1.5 rounded-lg border transition-colors ${view === "grid" ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"}`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
            </svg>
          </button>
          <button onClick={() => setView("list")}
            className={`p-1.5 rounded-lg border transition-colors ${view === "list" ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid / List */}
      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
          <p className="text-gray-400 text-sm">Товары не найдены. Попробуйте изменить фильтры.</p>
          <a href="/catalog" className="mt-3 inline-block text-sky-500 hover:text-sky-600 text-sm font-medium">Сбросить фильтры</a>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((i, idx) => <StockCardGrid key={i.id} item={i} priority={idx < 8} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((i) => <StockCardList key={i.id} item={i} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <button onClick={() => update("page", String(Math.max(1, page - 1)))} disabled={page === 1}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-sky-300 hover:text-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Назад
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
            return (
              <button key={p} onClick={() => update("page", String(p))}
                className={`w-8 h-8 text-xs rounded-lg border transition-colors font-medium ${page === p ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-500"}`}>
                {p}
              </button>
            );
          })}
          <button onClick={() => update("page", String(Math.min(totalPages, page + 1)))} disabled={page === totalPages}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-sky-300 hover:text-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
