"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";

function CartImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <PlaceholderIcon />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-contain p-1"
      sizes="64px"
      onError={() => setFailed(true)}
    />
  );
}

function PlaceholderIcon() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg className="w-7 h-7 text-sky-200" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      </svg>
    </div>
  );
}

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeFromCart, updateQty, clearCart, totalPrice } = useCart();
  const router = useRouter();

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeCart]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] transition-opacity"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white z-[70] shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-base font-bold text-gray-800">Корзина</h2>
            {items.length > 0 && (
              <span className="text-xs text-gray-400">({items.reduce((s, i) => s + i.qty, 0)} шт.)</span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <svg className="w-16 h-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-400 text-sm">Корзина пуста</p>
              <p className="text-gray-300 text-xs">Добавьте товары из каталога</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 px-4">
              {items.map((item) => (
                <li key={item.id} className="py-4 flex gap-3">
                  {/* Image */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden relative">
                    {item.imageUrl
                      ? <CartImage src={item.imageUrl} alt={item.name} />
                      : <PlaceholderIcon />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">{item.name}</p>
                    <p className="text-sm font-bold text-sky-600 mt-1">
                      {((item.salePrice ?? item.price) * item.qty).toLocaleString()} ₸
                    </p>
                    {item.qty > 1 && (
                      <p className="text-[11px] text-gray-400">
                        {(item.salePrice ?? item.price).toLocaleString()} ₸ × {item.qty}
                      </p>
                    )}

                    {/* Qty stepper */}
                    <div className="flex items-center gap-2 mt-2">
                      {item.packSize && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          уп. {item.packSize} шт
                        </span>
                      )}
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQty(item.id, item.qty - (item.packSize ?? 1))}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-gray-800">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, item.qty + (item.packSize ?? 1))}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none"
                        >
                          +
                        </button>
                      </div>

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
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Итого:</span>
              <span className="text-xl font-bold text-gray-800">{totalPrice.toLocaleString()} ₸</span>
            </div>
            <button
              onClick={() => { closeCart(); router.push("/order"); }}
              className="flex items-center justify-center gap-2 w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Оформить заказ
            </button>
            <button
              onClick={clearCart}
              className="w-full py-2 text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Очистить корзину
            </button>
          </div>
        )}
      </div>
    </>
  );
}
