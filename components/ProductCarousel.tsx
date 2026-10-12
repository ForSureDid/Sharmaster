"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import QtyStepper from "@/components/QtyStepper";
import type { StockCard } from "@/lib/onecStock";
import { getPackSize, isSoldByPiece, getDisplayPrice } from "@/lib/pack";

type CarouselItem = StockCard & { article?: string | null };

type Props = {
  items: CarouselItem[];
  title: string;
  href: string;
  // "new": green "new" badge (amber for not-yet-arrived items); "sale": red -N% badge + red price.
  variant: "new" | "sale";
};

export default function ProductCarousel({ items, title, href: allHref, variant }: Props) {
  const isSale = variant === "sale";
  const { items: cartItems, addToCart, updateQty } = useCart();
  const scroller = useRef<HTMLDivElement>(null);

  // Page by a whole number of cards so the snap points stay aligned and no card is left peeking in.
  function scrollBy(dir: 1 | -1) {
    const el = scroller.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.columnGap) || 0;
    const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const step = card.offsetWidth + gap;
    const perPage = Math.max(1, Math.round((inner + gap) / step));
    el.scrollBy({ left: dir * perPage * step, behavior: "smooth" });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">{title}</h2>
          <Link
            href={allHref}
            className="text-sm text-sky-500 hover:text-sky-600 font-medium bg-sky-50 hover:bg-sky-100 rounded-full px-5 py-2 transition-colors"
          >
            Смотреть всё
          </Link>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-slate-700">
          <button onClick={() => scrollBy(-1)} aria-label="Назад" className="p-1 hover:text-sky-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scrollBy(1)} aria-label="Вперёд" className="p-1 hover:text-sky-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pt-5 -mt-5 pb-6 -mx-4 px-4 scroll-px-4 sm:-mx-5 sm:px-5 sm:scroll-px-5 [--p:1rem] sm:[--p:1.25rem] [mask-image:linear-gradient(to_right,transparent,#000_var(--p),#000_calc(100%-var(--p)),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_var(--p),#000_calc(100%-var(--p)),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const cartItem = cartItems.find((i) => i.id === item.id);
          const packSize = isSoldByPiece(item) ? null : getPackSize(item);
          const basePrice = getDisplayPrice(item);
          const salePrice = item.salePercent ? Math.round(basePrice * (1 - item.salePercent / 100)) : null;
          const price = salePrice ?? basePrice;
          const isPending = !isSale && item.isNewPending && !item.isNew;
          const name = item.fullName ?? item.name;
          const productHref = `/catalog/${item.slug ?? item.id}`;
          const asCartProduct = {
            id: item.id,
            name,
            price,
            salePrice: null,
            imageUrl: item.imageUrl,
            colorGroup: null,
            sizeInches: null,
            manufacturer: item.brand,
            isBalloon: item.isBalloon,
          };

          return (
            <div
              key={item.id}
              className="snap-start shrink-0 w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.85rem)] lg:w-[calc(25%-0.95rem)] xl:w-[calc(20%-1rem)] bg-white rounded-2xl shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_0_20px_rgba(15,23,42,0.14)] p-4 flex flex-col"
            >
              <div className="relative aspect-square">
                <Link href={productHref} className="absolute inset-0">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🎈</div>
                  )}
                </Link>
                <span className={`absolute top-0 left-0 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide pointer-events-none ${isSale ? "bg-red-500" : isPending ? "bg-amber-400" : "bg-green-500"}`}>
                  {isSale ? (item.salePercent ? `-${item.salePercent}%` : "Акция") : isPending ? "Ожидайте" : "Новинка"}
                </span>
              </div>

              <div className="mt-3 flex flex-col flex-1">
                <p className={`text-xl font-bold ${isSale ? "text-red-600" : "text-slate-800"}`}>
                  {price.toLocaleString("ru-RU")} ₸
                  {packSize ? <span className="text-xs font-normal text-slate-400"> / уп</span> : null}
                </p>
                {salePrice && <p className="text-xs text-slate-400 line-through">{basePrice.toLocaleString("ru-RU")} ₸</p>}
                {item.article && <p className="text-xs text-slate-400 mt-1">{item.article}</p>}
                <Link href={productHref} className="text-[13px] text-slate-700 leading-snug mt-1 line-clamp-3 hover:text-sky-600 transition-colors">
                  {name}
                </Link>
                {(item.brand || packSize) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {item.brand}
                    {item.brand && packSize ? " · " : ""}
                    {packSize ? `${packSize} шт в уп.` : ""}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  {item.stock === 0 ? (
                    <button disabled className={`w-full py-3 text-white text-sm font-semibold rounded-full cursor-default ${isPending ? "bg-emerald-400" : "bg-gray-300"}`}>
                      {isPending ? "Ожидайте поступления" : "Нет в наличии"}
                    </button>
                  ) : cartItem ? (
                    <QtyStepper qty={cartItem.qty} onChange={(qty) => updateQty(item.id, qty)} size="sm" unit={packSize ? "уп" : "шт"} fill />
                  ) : (
                    <button
                      onClick={() => addToCart(asCartProduct, packSize)}
                      className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-full transition-colors"
                    >
                      В корзину
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
