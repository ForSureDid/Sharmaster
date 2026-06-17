"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import type { StockCard } from "@/lib/stock";

type Props = { items: StockCard[] };

export default function ProductGrid({ items }: Props) {
  const { items: cartItems, addToCart, updateQty } = useCart();

  if (items.length === 0) return null;

  return (
    <section className="py-10 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Акция</h2>
          <Link href="/catalog" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все товары →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => {
            const cartItem = cartItems.find((i) => i.id === item.id);
            const asCartProduct = {
              id: item.id,
              name: item.fullName ?? item.name,
              price: item.pricePerPc,
              salePrice: null,
              imageUrl: item.imageUrl,
              colorGroup: null,
              sizeInches: null,
              manufacturer: item.brand,
            };

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all group flex flex-col"
              >
                <Link href={`/catalog/${item.id}`} className="block relative h-40 bg-gray-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.fullName ?? item.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🎈</div>
                  )}
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Акция
                  </span>
                </Link>

                <div className="p-3 flex flex-col flex-1">
                  <Link href={`/catalog/${item.id}`} className="text-xs text-gray-500 leading-snug mb-2 flex-1 hover:text-gray-700 transition-colors">
                    {item.fullName ?? item.name}
                  </Link>

                  <div className="flex items-end justify-between gap-2 mt-auto">
                    <div>
                      <span className="text-lg font-bold text-red-600">{item.pricePerPc} ₸</span>
                      {item.brand && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.brand}</p>
                      )}
                    </div>

                    {cartItem ? (
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
                        onClick={() => addToCart(asCartProduct)}
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
      </div>
    </section>
  );
}
