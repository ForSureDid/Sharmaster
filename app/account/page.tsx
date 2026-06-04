"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const mockOrders = [
  { id: "#00124", date: "28 мая 2025", items: "Шары латексные 12\" × 100 шт", total: "1 500 ₸", status: "Доставлен" },
  { id: "#00118", date: "15 мая 2025", items: "Шар фольга «Звезда» × 10 шт", total: "3 500 ₸", status: "Доставлен" },
  { id: "#00109", date: "2 мая 2025", items: "Гелий 10л + Лента × 2 шт", total: "4 900 ₸", status: "Доставлен" },
];

const statusColor: Record<string, string> = {
  "Доставлен": "bg-green-100 text-green-700",
  "В пути": "bg-sky-100 text-sky-700",
  "Обрабатывается": "bg-yellow-100 text-yellow-700",
};

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="pt-[138px] min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Profile card */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-6 flex items-center gap-5">
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
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Заказов", value: "3", color: "text-sky-500" },
              { label: "Общая сумма", value: "9 900 ₸", color: "text-pink-500" },
              { label: "Бонусы", value: "99 ₸", color: "text-green-500" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Orders */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">История заказов</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {mockOrders.map((o) => (
                <div key={o.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-700">{o.id}</span>
                      <span className="text-xs text-gray-400">{o.date}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{o.items}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-gray-800">{o.total}</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-50">
              <a href="/" className="text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors">
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
