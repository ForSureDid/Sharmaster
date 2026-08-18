"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useLikes } from "@/context/LikesContext";
import QtyStepper from "@/components/QtyStepper";
import type { StockDetail } from "@/lib/onecStock";
import { getPackSize, isSoldByPiece, getDisplayPrice } from "@/lib/pack";

// mm (1C's unit) -> cm for display, e.g. 160 -> "16", 5 -> "0.5".
function formatCm(mm: number): string {
  const cm = mm / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1);
}

// grams -> g/kg for display, e.g. 3530 -> "3.53 кг", 150 -> "150 г".
function formatWeight(g: number): string {
  if (g < 1000) return `${g} г`;
  const kg = g / 1000;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(2)} кг`;
}

// occasion/color store multiple values in one field, e.g. "14 Февраля;8 Марта"
// or "Голубой;Прозрачный".
function formatMultiValue(raw: string): string {
  return raw.split(";").map((s) => s.trim()).filter(Boolean).join(", ");
}

function Gallery({ images, name, badges }: { images: string[]; name: string; badges?: React.ReactNode }) {
  const [active, setActive] = useState(0);

  const prev = useCallback(() => setActive(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setActive(i => (i + 1) % images.length), [images.length]);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative w-full aspect-square rounded-2xl bg-white overflow-hidden group">
        <Image
          key={images[active]}
          src={images[active]}
          alt={name}
          fill
          className="object-contain p-6"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
        {badges && (
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
            {badges}
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Предыдущее фото"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Следующее фото"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-sky-500 hover:border-sky-200 transition-colors"
            aria-label="Предыдущее фото"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white border-2 transition-all ${i === active ? "border-sky-400" : "border-gray-100 hover:border-sky-200"}`}
              >
                <Image src={src} alt={`${name} ${i + 1}`} fill className="object-contain p-1.5" sizes="80px" />
              </button>
            ))}
          </div>
          <button
            onClick={next}
            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-sky-500 hover:border-sky-200 transition-colors"
            aria-label="Следующее фото"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function NoImage() {
  return (
    <div className="w-full aspect-square rounded-2xl bg-gray-50 flex items-center justify-center">
      <svg className="w-20 h-20 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  );
}

export default function StockItemDetail({ item }: { item: StockDetail }) {
  const { items, addToCart, updateQty } = useCart();
  const { isAdmin } = useAuth();
  const { isLiked, toggleLike } = useLikes();
  const liked = isLiked(item.id);
  const cartItem = items.find((i) => i.id === item.id);
  const inStock = item.stock > 0;
  const packSize = getPackSize(item);
  const byPiece = isSoldByPiece(item);
  const dimensions = item.lengthMm && item.widthMm && item.heightMm
    ? `${formatCm(item.lengthMm)}×${formatCm(item.widthMm)}×${formatCm(item.heightMm)} см`
    : null;
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

  // Brief "added to cart" confirmation toast — the qty stepper replacing the
  // button is already feedback, but a first-time add is otherwise silent.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const announceAdded = useCallback((label: string) => {
    setToast(label);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const promoBadge = item.onSale
    ? { text: item.salePercent ? `-${item.salePercent}%` : "Акция", className: "bg-red-500 text-white" }
    : isPending
    ? { text: "Ожидайте поступления", className: "bg-amber-400 text-white" }
    : item.isNew
    ? { text: "Новинка", className: "bg-green-500 text-white" }
    : item.isHit
    ? { text: "Хит", className: "bg-orange-500 text-white" }
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Gallery */}
      <div className="lg:sticky lg:top-28 self-start">
        {item.images.length > 0 ? (
          <Gallery
            images={item.images}
            name={item.name}
            badges={promoBadge && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shadow-sm ${promoBadge.className}`}>
                {promoBadge.text}
              </span>
            )}
          />
        ) : (
          <NoImage />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-5">
        {/* Meta line: brand */}
        {item.brand && (
          <span className="text-xs font-medium text-sky-600 uppercase tracking-wide">{item.brand}</span>
        )}

        {/* Name */}
        <h1 className="text-2xl font-extrabold text-gray-800 leading-snug -mt-3">{displayName}</h1>

        {/* Price block */}
        <div className="bg-gray-50 rounded-2xl p-4 flex items-end gap-3">
          {salePrice && (
            <span className="text-lg text-gray-400 line-through pb-1">{basePrice.toLocaleString("ru-KZ")} ₸</span>
          )}
          <span className={`text-4xl font-extrabold ${salePrice ? "text-red-600" : "text-sky-600"}`}>
            {displayPrice.toLocaleString("ru-KZ")} ₸
          </span>
          <span className="text-sm text-gray-400 pb-1">/ {byPiece ? "шт" : packSize ? "уп" : "шт"}</span>
          <button
            onClick={() => toggleLike(item.id)}
            className={`ml-auto w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-colors ${liked ? "bg-red-50 border-red-200" : "bg-white border-gray-200 hover:border-red-200"}`}
            title={liked ? "Убрать из избранного" : "В избранное"}
          >
            <svg className={`w-6 h-6 transition-colors ${liked ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-400"}`} viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Helium tank delivery/price disclaimer — only these two hand-priced refill sizes */}
        {(item.article === "ГАЗ10" || item.article === "ГАЗ40") && (
          <div className="text-sm text-red-600 font-medium leading-snug bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            Доставка гелия осуществляется только для покупателей в черте г. Астана.
            <br />
            Данная цена не является актуальной. Актуальную цену можно узнать у менеджера.
          </div>
        )}

        {/* Pack info */}
        {!byPiece && packSize && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {item.isBalloon === false ? (
              <><strong>{packSize} шт</strong> в упаковке</>
            ) : (
              <><strong>{packSize} шт</strong> в упаковке · {item.pricePerPc.toLocaleString("ru-KZ")} ₸ / шт</>
            )}
          </div>
        )}

        {/* Add to cart */}
        <div className="flex flex-col gap-2">
          {cartItem ? (
            <>
              <QtyStepper
                qty={cartItem.qty}
                onChange={(qty) => updateQty(item.id, qty)}
                size="lg"
                unit={byPiece || !packSize ? "шт" : "уп"}
                fill
              />
              {byPiece && packSize && inStock && (
                <button
                  onClick={() => updateQty(item.id, cartItem.qty + packSize)}
                  className="w-full py-2.5 text-sm border border-sky-200 text-sky-600 hover:bg-sky-50 rounded-xl transition-colors font-medium"
                >
                  + упаковка ({packSize} шт)
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  addToCart(asCartProduct, byPiece ? null : (packSize ?? null));
                  announceAdded(displayName);
                }}
                disabled={!inStock}
                className="w-full h-14 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors shadow-sm"
              >
                {!inStock ? "Нет в наличии" : "+ В корзину"}
              </button>
              {byPiece && packSize && inStock && (
                <button
                  onClick={() => {
                    addToCart(asCartProduct, null, packSize);
                    announceAdded(displayName);
                  }}
                  className="w-full py-2.5 text-sm border border-sky-200 text-sky-600 hover:bg-sky-50 rounded-xl transition-colors font-medium"
                >
                  + упаковка ({packSize} шт)
                </button>
              )}
            </>
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${inStock ? "bg-green-500" : "bg-gray-300"}`} />
          <span className={inStock ? "text-gray-700 font-medium" : "text-gray-400"}>
            {inStock ? "В наличии" : "Нет в наличии"}
          </span>
          {isAdmin && inStock && <span className="text-gray-400">· {item.stock} шт на складе</span>}
        </div>

        {/* Details table */}
        {(item.article || item.barcode || item.material || item.sizeInches || item.model || packSize || dimensions || item.occasion || item.color || item.shade || item.weightGrams) && (
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-600">Характеристики</h2>
            </div>
            <dl className="divide-y divide-gray-50">
              {item.article && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Артикул</dt>
                  <dd className="text-sm font-medium text-gray-700">{item.article}</dd>
                </div>
              )}
              {item.material && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Материал</dt>
                  <dd className="text-sm font-medium text-gray-700">{item.material}</dd>
                </div>
              )}
              {item.sizeInches && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Размер</dt>
                  <dd className="text-sm font-medium text-gray-700">{item.sizeInches}"</dd>
                </div>
              )}
              {item.color && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Цвет</dt>
                  <dd className="text-sm font-medium text-gray-700">{formatMultiValue(item.color)}</dd>
                </div>
              )}
              {item.shade && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Оттенок</dt>
                  <dd className="text-sm font-medium text-gray-700">{item.shade}</dd>
                </div>
              )}
              {item.occasion && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Праздник</dt>
                  <dd className="text-sm font-medium text-gray-700">{formatMultiValue(item.occasion)}</dd>
                </div>
              )}
              {item.model && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Модель</dt>
                  <dd className="text-sm font-medium text-gray-700">{item.model}</dd>
                </div>
              )}
              {packSize && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">В упаковке</dt>
                  <dd className="text-sm font-medium text-gray-700">{packSize} шт</dd>
                </div>
              )}
              {dimensions && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Габариты</dt>
                  <dd className="text-sm font-medium text-gray-700">{dimensions}</dd>
                </div>
              )}
              {item.weightGrams && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Вес</dt>
                  <dd className="text-sm font-medium text-gray-700">{formatWeight(item.weightGrams)}</dd>
                </div>
              )}
              {item.barcode && (
                <div className="flex px-4 py-2.5 gap-4">
                  <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">Штрихкод</dt>
                  <dd className="text-sm font-medium text-gray-700 font-mono">{item.barcode}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Описание</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{item.description}</p>
          </div>
        )}
      </div>

      {/* Added-to-cart toast */}
      <div
        aria-live="polite"
        className={`fixed top-24 right-6 z-[60] max-w-[calc(100vw-3rem)] w-80 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3.5 flex items-start gap-3 transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <span className="w-8 h-8 flex-shrink-0 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">Добавлено в корзину</p>
          <p className="text-xs text-gray-500 truncate">{toast}</p>
        </div>
      </div>
    </div>
  );
}
