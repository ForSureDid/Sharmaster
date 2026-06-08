"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ProductCard } from "@/lib/products";
import { useCart } from "@/context/CartContext";

type Props = {
  items: ProductCard[];
  total: number;
  page: number;
  totalPages: number;
  per: number;
};

type ViewMode = "grid" | "list";

function ProductCardGrid({ product }: { product: ProductCard }) {
  const hasImage = !!product.imageUrl;
  const hasSale = product.salePrice !== null && product.salePrice < product.price;
  const { items, addToCart, updateQty } = useCart();
  const cartItem = items.find((i) => i.id === product.id);

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-sky-200 hover:shadow-md transition-all flex flex-col group">
      <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <Image
            src={product.imageUrl!}
            alt={product.name}
            fill
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-sky-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        )}
        {hasSale && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Акция</span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-xs font-semibold text-gray-800 leading-snug flex-1 mb-2 line-clamp-3">{product.name}</h3>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-400 truncate">{product.manufacturer ?? ''}</span>
          <span className="text-[10px] text-gray-300 font-mono ml-1 flex-shrink-0">#{product.id}</span>
        </div>

        <div className="mt-auto">
          {hasSale ? (
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-base font-bold text-red-500">{Number(product.salePrice).toLocaleString()} ₸</span>
              <span className="text-xs text-gray-400 line-through">{Number(product.price).toLocaleString()} ₸</span>
            </div>
          ) : (
            <div className="text-base font-bold text-sky-600 mb-2">{Number(product.price).toLocaleString()} ₸</div>
          )}

          {cartItem ? (
            <div className="flex items-center justify-between border border-sky-300 rounded-lg overflow-hidden">
              <button
                onClick={() => updateQty(product.id, cartItem.qty - 1)}
                className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
              >
                −
              </button>
              <span className="flex-1 text-center text-sm font-bold text-sky-600">{cartItem.qty}</span>
              <button
                onClick={() => updateQty(product.id, cartItem.qty + 1)}
                className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => addToCart(product)}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              В корзину
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCardList({ product }: { product: ProductCard }) {
  const hasImage = !!product.imageUrl;
  const hasSale = product.salePrice !== null && product.salePrice < product.price;
  const { items, addToCart, updateQty } = useCart();
  const cartItem = items.find((i) => i.id === product.id);

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-sky-200 hover:shadow-md transition-all flex gap-0">
      <div className="relative w-28 flex-shrink-0 bg-gray-50">
        {hasImage ? (
          <Image
            src={product.imageUrl!}
            alt={product.name}
            fill
            className="object-contain p-2"
            sizes="112px"
          />
        ) : (
          <div className="w-full h-full min-h-[80px] flex items-center justify-center">
            <svg className="w-8 h-8 text-sky-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 p-4 flex items-center gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {product.manufacturer && <span className="text-[10px] text-gray-400">{product.manufacturer}</span>}
            <span className="text-[10px] text-gray-300 font-mono">#{product.id}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {hasSale ? (
            <>
              <p className="text-lg font-bold text-red-500">{Number(product.salePrice).toLocaleString()} ₸</p>
              <p className="text-xs text-gray-400 line-through">{Number(product.price).toLocaleString()} ₸</p>
            </>
          ) : (
            <p className="text-lg font-bold text-sky-600">{Number(product.price).toLocaleString()} ₸</p>
          )}
        </div>
        {cartItem ? (
          <div className="flex-shrink-0 flex items-center border border-sky-300 rounded-lg overflow-hidden">
            <button
              onClick={() => updateQty(product.id, cartItem.qty - 1)}
              className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold text-sky-600">{cartItem.qty}</span>
            <button
              onClick={() => updateQty(product.id, cartItem.qty + 1)}
              className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={() => addToCart(product)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            В корзину
          </button>
        )}
      </div>
    </div>
  );
}

export default function CatalogContent({ items, total, page, totalPages, per }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [view, setView] = useState<ViewMode>("grid");

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set(key, value);
    if (key !== "page") params.delete("page");
    router.push(`/catalog?${params.toString()}`);
  }

  const sort = sp.get("sort") ?? "price_asc";

  return (
    <div className="flex-1 min-w-0">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 flex-shrink-0">
          <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> товаров
        </span>

        <div className="h-4 w-px bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 hidden sm:block">Сортировка:</span>
          <select
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-sky-300 bg-white text-gray-700 cursor-pointer"
          >
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
            <option value="name_asc">По названию А–Я</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-500 hidden sm:block">Показывать:</span>
          {[30, 48, 96].map((n) => (
            <button
              key={n}
              onClick={() => update("per", String(n))}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${per === n ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"}`}
            >
              {n}
            </button>
          ))}

          <div className="h-4 w-px bg-gray-200 mx-1" />

          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded-lg border transition-colors ${view === "grid" ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
            </svg>
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded-lg border transition-colors ${view === "list" ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Products */}
      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
          <p className="text-gray-400 text-sm">Товары не найдены. Попробуйте изменить фильтры.</p>
          <a href="/catalog" className="mt-3 inline-block text-sky-500 hover:text-sky-600 text-sm font-medium">Сбросить фильтры</a>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => <ProductCardGrid key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((p) => <ProductCardList key={p.id} product={p} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <button
            onClick={() => update("page", String(Math.max(1, page - 1)))}
            disabled={page === 1}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-sky-300 hover:text-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Назад
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
            return (
              <button
                key={p}
                onClick={() => update("page", String(p))}
                className={`w-8 h-8 text-xs rounded-lg border transition-colors font-medium ${page === p ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-500"}`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => update("page", String(Math.min(totalPages, page + 1)))}
            disabled={page === totalPages}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-sky-300 hover:text-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
