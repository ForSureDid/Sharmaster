"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getOrdersByPhone } from "./actions";

type OrderItem = { id: number; name: string; qty: number; price: number | { toString(): string } };
type Order = {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  total: number | { toString(): string };
  status: string;
  createdAt: Date | string;
  items: OrderItem[];
};

const statusColor: Record<string, string> = {
  "Принят":         "bg-yellow-100 text-yellow-700",
  "Обрабатывается": "bg-sky-100 text-sky-700",
  "В пути":         "bg-blue-100 text-blue-700",
  "Доставлен":      "bg-green-100 text-green-700",
  "Отменён":        "bg-red-100 text-red-700",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (loading) return;
    if (!user?.phone) { setOrdersLoading(false); return; }
    getOrdersByPhone(user.phone)
      .then(data => setOrders(data as Order[]))
      .catch(err => console.error('Orders fetch error:', err))
      .finally(() => setOrdersLoading(false));
  }, [user, loading]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return null;

  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Profile card */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-6 flex flex-wrap items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-sky-400 flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-gray-800">{user.name}</h1>
              <p className="text-sm text-gray-400">{user.email}</p>
              {user.phone && <p className="text-sm text-gray-400">{user.phone}</p>}
            </div>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Выйти
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-sky-500">{orders.length}</p>
              <p className="text-xs text-gray-400 mt-1">Заказов</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 text-center">
              <p className="text-sm sm:text-xl font-extrabold text-pink-500 break-all leading-tight">{totalSpent.toLocaleString()} ₸</p>
              <p className="text-xs text-gray-400 mt-1">Сумма</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-green-500">
                {orders.filter(o => o.status === "Доставлен").length}
              </p>
              <p className="text-xs text-gray-400 mt-1">Выполнено</p>
            </div>
          </div>

          {/* Orders */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">История заказов</h2>
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-400">Заказов пока нет</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <div key={o.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-gray-700">Заказ #{o.id}</span>
                          <span className="text-xs text-gray-400">{formatDate(o.createdAt)}</span>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {o.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-1">{o.address}</p>
                        <ul className="space-y-0.5">
                          {o.items.map(item => (
                            <li key={item.id} className="text-xs text-gray-500">
                              {item.name} × {item.qty} — {(Number(item.price) * item.qty).toLocaleString()} ₸
                            </li>
                          ))}
                        </ul>
                      </div>
                        <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                        <p className="text-base font-bold text-gray-800">{Number(o.total).toLocaleString()} ₸</p>
                        <a
                          href={`/api/orders/${o.id}/excel?phone=${encodeURIComponent(user.phone ?? '')}`}
                          className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 font-medium transition-colors"
                          title="Скачать Excel"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Excel
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-50">
              <a href="/catalog" className="text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors">
                + Новый заказ →
              </a>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
