"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useLikes } from "@/context/LikesContext";
import QtyStepper from "@/components/QtyStepper";
import type { StockCard } from "@/lib/onecStock";
import { getPackSize, isSoldByPiece, getDisplayPrice } from "@/lib/pack";

type Props = { items: StockCard[] };

export default function ProductGrid({ items }: Props) {
  const { items: cartItems, addToCart, updateQty } = useCart();
  const { isLiked, toggleLike } = useLikes();

  if (items.length === 0) return null;

  return (
    <section className="py-10 bg-gray-50 border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Акция</h2>
          <Link href="/sale" className="text-sm text-sky-500 hover:text-sky-700 font-medium bg-sky-50 hover:bg-sky-100 rounded-full px-4 py-2 transition-colors">
            Все акции →
          </Link>
        </div>

        <div className="border border-gray-200 rounded-2xl bg-white p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item, i) => {
              const cartItem = cartItems.find((i) => i.id === item.id);
              const liked = isLiked(item.id);
              const packSize = isSoldByPiece(item) ? null : getPackSize(item);
              const basePrice = getDisplayPrice(item);
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
                isBalloon: item.isBalloon,
              };

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all group flex flex-col"
                >
                  <div className="relative aspect-square bg-white">
                    <Link href={`/catalog/${item.slug ?? item.id}`} className="absolute inset-0">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.fullName ?? item.name}
                          fill
                          priority={i < 4}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🎈</div>
                      )}
                    </Link>
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide pointer-events-none">
                      {item.salePercent ? `-${item.salePercent}%` : 'Акция'}
                    </span>
                    <button
                      onClick={() => toggleLike(item.id)}
                      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors z-10"
                      title={liked ? "Убрать из избранного" : "В избранное"}
                    >
                      <svg className={`w-4 h-4 transition-colors ${liked ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-400"}`} viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-3 flex flex-col flex-1">
                    <Link href={`/catalog/${item.slug ?? item.id}`} className="text-xs text-gray-500 leading-snug mb-2 flex-1 hover:text-gray-700 transition-colors">
                      {item.fullName ?? item.name}
                    </Link>

                    <div className="mt-auto">
                      <div className="mb-2">
                        {salePrice ? (
                          <>
                            <span className="text-lg font-bold text-red-600">
                              {salePrice.toLocaleString()} ₸{packSize ? <span className="text-xs font-normal text-gray-400"> / уп</span> : null}
                            </span>
                            <p className="text-xs text-gray-400 line-through">{basePrice.toLocaleString()} ₸</p>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-red-600">
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

                      {cartItem ? (
                        <QtyStepper
                          qty={cartItem.qty}
                          onChange={(qty) => updateQty(item.id, qty)}
                          size="xs"
                          unit={packSize ? "уп" : "шт"}
                          fill
                        />
                      ) : (
                        <button
                          onClick={() => addToCart(asCartProduct, packSize)}
                          className="w-full py-1.5 bg-sky-400 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          + В корзину
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
