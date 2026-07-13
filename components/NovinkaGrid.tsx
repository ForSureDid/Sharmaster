"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useLikes } from "@/context/LikesContext";
import type { NovinkaCard } from "@/lib/stock";
import { getPackSize, isSoldByPiece } from "@/lib/pack";

type Props = { items: NovinkaCard[] };

export default function NovinkaGrid({ items }: Props) {
  const { items: cartItems, addToCart, updateQty } = useCart();
  const { isLiked, toggleLike } = useLikes();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p className="text-5xl mb-4">🎈</p>
        <p className="text-lg font-medium">Новинок пока нет</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((item) => {
        const cartItem = cartItems.find((i) => i.id === item.id);
        const liked = isLiked(item.id);
        const packSize = isSoldByPiece(item) ? null : getPackSize(item);
        const basePrice = item.pricePerPc * (packSize ?? 1);
        const salePrice = item.salePercent
          ? Math.round(basePrice * (1 - item.salePercent / 100))
          : null;
        const asCartProduct = {
          id: item.id,
          name: item.fullName ?? item.name,
          price: salePrice ?? basePrice,
          salePrice: null,
          imageUrl: item.imageUrl,
          colorGroup: null,
          sizeInches: null,
          manufacturer: item.brand,
        };
        const isPending = item.isNewPending && !item.isNew;

        return (
          <div
            key={item.id}
            className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all group flex flex-col"
          >
            <div className="block relative h-40 bg-white">
              <Link href={`/catalog/${item.id}`} className="absolute inset-0">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.fullName ?? item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🎈</div>
                )}
              </Link>

              {isPending ? (
                <span className="absolute top-2 left-2 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide pointer-events-none">
                  Ожидайте
                </span>
              ) : (
                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide pointer-events-none">
                  New
                </span>
              )}

              <button
                onClick={() => toggleLike({ id: item.id, name: item.fullName ?? item.name, price: basePrice, salePrice, imageUrl: item.imageUrl, manufacturer: item.brand })}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors z-10"
                title={liked ? "Убрать из избранного" : "В избранное"}
              >
                <svg className={`w-4 h-4 transition-colors ${liked ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-400"}`} viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>

              {item.stock === 0 && isPending && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full text-center leading-tight">
                    Ожидайте<br/>поступления
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 flex flex-col flex-1">
              {isPending && (
                <p className="text-[10px] font-semibold text-amber-600 mb-1 uppercase tracking-wide">Ожидайте поступления</p>
              )}
              <Link href={`/catalog/${item.id}`} className="text-xs text-gray-500 leading-snug mb-2 flex-1 hover:text-gray-700 transition-colors">
                {item.fullName ?? item.name}
              </Link>

              <div className="flex items-end justify-between gap-2 mt-auto">
                <div>
                  {salePrice ? (
                    <>
                      <span className="text-lg font-bold text-gray-800">
                        {salePrice.toLocaleString()} ₸{packSize ? <span className="text-xs font-normal text-gray-400"> / уп</span> : null}
                      </span>
                      <p className="text-xs text-gray-400 line-through">{basePrice.toLocaleString()} ₸</p>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-gray-800">
                      {basePrice.toLocaleString()} ₸{packSize ? <span className="text-xs font-normal text-gray-400"> / уп</span> : null}
                    </span>
                  )}
                  {packSize && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{packSize} шт в упаковке</p>
                  )}
                  {item.brand && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.brand}</p>
                  )}
                </div>

                {item.stock === 0 ? (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">Нет в наличии</span>
                ) : cartItem ? (
                  <div className="flex items-center border border-sky-300 rounded-lg overflow-hidden flex-shrink-0">
                    <button
                      onClick={() => updateQty(item.id, cartItem.qty - 1)}
                      className="w-7 h-7 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-sky-600">{cartItem.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, cartItem.qty + 1)}
                      className="w-7 h-7 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors font-bold"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(asCartProduct, packSize)}
                    className="flex-shrink-0 w-8 h-8 bg-sky-400 hover:bg-sky-500 text-white rounded-lg flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
