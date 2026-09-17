"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import { useCart } from "@/context/CartContext";
import QtyStepper from "@/components/QtyStepper";
import type { KitDetail as KitDetailData } from "@/lib/kits";

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-gray-50 flex items-center justify-center">
        <svg className="w-20 h-20 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full aspect-square rounded-2xl bg-white overflow-hidden">
        <Image key={images[active]} src={images[active]} alt={name} fill className="object-contain p-6" sizes="(max-width: 768px) 100vw, 50vw" priority />
      </div>
      {images.length > 1 && (
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
      )}
    </div>
  );
}

function ItemThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg className="w-6 h-6 text-sky-200" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        </svg>
      </div>
    );
  }
  return <Image src={src} alt={alt} fill className="object-contain p-1" sizes="58px" onError={() => setFailed(true)} />;
}

export default function KitDetail({ kit }: { kit: KitDetailData }) {
  const { kits, addKit, removeKit } = useCart();
  const inCart = kits.some((k) => k.kitId === kit.id);
  const [extraQty, setExtraQty] = useState<Record<number, number>>({});

  const bumpExtra = useCallback((onecStockItemId: number, totalQty: number, floor: number) => {
    setExtraQty((prev) => ({ ...prev, [onecStockItemId]: Math.max(0, totalQty - floor) }));
  }, []);

  const extrasSum = useMemo(
    () => kit.items.reduce((s, i) => s + (extraQty[i.onecStockItemId] ?? 0) * (i.salePrice ?? i.displayPrice), 0),
    [kit.items, extraQty]
  );

  // Mirrors the server's rawQty conversion in app/order/actions.ts — for an
  // actual balloon, `stock` is tracked in raw pieces, so the kit's per-pack
  // qty has to be multiplied out before comparing against it.
  const outOfStock = kit.items.some((i) => {
    const rawQty = i.packSize && i.isBalloon ? i.qty * i.packSize : i.qty;
    return i.stock < rawQty;
  });

  function handleBuy() {
    addKit(kit, extraQty);
    setExtraQty({});
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Gallery */}
      <div className="lg:sticky lg:top-28 self-start">
        <Gallery images={kit.images} name={kit.name} />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-5">
        <span className="text-xs font-medium text-sky-600 uppercase tracking-wide">Готовый набор</span>
        <h1 className="text-2xl font-extrabold text-gray-800 leading-snug -mt-3">{kit.name}</h1>

        <div className="bg-gray-50 rounded-2xl p-4 flex items-end gap-3">
          <span className="text-4xl font-extrabold text-sky-600">{kit.price.toLocaleString("ru-KZ")} ₸</span>
          <span className="text-sm text-gray-400 pb-1">фиксированная цена набора</span>
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-600 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Состав набора зафиксирован — убрать товар из него нельзя. Можно докупить сверху нужное количество
            или добавить в корзину что-то ещё. Если набор в итоге не нужен, его можно полностью отменить —
            отдельно добавленные товары при этом останутся в корзине.
          </span>
        </div>

        {kit.description && (
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Описание</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{kit.description}</p>
          </div>
        )}

        {inCart ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Набор уже в корзине
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/cart" className="flex-1 h-12 flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl transition-colors">
                Перейти в корзину
              </Link>
              <button
                onClick={() => removeKit(kit.id)}
                className="flex-1 h-12 flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 text-sm font-bold rounded-xl transition-colors"
              >
                Отказаться от набора
              </button>
            </div>
          </div>
        ) : (
          <>
            {outOfStock && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                Часть состава набора закончилась на складе — сейчас его нельзя оформить.
              </div>
            )}
            <button
              onClick={handleBuy}
              disabled={outOfStock}
              className="w-full h-14 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors shadow-sm"
            >
              {outOfStock ? "Нет в наличии" : `+ Купить набор${extrasSum > 0 ? ` и ещё на ${extrasSum.toLocaleString("ru-KZ")} ₸` : ""}`}
            </button>
          </>
        )}

        {/* Composition */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600">Состав набора ({kit.items.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {kit.items.map((item) => {
              const floor = item.qty;
              const extra = extraQty[item.onecStockItemId] ?? 0;
              const total = floor + extra;
              const unitPrice = item.salePrice ?? item.displayPrice;
              return (
                <div key={item.onecStockItemId} className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden relative">
                    <ItemThumb src={item.imageUrl} alt={item.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.article && <p className="text-[11px] text-gray-400">{item.article}</p>}
                    <p className="text-sm text-gray-700 leading-snug line-clamp-2">{item.name}</p>
                    {item.brand && <p className="text-xs text-gray-400 mt-0.5">{item.brand}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-sm font-bold text-gray-700">{(unitPrice * total).toLocaleString("ru-KZ")} ₸</span>
                    <QtyStepper
                      qty={total}
                      onChange={(q) => bumpExtra(item.onecStockItemId, q, floor)}
                      size="xs"
                      unit={item.byPiece ? "шт" : item.packSize ? "уп" : "шт"}
                    />
                    <span className="text-[10px] text-gray-400">в наборе: {floor}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
