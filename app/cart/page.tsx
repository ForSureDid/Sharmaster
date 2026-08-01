"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart, type CartItem } from "@/context/CartContext";
import { nextOneTimeTier } from "@/lib/discounts";

function ItemImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <PlaceholderIcon />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-contain p-1"
      sizes="96px"
      onError={() => setFailed(true)}
    />
  );
}

function PlaceholderIcon() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg className="w-8 h-8 text-sky-200" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      </svg>
    </div>
  );
}

function QtyStepper({ item, onChange }: { item: CartItem; onChange: (qty: number) => void }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => onChange(item.qty - 1)}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none"
      >
        −
      </button>
      <span className="w-12 text-center text-sm font-semibold text-gray-800">
        {item.qty}{item.packSize ? " уп" : ""}
      </span>
      <button
        onClick={() => onChange(item.qty + 1)}
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}

export default function CartPage() {
  const { items, removeFromCart, updateQty, clearCart, totalCount, totalPrice, discountPercent, discountAmount, finalTotal, syncNotices, dismissSyncNotices } = useCart();
  const nextTier = nextOneTimeTier(totalPrice);

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${items.length > 0 ? "pb-28" : ""}`}>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
            <Link href="/" className="hover:text-sky-500 transition-colors">Главная</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-600 font-medium">Корзина</span>
          </nav>

          {syncNotices.length > 0 && (
            <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 space-y-1">
                {syncNotices.map((n, i) => <p key={i}>{n}</p>)}
              </div>
              <button onClick={dismissSyncNotices} className="text-amber-400 hover:text-amber-600 flex-shrink-0" title="Закрыть">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-xl font-bold text-gray-800">Корзина</h1>
            {items.length > 0 && (
              <span className="text-sm text-gray-400">({totalCount} {totalCount === 1 ? "товар" : "товара"})</span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-lg font-bold text-gray-700 mb-2">Корзина пуста</h2>
              <p className="text-sm text-gray-400 mb-6">Добавьте товары из каталога, чтобы оформить заказ</p>
              <Link
                href="/catalog"
                className="inline-block px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <>
              {/* Progressive discount status */}
              <div className="mb-4 flex items-center gap-2.5 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 text-sm text-sky-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {discountPercent > 0 ? (
                  <span>
                    Применена скидка <b>{discountPercent}%</b> (−{discountAmount.toLocaleString()} ₸)
                    {nextTier && <> · добавьте товаров ещё на <b>{(nextTier.amount - totalPrice).toLocaleString()} ₸</b>, чтобы получить <b>{nextTier.percent}%</b></>}
                  </span>
                ) : nextTier ? (
                  <span>
                    Добавьте товаров ещё на <b>{(nextTier.amount - totalPrice).toLocaleString()} ₸</b>, чтобы получить скидку <b>{nextTier.percent}%</b>
                  </span>
                ) : null}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400">
                      <td className="py-3 pl-5">Товар</td>
                      <td className="py-3 text-right">Цена за ед.</td>
                      <td className="py-3 text-center">Количество</td>
                      <td className="py-3 text-right">Сумма</td>
                      <td className="py-3 pr-5"></td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-4 pl-5">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden relative">
                              {item.imageUrl ? <ItemImage src={item.imageUrl} alt={item.name} /> : <PlaceholderIcon />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{item.name}</p>
                              {item.packSize && (
                                <span className="inline-block mt-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                  {item.packSize} шт/уп
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right text-sm text-gray-600 whitespace-nowrap">
                          {(item.salePrice ?? item.price).toLocaleString()} ₸
                        </td>
                        <td className="py-4">
                          <div className="flex justify-center">
                            <QtyStepper item={item} onChange={(qty) => updateQty(item.id, qty)} />
                          </div>
                        </td>
                        <td className="py-4 text-right text-sm font-bold text-sky-600 whitespace-nowrap">
                          {((item.salePrice ?? item.price) * item.qty).toLocaleString()} ₸
                        </td>
                        <td className="py-4 pr-5 text-right">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex gap-3">
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden relative">
                      {item.imageUrl ? <ItemImage src={item.imageUrl} alt={item.name} /> : <PlaceholderIcon />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">{item.name}</p>
                      <p className="text-sm font-bold text-sky-600 mt-1">
                        {((item.salePrice ?? item.price) * item.qty).toLocaleString()} ₸
                      </p>
                      {item.qty > 1 && (
                        <p className="text-[11px] text-gray-400">
                          {(item.salePrice ?? item.price).toLocaleString()} ₸ × {item.qty}{item.packSize ? " уп" : ""}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <QtyStepper item={item} onChange={(qty) => updateQty(item.id, qty)} />
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-3">
                <button
                  onClick={clearCart}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  Очистить корзину
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Floating summary bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[11px] text-gray-400 leading-none mb-0.5">Товаров</p>
                <p className="text-sm font-semibold text-gray-800">{totalCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 leading-none mb-0.5">Итого</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-gray-800 whitespace-nowrap">{finalTotal.toLocaleString()} ₸</p>
                  {discountPercent > 0 && (
                    <p className="text-xs text-gray-400 line-through whitespace-nowrap">{totalPrice.toLocaleString()} ₸</p>
                  )}
                </div>
              </div>
              {discountPercent > 0 && (
                <div className="hidden sm:block">
                  <p className="text-[11px] text-gray-400 leading-none mb-0.5">Скидка</p>
                  <p className="text-sm font-semibold text-green-600 whitespace-nowrap">−{discountPercent}%</p>
                </div>
              )}
            </div>
            <Link
              href="/order"
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-3 bg-sky-500 hover:bg-sky-600 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
            >
              <span className="sm:hidden">Оформить</span>
              <span className="hidden sm:inline">Перейти к оформлению</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
