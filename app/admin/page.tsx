"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAdminStats, getAllOrders, updateOrderStatus } from "./actions";

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
  user: { name: string; email: string } | null;
};

type Stats = {
  totalOrders: number;
  pendingOrders: number;
  totalUsers: number;
  totalRevenue: number;
};

const ORDER_STATUSES = ["Принят", "Обрабатывается", "В пути", "Доставлен", "Отменён"];

const statusColor: Record<string, string> = {
  "Принят":         "bg-yellow-100 text-yellow-700",
  "Обрабатывается": "bg-sky-100 text-sky-700",
  "В пути":         "bg-blue-100 text-blue-700",
  "Доставлен":      "bg-green-100 text-green-700",
  "Отменён":        "bg-red-100 text-red-700",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Все");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push("/");
  }, [user, isAdmin, loading, router]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    Promise.all([getAdminStats(), getAllOrders()])
      .then(([s, o]) => {
        setStats(s);
        setOrders(o as Order[]);
      })
      .finally(() => setDataLoading(false));
  }, [loading, isAdmin]);

  function handleStatusChange(orderId: number, newStatus: string) {
    startTransition(async () => {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    });
  }

  if (loading || dataLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
    </div>
  );

  if (!user || !isAdmin) return null;

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "Все" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.customerName.toLowerCase().includes(q) ||
      o.phone.includes(q) ||
      String(o.id).includes(q) ||
      o.address.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800">Панель администратора</h1>
              <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
            </div>
            <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full">ADMIN</span>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-extrabold text-sky-500">{stats.totalOrders}</p>
                <p className="text-xs text-gray-400 mt-1">Всего заказов</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-extrabold text-yellow-500">{stats.pendingOrders}</p>
                <p className="text-xs text-gray-400 mt-1">Ожидают обработки</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-extrabold text-purple-500">{stats.totalUsers}</p>
                <p className="text-xs text-gray-400 mt-1">Пользователей</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className="text-lg font-extrabold text-green-500 leading-tight">
                  {stats.totalRevenue.toLocaleString()} ₸
                </p>
                <p className="text-xs text-gray-400 mt-1">Общая выручка</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
              <h2 className="font-bold text-gray-800 mr-auto">Заказы</h2>
              <input
                type="text"
                placeholder="Поиск по имени, телефону, ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300 w-56"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300"
              >
                <option>Все</option>
                {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                {orders.length === 0 ? "Заказов пока нет" : "Ничего не найдено"}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((o) => (
                  <div key={o.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-gray-700">#{o.id}</span>
                          <span className="text-xs text-gray-400">{formatDate(o.createdAt)}</span>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {o.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-700">
                          {o.customerName}
                          {o.user && (
                            <span className="text-xs text-gray-400 ml-2">({o.user.email})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{o.phone} · {o.address}</p>
                        <ul className="mt-1.5 space-y-0.5">
                          {o.items.map(item => (
                            <li key={item.id} className="text-xs text-gray-500">
                              {item.name} × {item.qty} — {(Number(item.price) * item.qty).toLocaleString()} ₸
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="text-base font-bold text-gray-800">{Number(o.total).toLocaleString()} ₸</p>
                        <select
                          value={o.status}
                          disabled={isPending}
                          onChange={e => handleStatusChange(o.id, e.target.value)}
                          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300 disabled:opacity-60 cursor-pointer"
                        >
                          {ORDER_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <a
                          href={`/api/orders/${o.id}/excel`}
                          className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 font-medium transition-colors"
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

            <div className="px-6 py-3 border-t border-gray-50 text-xs text-gray-400">
              Показано {filtered.length} из {orders.length} заказов
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
