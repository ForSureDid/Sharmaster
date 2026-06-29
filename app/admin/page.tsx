"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getAdminStats,
  getAllOrders,
  updateOrderStatus,
  getStockItems,
  updateStockQty,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

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
type StockItem = {
  id: number;
  name: string;
  fullName: string | null;
  article: string | null;
  brand: string | null;
  stock: number;
  pricePerPc: number;
  imageUrl: string | null;
  onSale: boolean;
  salePercent: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES = ["Принят", "Обрабатывается", "В пути", "Доставлен", "Отменён"];

const STATUS_COLOR: Record<string, string> = {
  "Принят":         "bg-yellow-100 text-yellow-700",
  "Обрабатывается": "bg-sky-100 text-sky-700",
  "В пути":         "bg-blue-100 text-blue-700",
  "Доставлен":      "bg-green-100 text-green-700",
  "Отменён":        "bg-red-100 text-red-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function isToday(d: Date | string) {
  const t = new Date(d), n = new Date();
  return t.getDate() === n.getDate() && t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear();
}
function isThisWeek(d: Date | string) {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  return new Date(d) >= weekAgo;
}
function stockBadge(qty: number) {
  if (qty === 0) return { label: "Нет",  cls: "bg-red-100 text-red-600" };
  if (qty < 10)  return { label: "Мало", cls: "bg-orange-100 text-orange-600" };
  return             { label: "Есть", cls: "bg-green-100 text-green-600" };
}

// ─── Stock tab ────────────────────────────────────────────────────────────────

function StockTab() {
  const [search, setSearch]       = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [page, setPage]           = useState(0);
  const [data, setData]           = useState<{ items: StockItem[]; total: number } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVal, setEditVal]     = useState("");
  const [isPending, startTx]      = useTransition();
  const inputRef                  = useRef<HTMLInputElement>(null);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    getStockItems(debSearch, page).then(setData).finally(() => setLoading(false));
  }, [debSearch, page]);

  function startEdit(item: StockItem) {
    setEditingId(item.id);
    setEditVal(String(item.stock));
    setTimeout(() => inputRef.current?.select(), 30);
  }
  function saveEdit(id: number) {
    const qty = parseInt(editVal);
    if (isNaN(qty) || qty < 0) { setEditingId(null); return; }
    startTx(async () => {
      await updateStockQty(id, qty);
      setData(prev =>
        prev ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, stock: qty } : i) } : null
      );
      setEditingId(null);
    });
  }

  const outOfStock = data?.items.filter(i => i.stock === 0).length ?? 0;
  const lowStock   = data?.items.filter(i => i.stock > 0 && i.stock < 10).length ?? 0;

  return (
    <div>
      {/* Alerts */}
      {(outOfStock > 0 || lowStock > 0) && (
        <div className="flex flex-wrap gap-3 mb-4">
          {outOfStock > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              {outOfStock} позиций нет в наличии — нужно пополнить
            </div>
          )}
          {lowStock > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
              {lowStock} позиций заканчивается (меньше 10 шт)
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <h2 className="font-bold text-gray-800 mr-auto">Склад товаров</h2>
          <input
            type="text"
            placeholder="Название, бренд, артикул..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300 w-72"
          />
        </div>

        {/* Tip */}
        <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-600">
          Нажмите на число в колонке «Остаток», чтобы изменить количество. Подтвердите клавишей Enter.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Название</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Бренд</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Артикул</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Остаток</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Цена/шт</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data?.items.map(item => {
                    const badge    = stockBadge(item.stock);
                    const isEditing = editingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 transition-colors ${item.stock === 0 ? "bg-red-50/30" : ""}`}
                      >
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-800 leading-tight">{item.name}</div>
                          {item.fullName && item.fullName !== item.name && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{item.fullName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{item.brand ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{item.article ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              type="number"
                              min={0}
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={() => saveEdit(item.id)}
                              onKeyDown={e => {
                                if (e.key === "Enter")  saveEdit(item.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="w-20 text-center px-2 py-1 border-2 border-sky-400 rounded-lg focus:outline-none text-sm font-bold"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(item)}
                              disabled={isPending}
                              title="Нажмите, чтобы изменить"
                              className="px-3 py-1 rounded-lg text-sm font-bold text-gray-700 hover:bg-sky-50 hover:text-sky-700 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {item.stock}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
                          {item.pricePerPc.toLocaleString("ru-RU")} ₸
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data?.items.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-gray-400">Ничего не найдено</div>
            )}

            {/* Pagination */}
            {data && data.total > 50 && (
              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Показано {page * 50 + 1}–{Math.min((page + 1) * 50, data.total)} из {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    ← Назад
                  </button>
                  <button
                    disabled={(page + 1) * 50 >= data.total}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Вперёд →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Export tab ───────────────────────────────────────────────────────────────

function DownloadCard({
  title,
  description,
  period,
  href,
  color,
}: {
  title: string;
  description: string;
  period: string;
  href: string;
  color: "blue" | "green";
}) {
  const blue  = color === "blue";
  return (
    <div className={`flex flex-col gap-4 p-6 rounded-2xl border ${blue ? "border-sky-100 bg-sky-50/40" : "border-green-100 bg-green-50/40"}`}>
      <div>
        <h3 className="font-bold text-gray-800 text-base mb-1">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
      <div className={`text-xs font-medium px-2.5 py-1 rounded-full w-fit ${blue ? "bg-sky-100 text-sky-700" : "bg-green-100 text-green-700"}`}>
        {period}
      </div>
      <a
        href={href}
        download
        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 mt-auto ${blue ? "bg-sky-500" : "bg-green-600"}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Скачать .xlsx
      </a>
    </div>
  );
}

function ExportTab() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800">Экспорт данных</h2>
        <p className="text-sm text-gray-400 mt-0.5">Файлы формируются автоматически по актуальным данным из базы</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DownloadCard
          title="Продажи за неделю"
          description="Все проданные товары за последние 7 дней: артикул, название, количество штук и сумма по каждой позиции."
          period="Последние 7 дней"
          href="/api/admin/exports/sales?period=week"
          color="blue"
        />
        <DownloadCard
          title="Продажи за месяц"
          description="Все проданные товары за последние 30 дней: артикул, название, количество штук и сумма по каждой позиции."
          period="Последние 30 дней"
          href="/api/admin/exports/sales?period=month"
          color="blue"
        />
        <DownloadCard
          title="Оперативные остатки"
          description="Текущие остатки всех товаров на складе: артикул, название, бренд, количество и стоимость. Позиции без остатка выделены красным."
          period="Актуально на сейчас"
          href="/api/admin/exports/stock"
          color="green"
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats]           = useState<Stats | null>(null);
  const [orders, setOrders]         = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("Все");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("all");
  const [activeTab, setActiveTab]   = useState<"orders" | "stock" | "export">("orders");
  const [isPending, startTx]        = useTransition();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push("/");
  }, [user, isAdmin, loading, router]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    Promise.all([getAdminStats(), getAllOrders()])
      .then(([s, o]) => { setStats(s); setOrders(o as Order[]); })
      .finally(() => setDataLoading(false));
  }, [loading, isAdmin]);

  function handleStatusChange(orderId: number, newStatus: string) {
    startTx(async () => {
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

  // Client-side derived stats
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayOrders  = orders.filter(o => new Date(o.createdAt) >= todayStart);
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const pendingOrders = orders.filter(o => o.status === "Принят");

  // Filter orders for the list
  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "Все" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.customerName.toLowerCase().includes(q) ||
      o.phone.includes(q) ||
      String(o.id).includes(q) ||
      o.address.toLowerCase().includes(q);
    const matchDate =
      dateFilter === "all" ||
      (dateFilter === "today" && isToday(o.createdAt)) ||
      (dateFilter === "week" && isThisWeek(o.createdAt));
    return matchStatus && matchSearch && matchDate;
  });

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800">Панель управления</h1>
              <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
            </div>
            <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full uppercase tracking-wide">
              Администратор
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {/* Pending — most important */}
            <div className={`rounded-2xl border p-4 text-center ${pendingOrders.length > 0 ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-100"}`}>
              <p className={`text-3xl font-extrabold ${pendingOrders.length > 0 ? "text-yellow-500" : "text-gray-300"}`}>
                {pendingOrders.length}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Новых заказов</p>
              {pendingOrders.length > 0 && (
                <p className="text-xs text-yellow-600 mt-1">Ожидают обработки</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-3xl font-extrabold text-sky-500">{todayOrders.length}</p>
              <p className="text-xs text-gray-400 mt-1">Заказов сегодня</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-lg font-extrabold text-green-500 leading-tight">
                {todayRevenue.toLocaleString("ru-RU")} ₸
              </p>
              <p className="text-xs text-gray-400 mt-1">Выручка сегодня</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-lg font-extrabold text-purple-500 leading-tight">
                {stats ? stats.totalRevenue.toLocaleString("ru-RU") : "—"} ₸
              </p>
              <p className="text-xs text-gray-400 mt-1">Всего выручки</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 bg-white rounded-2xl border border-gray-100 p-1 w-fit">
            <button
              onClick={() => setActiveTab("orders")}
              className={`relative px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === "orders" ? "bg-sky-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Заказы
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-yellow-400 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("stock")}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === "stock" ? "bg-sky-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Склад
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === "export" ? "bg-sky-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Экспорт
            </button>
          </div>

          {/* ─── Orders tab ─── */}
          {activeTab === "orders" && (
            <div>
              {/* Urgent alert */}
              {pendingOrders.length > 0 && (
                <div className="mb-4 flex items-center gap-3 px-5 py-3.5 bg-yellow-50 border border-yellow-200 rounded-2xl">
                  <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
                  <p className="text-sm text-yellow-800 font-medium">
                    {pendingOrders.length === 1
                      ? `1 заказ ожидает обработки`
                      : `${pendingOrders.length} заказов ожидают обработки`}
                    {" — "}
                    <button
                      onClick={() => setStatusFilter("Принят")}
                      className="underline font-semibold hover:text-yellow-900"
                    >
                      показать
                    </button>
                  </p>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                {/* Filters */}
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
                  <h2 className="font-bold text-gray-800 mr-auto">Заказы</h2>
                  <input
                    type="text"
                    placeholder="Имя, телефон, ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300 w-48"
                  />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300"
                  >
                    <option value="Все">Все статусы</option>
                    {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {([ ["all", "Все"], ["today", "Сегодня"], ["week", "Неделя"] ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setDateFilter(val)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                          dateFilter === val ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-gray-400">
                    {orders.length === 0 ? "Заказов пока нет" : "Ничего не найдено"}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map(o => (
                      <div
                        key={o.id}
                        className={`px-6 py-4 ${o.status === "Принят" ? "bg-yellow-50/40" : ""}`}
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-sm font-bold text-gray-700">#{o.id}</span>
                              <span className="text-xs text-gray-400">
                                {fmtDate(o.createdAt)}, {fmtTime(o.createdAt)}
                              </span>
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {o.status}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-700">
                              {o.customerName}
                              {o.user && (
                                <span className="text-xs text-gray-400 font-normal ml-2">({o.user.email})</span>
                              )}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-0.5">
                              <a
                                href={`tel:${o.phone}`}
                                className="text-xs text-sky-600 font-semibold hover:text-sky-800 transition-colors underline underline-offset-2"
                              >
                                {o.phone}
                              </a>
                              <span className="text-xs text-gray-400">{o.address}</span>
                            </div>
                            <ul className="mt-2 space-y-0.5">
                              {o.items.map(item => (
                                <li key={item.id} className="text-xs text-gray-500">
                                  {item.name} × {item.qty} — {(Number(item.price) * item.qty).toLocaleString("ru-RU")} ₸
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <p className="text-base font-bold text-gray-800">{Number(o.total).toLocaleString("ru-RU")} ₸</p>
                            <div className="flex flex-col items-end gap-1">
                              <label className="text-xs text-gray-400">Изменить статус:</label>
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
                            </div>
                            <a
                              href={`/api/orders/${o.id}/excel`}
                              className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 font-medium transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Скачать Excel
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
          )}

          {/* ─── Stock tab ─── */}
          {activeTab === "stock" && <StockTab />}

          {/* ─── Export tab ─── */}
          {activeTab === "export" && <ExportTab />}

        </div>
      </main>
      <Footer />
    </>
  );
}
