"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import { useLikes } from "@/context/LikesContext";
import { useCart } from "@/context/CartContext";
import type { StockCard } from "@/lib/stock";

export default function LikedPage() {
  const { likedIds, removeLike, likedCount, ready } = useLikes();
  const { items: cartItems, addToCart, updateQty } = useCart();
  const [likedItems, setLikedItems] = useState<StockCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (likedIds.length === 0) { setLikedItems([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/stock/cards?ids=${likedIds.join(",")}`)
      .then(r => r.json())
      .then(d => setLikedItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [likedIds, ready]);

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium">Избранное</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-baseline gap-3 mb-6">
            <h1 className="text-xl font-bold text-gray-800">Избранное</h1>
            {likedCount > 0 && (
              <span className="text-sm text-gray-400">{likedCount} товаров</span>
            )}
          </div>

          {loading ? (
            <div className="py-24 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
            </div>
          ) : likedItems.length === 0 ? (
            <div className="py-24 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 mb-4">
                <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-700 mb-1">Список избранного пуст</p>
              <p className="text-sm text-gray-400 mb-6">Нажмите на сердечко на карточке товара, чтобы добавить его сюда</p>
              <Link href="/catalog" className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors">
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {likedItems.map((item) => {
                const cartItem = cartItems.find((i) => i.id === item.id);
                const price = item.pricePerPc;
                const salePrice = item.salePercent ? Math.round(price * (1 - item.salePercent / 100)) : null;
                const displayPrice = salePrice ?? price;
                const asCartProduct = {
                  id: item.id,
                  name: item.fullName ?? item.name,
                  price: displayPrice,
                  salePrice: null,
                  imageUrl: item.imageUrl,
                  colorGroup: null,
                  sizeInches: null,
                  manufacturer: item.brand,
                };

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-sky-200 hover:shadow-md transition-all flex gap-0"
                  >
                    <Link href={`/catalog/${item.id}`} className="relative w-28 flex-shrink-0 bg-gray-50">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.fullName ?? item.name}
                          fill
                          className="object-contain p-2"
                          sizes="112px"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[80px] flex items-center justify-center">
                          <svg className="w-8 h-8 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 p-4 flex items-center gap-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <Link href={`/catalog/${item.id}`} className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 hover:text-sky-600 transition-colors">
                          {item.fullName ?? item.name}
                        </Link>
                        {item.brand && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{item.brand}</p>
                        )}
                      </div>

                      <div className="flex-shrink-0 text-right">
                        {salePrice ? (
                          <>
                            <p className="text-lg font-bold text-red-500">{salePrice.toLocaleString()} ₸</p>
                            <p className="text-xs text-gray-400 line-through">{price.toLocaleString()} ₸</p>
                          </>
                        ) : (
                          <p className="text-lg font-bold text-sky-600">{price.toLocaleString()} ₸</p>
                        )}
                      </div>

                      {cartItem ? (
                        <div className="flex-shrink-0 flex items-center border border-sky-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQty(item.id, cartItem.qty - 1)}
                            className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-sky-600">{cartItem.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, cartItem.qty + 1)}
                            className="w-9 h-9 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors text-lg font-bold"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(asCartProduct)}
                          className="flex-shrink-0 hidden sm:flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                          В корзину
                        </button>
                      )}

                      <button
                        onClick={() => removeLike(item.id)}
                        className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Убрать из избранного"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
