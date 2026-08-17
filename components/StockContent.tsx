"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import type { StockCard } from "@/lib/onecStock";
import { getPackSize, isSoldByPiece, getDisplayPrice } from "@/lib/pack";
import { useCart } from "@/context/CartContext";
import { useLikes } from "@/context/LikesContext";

function LikeButton({ id, className }: { id: number; className?: string }) {
  const { isLiked, toggleLike } = useLikes();
  const liked = isLiked(id);
  return (
    <button
      onClick={() => toggleLike(id)}
      className={className ?? "absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors z-10"}
      title={liked ? "Убрать из избранного" : "В избранное"}
    >
      <svg className={`w-4 h-4 transition-colors ${liked ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-400 hover:stroke-red-400"}`} viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}

type Props = {
  items: StockCard[];
  total: number;
  page: number;
  totalPages: number;
  per: number;
  basePath?: string;
};

type ViewMode = "grid" | "list";

function ImageCarousel({ images, name, sizes, priority, objectFit = "contain" }: { images: string[]; name: string; sizes: string; priority?: boolean; objectFit?: "contain" | "cover" }) {
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
        className={objectFit === "cover" ? "object-cover transition-opacity duration-200" : "object-contain p-2 transition-opacity duration-200"}
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
  const byPiece = isSoldByPiece(item);
  const basePrice = getDisplayPrice(item);
  const salePrice = item.onSale && item.salePercent
    ? Math.round(basePrice * (1 - item.salePercent / 100))
    : null;
  const displayPrice = salePrice ?? basePrice;

  const displayName = item.fullName ?? item.name;
  const asCartProduct = {
    id: item.id,
    name: displayName,
    price: displayPrice,
    salePrice: null,
    imageUrl: item.imageUrl,
    colorGroup: null,
    sizeInches: null,
    manufacturer: item.brand,
    isBalloon: item.isBalloon,
  };

  const isPending = item.isNewPending && !inStock;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all flex flex-col group ${
      isPending
        ? "bg-gray-50 border-gray-200"
        : inStock ? "bg-white border-gray-100 hover:border-sky-200 hover:shadow-md" : "bg-white border-gray-100 opacity-60"
    }`}>
      <div className="relative aspect-square flex items-center justify-center overflow-hidden bg-white">
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
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-10">
          {item.onSale && (
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {item.salePercent ? `-${item.salePercent}%` : "Акция"}
            </span>
          )}
          {isPending ? (
            <span className="bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Ожидайте
            </span>
          ) : item.isNew ? (
            <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Новинка
            </span>
          ) : item.isHit ? (
            <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Хит
            </span>
          ) : null}
        </div>
        <LikeButton id={item.id} />
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-1 mb-1">
          {item.brand && (
            <span className="text-[10px] bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded font-medium">{item.brand}</span>
          )}
        </div>
        <a href={`/catalog/${item.slug ?? item.id}`} className="hover:text-sky-600 transition-colors">
          <h3 className="text-xs font-semibold text-gray-800 leading-snug flex-1 mb-3 line-clamp-3">{displayName}</h3>
        </a>

        <div className="mt-auto">
          {salePrice ? (
            <div className="mb-0.5">
              <div className="text-base font-bold text-red-600">
                {salePrice.toLocaleString()} ₸
                <span className="text-xs font-normal text-gray-400"> / {byPiece ? "шт" : packSize ? "уп" : "шт"}</span>
              </div>
              <div className="text-xs text-gray-400 line-through">{basePrice.toLocaleString()} ₸</div>
            </div>
          ) : (
            <div className="text-base font-bold text-sky-600 mb-0.5">
              {displayPrice.toLocaleString()} ₸
              <span className="text-xs font-normal text-gray-400"> / {byPiece ? "шт" : packSize ? "уп" : "шт"}</span>
            </div>
          )}
          {!byPiece && packSize && (
            <div className="text-[10px] text-gray-400 mb-2">
              {item.isBalloon === false
                ? <>{packSize} шт в упаковке</>
                : <>{packSize} шт · {item.pricePerPc.toLocaleString()} ₸/шт</>}
            </div>
          )}

          {!inStock ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-default"
            >
              Ожидайте поступления
            </button>
          ) : cartItem ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border border-sky-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => updateQty(item.id, cartItem.qty - 1)}
                  className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
                >−</button>
                <span className="flex-1 text-center text-sm font-bold text-sky-600">
                  {cartItem.qty}{byPiece || !packSize ? " шт" : " уп"}
                </span>
                <button
                  onClick={() => updateQty(item.id, cartItem.qty + 1)}
                  className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
                >+</button>
              </div>
              {byPiece && packSize && (
                <button
                  onClick={() => updateQty(item.id, cartItem.qty + packSize)}
                  className="w-full text-[11px] py-1 border border-sky-200 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                >
                  + упаковка ({packSize} шт)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                onClick={() => addToCart(asCartProduct, byPiece ? null : (packSize ?? null))}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                {byPiece ? "В корзину (1 шт)" : packSize ? "В корзину (1 уп)" : "В корзину"}
              </button>
              {byPiece && packSize && (
                <button
                  onClick={() => addToCart(asCartProduct, null, packSize)}
                  className="w-full text-[11px] py-1 border border-sky-200 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                >
                  + упаковка ({packSize} шт)
                </button>
              )}
            </div>
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
  const byPiece = isSoldByPiece(item);
  const basePrice = getDisplayPrice(item);
  const salePrice = item.onSale && item.salePercent
    ? Math.round(basePrice * (1 - item.salePercent / 100))
    : null;
  const displayPrice = salePrice ?? basePrice;

  const displayName = item.fullName ?? item.name;
  const asCartProduct = {
    id: item.id,
    name: displayName,
    price: displayPrice,
    salePrice: null,
    imageUrl: item.imageUrl,
    colorGroup: null,
    sizeInches: null,
    manufacturer: item.brand,
    isBalloon: item.isBalloon,
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
        {item.onSale && (
          <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide z-10">
            {item.salePercent ? `-${item.salePercent}%` : "Акция"}
          </span>
        )}
        <LikeButton id={item.id} className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors z-10" />
      </div>
      <div className="flex-1 p-4 flex items-center gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {item.brand && <span className="text-[10px] bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded font-medium">{item.brand}</span>}
            {!inStock && item.isNewPending && (
              <span className="text-[10px] text-amber-600 font-medium">Ожидайте поступления</span>
            )}
          </div>
          <a href={`/catalog/${item.slug ?? item.id}`} className="hover:text-sky-600 transition-colors">
            <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{displayName}</h3>
          </a>
        </div>
        <div className="flex-shrink-0 text-right min-w-[100px]">
          {salePrice && (
            <p className="text-xs text-gray-400 line-through">{basePrice.toLocaleString()} ₸</p>
          )}
          <p className={`text-lg font-bold ${salePrice ? "text-red-600" : "text-sky-600"}`}>{displayPrice.toLocaleString()} ₸</p>
          <p className="text-xs text-gray-400">за 1 {byPiece ? "шт" : packSize ? "уп" : "шт"}</p>
          {!byPiece && packSize && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {item.isBalloon === false
                ? <>{packSize} шт в упаковке</>
                : <>{packSize} шт · {item.pricePerPc.toLocaleString()} ₸/шт</>}
            </p>
          )}
        </div>
        {!inStock ? (
          <button disabled className="flex-shrink-0 px-3 py-2 bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-default whitespace-nowrap">
            Ожидайте поступления
          </button>
        ) : cartItem ? (
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center border border-sky-300 rounded-lg overflow-hidden">
              <button onClick={() => updateQty(item.id, cartItem.qty - 1)} className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 text-lg font-bold">−</button>
              <span className="w-12 text-center text-sm font-bold text-sky-600">{cartItem.qty}{byPiece || !packSize ? " шт" : " уп"}</span>
              <button onClick={() => updateQty(item.id, cartItem.qty + 1)} className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 text-lg font-bold">+</button>
            </div>
            {byPiece && packSize && (
              <button
                onClick={() => updateQty(item.id, cartItem.qty + packSize)}
                className="text-[11px] px-2 py-0.5 border border-sky-200 text-sky-600 hover:bg-sky-50 rounded transition-colors whitespace-nowrap"
              >
                + уп. ({packSize} шт)
              </button>
            )}
          </div>
        ) : (
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            <button
              onClick={() => addToCart(asCartProduct, byPiece ? null : (packSize ?? null))}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {byPiece ? "1 шт" : packSize ? "1 уп" : "В корзину"}
            </button>
            {byPiece && packSize && (
              <button
                onClick={() => addToCart(asCartProduct, null, packSize)}
                className="text-[11px] px-3 py-1 border border-sky-200 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors whitespace-nowrap"
              >
                + уп. ({packSize} шт)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockContent({ items, total, page, totalPages, per, basePath = "/catalog" }: Props) {
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
    router.push(`${basePath}?${params.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    const q = searchDraft.trim();
    if (q) params.set("q", q); else params.delete("q");
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  }

  function clearSearch() {
    setSearchDraft("");
    const params = new URLSearchParams(sp.toString());
    params.delete("q");
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
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
            <option value="hit">Хиты продаж</option>
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
          <a href={basePath} className="mt-3 inline-block text-sky-500 hover:text-sky-600 text-sm font-medium">Сбросить фильтры</a>
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
