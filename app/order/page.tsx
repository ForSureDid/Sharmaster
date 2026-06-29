"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/context/CartContext";
import { placeOrder } from "./actions";

export default function OrderPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await placeOrder({
        customerName: name,
        phone,
        address,
        items: items.map(i => ({ id: i.id, qty: i.packSize ? i.qty * i.packSize : i.qty, name: i.name, price: i.salePrice ?? i.price })),
      });
      if (result.ok) {
        clearCart();
        setSuccess(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
            <Link href="/" className="hover:text-sky-500 transition-colors">Главная</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link href="/catalog" className="hover:text-sky-500 transition-colors">Каталог</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-600 font-medium">Оформление заказа</span>
          </nav>

          {/* Success state */}
          {success ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-800 mb-2">Заказ принят!</h1>
              <p className="text-sm text-gray-500 mb-6">
                Мы свяжемся с вами по номеру <span className="font-medium text-gray-700">{phone}</span> для подтверждения.
              </p>
              <Link
                href="/catalog"
                className="inline-block px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Вернуться в каталог
              </Link>
            </div>
          ) : items.length === 0 ? (
            /* Empty cart state */
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h1 className="text-lg font-bold text-gray-700 mb-2">Корзина пуста</h1>
              <p className="text-sm text-gray-400 mb-6">Добавьте товары из каталога чтобы оформить заказ</p>
              <Link
                href="/catalog"
                className="inline-block px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left — Customer form */}
              <div>
                <h1 className="text-xl font-bold text-gray-800 mb-4">Оформление заказа</h1>
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ваше имя *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Иван Иванов"
                      required
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Номер телефона *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+7 777 000 00 00"
                      required
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Адрес доставки *</label>
                    <textarea
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="г. Алматы, ул. Абая 10, кв. 5"
                      required
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors placeholder:text-gray-300 resize-none"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Оформляем...
                      </>
                    ) : (
                      "Подтвердить заказ"
                    )}
                  </button>
                </form>
              </div>

              {/* Right — Cart summary */}
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Ваш заказ</h2>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <ul className="divide-y divide-gray-50">
                    {items.map(item => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden relative">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              className="object-contain p-1"
                              sizes="48px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">{item.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {(item.salePrice ?? item.price).toLocaleString()} ₸ × {item.qty}{item.packSize ? " уп" : ""}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-sky-600 flex-shrink-0">
                          {((item.salePrice ?? item.price) * item.qty).toLocaleString()} ₸
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Итого:</span>
                    <span className="text-xl font-bold text-gray-800">{totalPrice.toLocaleString()} ₸</span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-3 text-center">
                  После подтверждения мы свяжемся с вами для уточнения деталей доставки
                </p>
              </div>

            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
