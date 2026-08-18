"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartSummaryCard from "@/components/CartSummaryCard";
import QtyStepper from "@/components/QtyStepper";
import { useCart } from "@/context/CartContext";

function ItemImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <PlaceholderIcon />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-contain p-1.5"
      sizes="80px"
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

export default function CartPage() {
  const { items, removeFromCart, updateQty, clearCart, totalCount, syncNotices, dismissSyncNotices } = useCart();

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
            <Link href="/" className="hover:text-sky-500 transition-colors">Главная</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-600 font-medium">Корзина</span>
          </nav>

          <div className="flex items-baseline gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Корзина</h1>
            {items.length > 0 && (
              <span className="text-sm text-gray-400">({totalCount} {totalCount === 1 ? "товар" : "товара"})</span>
            )}
          </div>

          {syncNotices.length > 0 && (
            <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
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

          {items.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-lg font-bold text-gray-700 mb-2">Корзина пуста</h2>
              <p className="text-sm text-gray-400 mb-6">Добавьте товары из каталога, чтобы оформить заказ</p>
              <Link
                href="/catalog"
                className="inline-block px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-2xl transition-colors"
              >
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Item list */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 divide-y divide-gray-50">
                {items.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden relative">
                      {item.imageUrl ? <ItemImage src={item.imageUrl} alt={item.name} /> : <PlaceholderIcon />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.packSize && (
                          <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                            {item.packSize} шт/уп
                          </span>
                        )}
                        <span className="text-xs text-gray-400 sm:hidden">
                          {(item.salePrice ?? item.price).toLocaleString()} ₸ {item.packSize ? "/ уп" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="hidden sm:block w-20 flex-shrink-0 text-right text-sm text-gray-500">
                      {(item.salePrice ?? item.price).toLocaleString()} ₸
                    </div>

                    <QtyStepper
                      qty={item.qty}
                      onChange={(qty) => updateQty(item.id, qty)}
                      size="sm"
                      unit={item.packSize ? "уп" : undefined}
                    />

                    <div className="hidden sm:block w-24 flex-shrink-0 text-right text-sm font-bold text-sky-600">
                      {((item.salePrice ?? item.price) * item.qty).toLocaleString()} ₸
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="lg:sticky lg:top-28">
                <CartSummaryCard
                  primaryAction={{ kind: "link", href: "/order", label: "Перейти к оформлению" }}
                  showNextTierHint
                  secondaryAction={
                    <button
                      onClick={clearCart}
                      className="w-full text-center text-xs text-gray-400 hover:text-red-400 transition-colors -mt-1"
                    >
                      Очистить корзину
                    </button>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
