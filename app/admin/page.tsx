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
  releaseStockOverride,
  updateManualPrice,
  releasePriceOverride,
  updateSizeInches,
  getSaleItems,
  updateSaleStatus,
  searchAllItems,
  getNewArrivals,
  toggleNewArrival,
  setNewArrivalPending,
  searchStockForNovinka,
  getAdminMeta,
  createStockItem,
  bulkCreateItems,
  getSyncStatus,
  getOnecCategoryTree,
  getOnecItemsByCategory,
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
  article: string | null;
  brand: string | null;
  sizeInches: string | null;
  stock: number;
  pricePerPc: number;
  imageUrl: string | null;
  onSale: boolean;
  salePercent: number | null;
  stockOverride: boolean;
  priceOverride: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES = ["Принят", "Обрабатывается", "В пути", "Отгружен", "Отменён"];

const STATUS_COLOR: Record<string, string> = {
  "Принят":         "bg-yellow-100 text-yellow-700",
  "Обрабатывается": "bg-sky-100 text-sky-700",
  "В пути":         "bg-blue-100 text-blue-700",
  "Отгружен":       "bg-green-100 text-green-700",
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
  const [priceEditingId, setPriceEditingId] = useState<number | null>(null);
  const [priceEditVal, setPriceEditVal]     = useState("");
  const [sizeEditingId, setSizeEditingId] = useState<number | null>(null);
  const [sizeEditVal, setSizeEditVal]     = useState("");
  const [isPending, startTx]      = useTransition();
  const inputRef                  = useRef<HTMLInputElement>(null);
  const priceInputRef             = useRef<HTMLInputElement>(null);
  const sizeInputRef              = useRef<HTMLInputElement>(null);

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
    setSizeEditingId(null);
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
        prev ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, stock: qty, stockOverride: true } : i) } : null
      );
      setEditingId(null);
    });
  }
  function releaseStock(id: number) {
    startTx(async () => {
      await releaseStockOverride(id);
      setData(prev =>
        prev ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, stockOverride: false } : i) } : null
      );
    });
  }

  function startPriceEdit(item: StockItem) {
    setSizeEditingId(null);
    setEditingId(null);
    setPriceEditingId(item.id);
    setPriceEditVal(String(item.pricePerPc));
    setTimeout(() => priceInputRef.current?.select(), 30);
  }
  function savePriceEdit(id: number) {
    const price = parseFloat(priceEditVal);
    if (isNaN(price) || price < 0) { setPriceEditingId(null); return; }
    startTx(async () => {
      await updateManualPrice(id, price);
      setData(prev =>
        prev ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pricePerPc: price, priceOverride: true } : i) } : null
      );
      setPriceEditingId(null);
    });
  }
  function releasePrice(id: number) {
    startTx(async () => {
      await releasePriceOverride(id);
      setData(prev =>
        prev ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, priceOverride: false } : i) } : null
      );
    });
  }

  function startSizeEdit(item: StockItem) {
    setEditingId(null);
    setSizeEditingId(item.id);
    setSizeEditVal(item.sizeInches ?? "");
    setTimeout(() => sizeInputRef.current?.select(), 30);
  }
  function saveSizeEdit(id: number) {
    startTx(async () => {
      const val = sizeEditVal.trim() || null;
      await updateSizeInches(id, val);
      setData(prev =>
        prev ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, sizeInches: val } : i) } : null
      );
      setSizeEditingId(null);
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
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <h2 className="font-bold text-gray-800 mr-auto">Склад товаров</h2>
          <input
            type="text"
            placeholder="Название, бренд, артикул..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300 w-full sm:w-72"
          />
        </div>

        {/* Tip */}
        <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-600">
          Нажмите на значение в колонке «Остаток», «Цена» или «Размер», чтобы изменить. Подтвердите клавишей Enter.
          Изменённые вручную остаток/цена помечаются 🔒 и больше не перезаписываются синхронизацией с 1С — нажмите на замок, чтобы вернуть управление 1С.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-px">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Название</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Бренд</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Размер</th>
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
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{item.brand ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {sizeEditingId === item.id ? (
                            <input
                              ref={sizeInputRef}
                              type="text"
                              value={sizeEditVal}
                              onChange={e => setSizeEditVal(e.target.value)}
                              onBlur={() => saveSizeEdit(item.id)}
                              onKeyDown={e => {
                                if (e.key === "Enter")  saveSizeEdit(item.id);
                                if (e.key === "Escape") setSizeEditingId(null);
                              }}
                              placeholder="12, 18, 2/5..."
                              className="w-20 text-center px-2 py-1 border-2 border-sky-400 rounded-lg focus:outline-none text-sm font-bold"
                            />
                          ) : (
                            <button
                              onClick={() => startSizeEdit(item)}
                              disabled={isPending}
                              title="Нажмите, чтобы изменить размер"
                              className="px-2.5 py-1 rounded-lg text-sm font-medium text-gray-700 hover:bg-sky-50 hover:text-sky-700 transition-colors disabled:opacity-50 cursor-pointer min-w-[2.5rem]"
                            >
                              {item.sizeInches ?? <span className="text-gray-300">—</span>}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{item.article ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
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
                            {item.stockOverride && (
                              <button
                                onClick={() => releaseStock(item.id)}
                                disabled={isPending}
                                title="Остаток задан вручную — нажмите, чтобы вернуть управление 1С"
                                className="text-xs disabled:opacity-50"
                              >
                                🔒
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {item.priceOverride && (
                              <button
                                onClick={() => releasePrice(item.id)}
                                disabled={isPending}
                                title="Цена задана вручную — нажмите, чтобы вернуть управление 1С"
                                className="text-xs disabled:opacity-50"
                              >
                                🔒
                              </button>
                            )}
                            {priceEditingId === item.id ? (
                              <input
                                ref={priceInputRef}
                                type="number"
                                min={0}
                                step="0.01"
                                value={priceEditVal}
                                onChange={e => setPriceEditVal(e.target.value)}
                                onBlur={() => savePriceEdit(item.id)}
                                onKeyDown={e => {
                                  if (e.key === "Enter")  savePriceEdit(item.id);
                                  if (e.key === "Escape") setPriceEditingId(null);
                                }}
                                className="w-24 text-right px-2 py-1 border-2 border-sky-400 rounded-lg focus:outline-none text-sm font-bold"
                              />
                            ) : (
                              <button
                                onClick={() => startPriceEdit(item)}
                                disabled={isPending}
                                title="Нажмите, чтобы изменить"
                                className="px-2 py-1 rounded-lg hover:bg-sky-50 hover:text-sky-700 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {item.pricePerPc.toLocaleString("ru-RU")} ₸
                              </button>
                            )}
                          </div>
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

// ─── Sale tab ─────────────────────────────────────────────────────────────────

type SaleItem = {
  id: number; name: string; article: string | null; brand: string | null;
  stock: number; pricePerPc: number; imageUrl: string | null;
  onSale: boolean; salePercent: number | null;
};
type SearchResult = {
  id: number; name: string; article: string | null; brand: string | null;
  pricePerPc: number; onSale: boolean; salePercent: number | null;
};

function SaleTab() {
  const [search, setSearch]         = useState("");
  const [debSearch, setDebSearch]   = useState("");
  const [page, setPage]             = useState(0);
  const [data, setData]             = useState<{ items: SaleItem[]; total: number } | null>(null);
  const [loading, setLoading]       = useState(true);

  // Inline percent edit
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editVal, setEditVal]       = useState("");
  const editRef                     = useRef<HTMLInputElement>(null);
  const [isPending, startTx]        = useTransition();

  // "Add to sale" panel
  const [addOpen, setAddOpen]       = useState(false);
  const [addQuery, setAddQuery]     = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [addBusy, setAddBusy]       = useState(false);
  const [addDiscounts, setAddDiscounts] = useState<Record<number, string>>({});

  // Debounce main search
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load sale items
  useEffect(() => {
    setLoading(true);
    getSaleItems(debSearch, page).then(setData).finally(() => setLoading(false));
  }, [debSearch, page]);

  // Debounce add-search
  useEffect(() => {
    if (!addQuery.trim()) { setAddResults([]); return; }
    setAddBusy(true);
    const t = setTimeout(async () => {
      const r = await searchAllItems(addQuery);
      setAddResults(r as SearchResult[]);
      setAddBusy(false);
    }, 350);
    return () => clearTimeout(t);
  }, [addQuery]);

  function reload() {
    setLoading(true);
    getSaleItems(debSearch, page).then(setData).finally(() => setLoading(false));
  }

  function startEdit(item: SaleItem) {
    setEditingId(item.id);
    setEditVal(String(item.salePercent ?? ""));
    setTimeout(() => editRef.current?.select(), 30);
  }

  function saveEdit(id: number) {
    const pct = parseInt(editVal);
    if (isNaN(pct) || pct < 1 || pct > 99) { setEditingId(null); return; }
    startTx(async () => {
      await updateSaleStatus(id, true, pct);
      setData(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === id ? { ...i, salePercent: pct } : i),
      } : null);
      setEditingId(null);
    });
  }

  function removeFromSale(id: number) {
    startTx(async () => {
      await updateSaleStatus(id, false, null);
      setData(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== id),
        total: prev.total - 1,
      } : null);
    });
  }

  function addToSale(item: SearchResult) {
    const pct = parseInt(addDiscounts[item.id] ?? "10");
    if (isNaN(pct) || pct < 1 || pct > 99) return;
    startTx(async () => {
      await updateSaleStatus(item.id, true, pct);
      setAddResults(prev => prev.filter(r => r.id !== item.id));
      reload();
    });
  }

  const salePrice = (price: number, pct: number | null) =>
    pct ? Math.round(price * (1 - pct / 100)) : price;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Управление акциями</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {data ? `${data.total} товаров на акции` : "Загружаем..."}
          </p>
        </div>
        <button
          onClick={() => { setAddOpen(o => !o); setAddQuery(""); setAddResults([]); }}
          className="ml-auto px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-xl hover:bg-purple-600 transition-colors"
        >
          {addOpen ? "Закрыть" : "+ Добавить в акцию"}
        </button>
      </div>

      {/* Add-to-sale panel */}
      {addOpen && (
        <div className="bg-white rounded-3xl border border-purple-100 p-5 mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Найти товар и поставить на акцию</p>
          <input
            value={addQuery}
            onChange={e => setAddQuery(e.target.value)}
            placeholder="Поиск по названию, артикулу, бренду..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 mb-3"
            autoFocus
          />
          {addBusy && <p className="text-xs text-gray-400 mb-2">Ищем...</p>}
          {addResults.length > 0 && (
            <div className="divide-y divide-gray-50">
              {addResults.map(item => (
                <div key={item.id} className="py-2.5 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {item.article ? `Арт. ${item.article} · ` : ""}{item.pricePerPc.toLocaleString("ru-RU")} ₸
                      {item.onSale && <span className="ml-2 text-purple-600 font-medium">Уже на акции ({item.salePercent}%)</span>}
                    </p>
                  </div>
                  {!item.onSale && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          placeholder="10"
                          value={addDiscounts[item.id] ?? ""}
                          onChange={e => setAddDiscounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-16 text-center px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      <button
                        onClick={() => addToSale(item)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-purple-500 text-white text-xs font-semibold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                      >
                        Добавить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!addBusy && addQuery.trim() && addResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">Ничего не найдено</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск в акциях..."
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 w-full sm:w-64"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100 text-xs text-purple-700 font-medium">
          Нажмите на скидку % чтобы изменить · Нажмите × чтобы снять с акции
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {search ? "Ничего не найдено" : "Нет товаров на акции — добавьте через кнопку выше"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[580px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Название</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Артикул</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Цена</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Скидка</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Со скидкой</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Остаток</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.items.map(item => {
                    const sp = salePrice(item.pricePerPc, item.salePercent);
                    return (
                      <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-800 truncate max-w-[200px]">{item.name}</p>
                          {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.article ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                          {item.pricePerPc.toLocaleString("ru-RU")} ₸
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingId === item.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                ref={editRef}
                                type="number"
                                min="1"
                                max="99"
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                                onBlur={() => saveEdit(item.id)}
                                className="w-14 text-center px-1 py-0.5 border-2 border-purple-400 rounded-lg focus:outline-none text-sm font-bold"
                              />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(item)}
                              disabled={isPending}
                              className="px-2.5 py-1 rounded-lg text-sm font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors cursor-pointer"
                            >
                              {item.salePercent ?? "—"}%
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-700 whitespace-nowrap">
                          {sp.toLocaleString("ru-RU")} ₸
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.stock === 0 ? "bg-red-100 text-red-600" :
                            item.stock < 10  ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"
                          }`}>{item.stock} шт</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeFromSale(item.id)}
                            disabled={isPending}
                            title="Снять с акции"
                            className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors text-sm font-bold flex items-center justify-center disabled:opacity-40"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total > 50 && (
              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Показано {Math.min((page + 1) * 50, data.total)} из {data.total}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    ← Назад
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 50 >= data.total}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
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
  color: "blue" | "green" | "purple";
}) {
  const styles = {
    blue:   { wrap: "border-sky-100 bg-sky-50/40",     badge: "bg-sky-100 text-sky-700",     btn: "bg-sky-500"   },
    green:  { wrap: "border-green-100 bg-green-50/40", badge: "bg-green-100 text-green-700", btn: "bg-green-600" },
    purple: { wrap: "border-purple-100 bg-purple-50/40", badge: "bg-purple-100 text-purple-700", btn: "bg-purple-600" },
  }[color];
  return (
    <div className={`flex flex-col gap-4 p-6 rounded-2xl border ${styles.wrap}`}>
      <div>
        <h3 className="font-bold text-gray-800 text-base mb-1">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
      <div className={`text-xs font-medium px-2.5 py-1 rounded-full w-fit ${styles.badge}`}>
        {period}
      </div>
      <a
        href={href}
        download
        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 mt-auto ${styles.btn}`}
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
    <div className="space-y-8">
      {/* Sales reports */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">Продажи</h2>
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

      {/* Sale (акции) reports */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">Акции</h2>
          <p className="text-sm text-gray-400 mt-0.5">Продажи товаров со скидкой — сколько продано и выручка за период</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DownloadCard
            title="Акции за неделю"
            description="Товары на акции: скидка %, цена до/после, сколько продано и выручка за последние 7 дней."
            period="Последние 7 дней"
            href="/api/admin/exports/sale?period=week"
            color="purple"
          />
          <DownloadCard
            title="Акции за месяц"
            description="Товары на акции: скидка %, цена до/после, сколько продано и выручка за последние 30 дней."
            period="Последние 30 дней"
            href="/api/admin/exports/sale?period=month"
            color="purple"
          />
          <DownloadCard
            title="Акции за всё время"
            description="Все продажи акционных товаров за всё время работы магазина — полная история."
            period="Всё время"
            href="/api/admin/exports/sale?period=all"
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}

// ─── New item tab ─────────────────────────────────────────────────────────────

type MetaData = { categories: { id: number; name: string; parentId: number | null; level: number }[]; brands: string[] };

type FlatCat = { id: number; name: string; depth: number };

function buildFlatCategories(cats: MetaData["categories"]): FlatCat[] {
  const flat: FlatCat[] = [];
  function add(parentId: number | null, depth: number) {
    cats.filter(c => c.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .forEach(c => { flat.push({ id: c.id, name: c.name, depth }); add(c.id, depth + 1); });
  }
  add(null, 0);
  return flat;
}

const EMPTY_FORM = {
  name: "", article: "", barcode: "",
  brand: "", sizeInches: "", stock: "0", pricePerPc: "",
  categoryId: "", onSale: false, salePercent: "",
};

function ImageUploadZone({
  label, url, uploading, onFile, onRemove, multi = false,
}: {
  label: string; url?: string; uploading?: boolean;
  onFile: (f: File) => void; onRemove?: () => void; multi?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className={`relative flex items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden
          ${drag ? "border-sky-400 bg-sky-50" : "border-gray-200 hover:border-sky-300 hover:bg-sky-50/30"}
          ${url ? "h-40" : "h-32"}`}
      >
        <input ref={ref} type="file" accept="image/*" multiple={multi} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-3 border-sky-400 border-t-transparent animate-spin" />
            <p className="text-xs text-sky-600">Загружаем...</p>
          </div>
        ) : url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-contain" />
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); onRemove(); }}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">
                ×
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">Перетащите или нажмите</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NewItemTab() {
  const [form, setForm]       = useState({ ...EMPTY_FORM });
  const [meta, setMeta]       = useState<MetaData | null>(null);
  const [mainImg, setMainImg] = useState<string>("");
  const [mainUploading, setMainUploading] = useState(false);
  const [extraImgs, setExtraImgs]         = useState<string[]>([]);
  const [extraUploading, setExtraUploading] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState<{ id: number; name: string } | null>(null);

  useEffect(() => { getAdminMeta().then(setMeta); }, []);

  function set(k: keyof typeof EMPTY_FORM, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/items/upload-image", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Ошибка загрузки"); return null; }
    return data.url as string;
  }

  async function handleMainImg(file: File) {
    setMainUploading(true); setError(null);
    const url = await uploadImage(file);
    if (url) setMainImg(url);
    setMainUploading(false);
  }

  async function handleExtraImg(file: File) {
    setExtraUploading(true); setError(null);
    const url = await uploadImage(file);
    if (url) setExtraImgs(prev => [...prev, url]);
    setExtraUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const price = parseFloat(form.pricePerPc.replace(",", "."));
    const stock = parseInt(form.stock);
    if (!form.name.trim()) { setError("Название обязательно"); return; }
    if (isNaN(price) || price < 0) { setError("Укажите корректную цену"); return; }
    setSubmitting(true);
    try {
      const result = await createStockItem({
        name:       form.name,
        article:    form.article    || undefined,
        barcode:    form.barcode    || undefined,
        brand:      form.brand      || undefined,
        sizeInches: form.sizeInches || undefined,
        stock:      isNaN(stock) ? 0 : stock,
        pricePerPc: price,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
        onSale:     form.onSale,
        salePercent: form.onSale && form.salePercent ? parseInt(form.salePercent) : null,
        imageUrl:   mainImg  || undefined,
        images:     extraImgs,
      });
      setDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания товара");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setMainImg(""); setExtraImgs([]);
    setError(null); setDone(null);
  }

  const flatCats = meta ? buildFlatCategories(meta.categories) : [];

  if (done) return (
    <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-md">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="font-bold text-gray-800">Товар создан</h2>
          <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{done.name}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={resetForm}
          className="flex-1 px-4 py-2.5 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors">
          Добавить ещё
        </button>
        <a href="/catalog" target="_blank"
          className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors text-center">
          Открыть каталог
        </a>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800">Новый товар</h2>
        <p className="text-sm text-gray-400 mt-0.5">Заполните карточку — товар сразу появится на сайте</p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* ── Основная информация ── */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-4 space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Основная информация</p>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Название <span className="text-red-400">*</span></label>
          <input value={form.name} onChange={e => set("name", e.target.value)} required
            placeholder="Например: Шар 12'' Красный пастель"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Артикул</label>
            <input value={form.article} onChange={e => set("article", e.target.value)}
              placeholder="1234-5678"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Штрихкод</label>
            <input value={form.barcode} onChange={e => set("barcode", e.target.value)}
              placeholder="4601234567890"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Бренд</label>
            <input value={form.brand} onChange={e => set("brand", e.target.value)}
              list="brands-list" placeholder="Belbal, Sempertex..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
            <datalist id="brands-list">
              {meta?.brands.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Размер (дюймы)</label>
            <input value={form.sizeInches} onChange={e => set("sizeInches", e.target.value)}
              placeholder='5", 10", 12"...'
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Категория</label>
          <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400 bg-white">
            <option value="">— Без категории —</option>
            {flatCats.map(c => (
              <option key={c.id} value={c.id}>
                {"— ".repeat(c.depth)}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Цена и остаток ── */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-4 space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Цена и остаток</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Цена за штуку, ₸ <span className="text-red-400">*</span></label>
            <input value={form.pricePerPc} onChange={e => set("pricePerPc", e.target.value)} required
              type="number" min="0" step="0.01" placeholder="0"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Остаток на складе, шт</label>
            <input value={form.stock} onChange={e => set("stock", e.target.value)}
              type="number" min="0" step="1" placeholder="0"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={() => set("onSale", !form.onSale)}
            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${form.onSale ? "bg-sky-500" : "bg-gray-200"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.onSale ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-sm text-gray-700 font-medium">Акционный товар</span>
        </div>

        {form.onSale && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Скидка, %</label>
            <input value={form.salePercent} onChange={e => set("salePercent", e.target.value)}
              type="number" min="1" max="99" placeholder="10"
              className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-400" />
          </div>
        )}
      </div>

      {/* ── Фотографии ── */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-6 space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Фотографии</p>

        <ImageUploadZone
          label="Главное фото"
          url={mainImg}
          uploading={mainUploading}
          onFile={handleMainImg}
          onRemove={() => setMainImg("")}
        />

        {/* Additional images */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Дополнительные фото</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {extraImgs.map((url, i) => (
              <div key={url} className="relative h-24 rounded-xl overflow-hidden border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setExtraImgs(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">
                  ×
                </button>
              </div>
            ))}
            {extraImgs.length < 8 && (
              <ImageUploadZone
                label=""
                uploading={extraUploading}
                onFile={handleExtraImg}
              />
            )}
          </div>
          {extraImgs.length === 0 && !extraUploading && (
            <p className="text-xs text-gray-400 mt-1">Можно добавить до 8 дополнительных фото</p>
          )}
        </div>
      </div>

      {/* ── Submit ── */}
      <button type="submit" disabled={submitting}
        className="w-full py-3 bg-sky-500 text-white text-sm font-bold rounded-2xl hover:bg-sky-600 transition-colors disabled:opacity-60 shadow-sm">
        {submitting ? "Создаём товар..." : "Создать товар"}
      </button>
    </form>
  );
}

// ─── Bulk item import (right panel of "+ Товар" tab) ──────────────────────────

type BulkRow = {
  article: string; name: string; fullName: string; barcode: string
  brand: string; sizeInches: string; stock: number | null; price: number | null
  existingId: number | null; existingStock: number | null; willCreate: boolean
}
type BulkStats = { total: number; willCreate: number; conflicts: number }
type BulkPhase = "idle" | "uploading" | "preview" | "applying" | "done"
type BulkDone  = { created: number; skipped: number; errors: string[] }

function BulkItemImport() {
  const [phase, setPhase]       = useState<BulkPhase>("idle")
  const [rows,  setRows]        = useState<BulkRow[]>([])
  const [stats, setStats]       = useState<BulkStats | null>(null)
  const [done,  setDone]        = useState<BulkDone  | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setPhase("uploading"); setError(null)
    const fd = new FormData(); fd.append("file", file)
    const res = await fetch("/api/admin/items/bulk-preview", { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Ошибка парсинга"); setPhase("idle"); return }
    setRows(data.rows); setStats(data.stats); setPhase("preview")
  }

  async function handleApply() {
    setPhase("applying"); setError(null)
    const toCreate = rows.filter(r => r.willCreate)
    try {
      const result = await bulkCreateItems(toCreate)
      setDone(result); setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания"); setPhase("preview")
    }
  }

  function reset() { setPhase("idle"); setRows([]); setStats(null); setDone(null); setError(null) }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 h-fit sticky top-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-gray-800">Массовый импорт</h2>
          <p className="text-xs text-gray-400 mt-0.5">Загрузить Excel со списком новых товаров</p>
        </div>
        {phase !== "idle" && (
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">сбросить</button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
      )}

      {/* ── Idle ── */}
      {phase === "idle" && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className="flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50/30 cursor-pointer transition-colors"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">Перетащите .xlsx или нажмите</p>
            <p className="text-xs text-gray-400 mt-1">Файл из 1С или любой Excel</p>
          </div>

          {/* 1C reminder */}
          <div className="mt-4 px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Ожидаем образец файла 1С</p>
            <p className="text-xs text-amber-600">
              Пришлите файл экспорта из 1С — настроим точное распознавание колонок под ваш формат.
              Пока работает авто-определение (Наименование, Артикул, Количество, Цена).
            </p>
          </div>

          {/* Expected columns hint */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Ожидаемые колонки</p>
            <div className="flex flex-wrap gap-1.5">
              {["Наименование*", "Артикул", "Количество", "Цена", "Бренд", "Размер", "Штрихкод"].map(col => (
                <span key={col} className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  col.endsWith("*") ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-500"
                }`}>{col}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Uploading ── */}
      {phase === "uploading" && (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-[3px] border-sky-400 border-t-transparent animate-spin" />
          <p className="text-sm text-sky-600 font-medium">Анализируем файл...</p>
        </div>
      )}

      {/* ── Preview ── */}
      {phase === "preview" && stats && (
        <div>
          {/* Stats chips */}
          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-xl">
              {stats.willCreate} новых
            </span>
            {stats.conflicts > 0 && (
              <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-xl">
                {stats.conflicts} конфликт{stats.conflicts === 1 ? "" : "ов"}
              </span>
            )}
            <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl">
              {stats.total} всего
            </span>
          </div>

          {/* Preview table */}
          <div className="overflow-y-auto max-h-64 rounded-2xl border border-gray-100 mb-4">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Название</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Арт.</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">Кол.</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">Цена</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 last:border-0 ${
                    r.willCreate ? "" : "bg-amber-50/60"
                  }`}>
                    <td className="px-3 py-2 max-w-[160px] truncate font-medium text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-400">{r.article || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.stock ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.price != null ? `${r.price}₸` : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {r.willCreate ? (
                        <span className="text-green-600 font-bold">+</span>
                      ) : (
                        <span className="text-amber-500 font-bold" title={`Уже есть (ID ${r.existingId})`}>!</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats.conflicts > 0 && (
            <p className="text-xs text-amber-600 mb-3">
              <span className="font-bold">!</span> {stats.conflicts} товар{stats.conflicts === 1 ? "" : "а"} уже есть в базе — будут пропущены
            </p>
          )}

          {stats.willCreate === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">Все товары уже существуют в базе</p>
          ) : (
            <button onClick={handleApply}
              className="w-full py-2.5 bg-sky-500 text-white text-sm font-bold rounded-2xl hover:bg-sky-600 transition-colors shadow-sm">
              Создать {stats.willCreate} товар{stats.willCreate === 1 ? "" : stats.willCreate < 5 ? "а" : "ов"}
            </button>
          )}
        </div>
      )}

      {/* ── Applying ── */}
      {phase === "applying" && (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-[3px] border-sky-400 border-t-transparent animate-spin" />
          <p className="text-sm text-sky-600 font-medium">Создаём товары...</p>
        </div>
      )}

      {/* ── Done ── */}
      {phase === "done" && done && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-800">Готово</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Создано: {done.created} · Пропущено: {done.skipped}
                {done.errors.length > 0 ? ` · Ошибок: ${done.errors.length}` : ""}
              </p>
            </div>
          </div>
          {done.errors.length > 0 && (
            <div className="mb-4 px-3 py-2 bg-red-50 rounded-xl text-xs text-red-600">
              <p className="font-semibold mb-1">Не удалось создать:</p>
              {done.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
              {done.errors.length > 5 && <p>...ещё {done.errors.length - 5}</p>}
            </div>
          )}
          <button onClick={reset}
            className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-2xl hover:bg-gray-200 transition-colors">
            Загрузить ещё файл
          </button>
        </div>
      )}
    </div>
  )
}

// ─── New arrivals tab ─────────────────────────────────────────────────────────

type NewArrivalItem = {
  id: number; name: string; article: string | null; brand: string | null;
  stock: number; pricePerPc: number; imageUrl: string | null;
  isNew: boolean; isNewPending: boolean; createdAt: Date | string;
};

function NewArrivalsTab() {
  const [siteItems, setSiteItems]       = useState<NewArrivalItem[]>([]);
  const [siteTotal, setSiteTotal]       = useState(0);
  const [sitePage, setSitePage]         = useState(0);
  const [siteSearch, setSiteSearch]     = useState("");
  const [siteDebSearch, setSiteDebSearch] = useState("");
  const [siteLoading, setSiteLoading]   = useState(true);

  const [isPending, startTx]            = useTransition();
  const [confirmPending, setConfirmPending] = useState<{ id: number; action: "new" | "pending" } | null>(null);

  // Add-any-item search
  type SearchResult = { id: number; name: string; article: string | null; brand: string | null; stock: number; pricePerPc: number };
  const [addSearch, setAddSearch]       = useState("");
  const [addResults, setAddResults]     = useState<SearchResult[]>([]);
  const [addLoading, setAddLoading]     = useState(false);
  const [addConfirm, setAddConfirm]     = useState<{ item: SearchResult; action: "new" | "pending" } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSiteDebSearch(siteSearch); setSitePage(0); }, 400);
    return () => clearTimeout(t);
  }, [siteSearch]);

  // Load site новинки
  useEffect(() => {
    setSiteLoading(true);
    getNewArrivals(siteDebSearch, sitePage)
      .then(r => { setSiteItems(r.items as NewArrivalItem[]); setSiteTotal(r.total); })
      .finally(() => setSiteLoading(false));
  }, [siteDebSearch, sitePage]);

  function handleActivateNew(item: NewArrivalItem) {
    startTx(async () => {
      await toggleNewArrival(item.id, true);
      setSiteItems(prev => prev.map(i => i.id === item.id ? { ...i, isNew: true, isNewPending: false } : i));
      setConfirmPending(null);
    });
  }

  function handleSetPending(item: NewArrivalItem) {
    startTx(async () => {
      await setNewArrivalPending(item.id, true);
      setSiteItems(prev => prev.map(i => i.id === item.id ? { ...i, isNewPending: true, isNew: false } : i));
      setConfirmPending(null);
    });
  }

  function handleRemoveFromSite(item: NewArrivalItem) {
    startTx(async () => {
      await toggleNewArrival(item.id, false);
      setSiteItems(prev => prev.filter(i => i.id !== item.id));
      setSiteTotal(t => t - 1);
    });
  }

  function confirmAction(item: NewArrivalItem) {
    if (!confirmPending || confirmPending.id !== item.id) return;
    if (confirmPending.action === "new") handleActivateNew(item);
    else handleSetPending(item);
  }

  // Debounced search for add-any-item
  useEffect(() => {
    if (!addSearch.trim()) { setAddResults([]); return; }
    const t = setTimeout(() => {
      setAddLoading(true);
      searchStockForNovinka(addSearch)
        .then(setAddResults)
        .finally(() => setAddLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [addSearch]);

  function handleAddConfirm() {
    if (!addConfirm) return;
    startTx(async () => {
      if (addConfirm.action === "new") {
        await toggleNewArrival(addConfirm.item.id, true);
      } else {
        await setNewArrivalPending(addConfirm.item.id, true);
      }
      // Refresh the site items list
      getNewArrivals(siteDebSearch, sitePage)
        .then(r => { setSiteItems(r.items as NewArrivalItem[]); setSiteTotal(r.total); });
      setAddSearch("");
      setAddResults([]);
      setAddConfirm(null);
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-800">Новинки</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Товары, показанные на сайте как новинки. Новые пре-заказы из donballon.ru приходят сюда автоматически
          (ежедневная синхронизация) со статусом «Ожидайте» — 1С сама переводит их в обычный товар, когда приходит поставка.
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <p className="font-semibold text-green-800 text-sm">Новинки на сайте</p>
            <p className="text-xs text-green-600 mt-0.5">{siteTotal} товаров · <span className="font-medium">New</span> = активные · <span className="font-medium">Ожидайте</span> = предварительные</p>
          </div>

          {/* Add any item section */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Добавить любой товар</p>
            <div className="relative">
              <input
                value={addSearch}
                onChange={e => { setAddSearch(e.target.value); setAddConfirm(null); }}
                placeholder="Название, бренд, артикул..."
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 bg-white"
              />
              {addLoading && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              )}
            </div>
            {addSearch.trim() && addResults.length > 0 && (
              <div className="mt-1.5 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {addResults.map(r => (
                  <div key={r.id} className="px-3 py-2 border-b border-gray-50 last:border-0">
                    {addConfirm?.item.id === r.id ? (
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-gray-600 truncate">
                          {addConfirm.action === "new" ? "Добавить как Новинку?" : "Добавить как Ожидайте?"}
                        </span>
                        <button
                          onClick={handleAddConfirm}
                          disabled={isPending}
                          className="px-2 py-0.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Подтвердить
                        </button>
                        <button
                          onClick={() => setAddConfirm(null)}
                          className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded-lg hover:bg-gray-200"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{r.name}</p>
                          <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                            {r.article && <span>Арт. {r.article}</span>}
                            {r.brand && <span>{r.brand}</span>}
                            <span className={r.stock === 0 ? "text-red-400" : "text-gray-400"}>{r.stock} шт</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setAddConfirm({ item: r, action: "new" })}
                            className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-semibold rounded hover:bg-green-600"
                          >
                            New
                          </button>
                          <button
                            onClick={() => setAddConfirm({ item: r, action: "pending" })}
                            className="px-1.5 py-0.5 bg-amber-400 text-white text-[10px] font-semibold rounded hover:bg-amber-500"
                          >
                            Ожидайте
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {addSearch.trim() && !addLoading && addResults.length === 0 && (
              <p className="mt-1.5 text-xs text-gray-400 pl-1">Ничего не найдено (или уже в новинках)</p>
            )}
          </div>

          <div className="px-4 py-3 border-b border-gray-50">
            <input
              value={siteSearch}
              onChange={e => setSiteSearch(e.target.value)}
              placeholder="Поиск по новинкам..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
            />
          </div>

          {siteLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 rounded-full border-3 border-green-400 border-t-transparent animate-spin" />
            </div>
          ) : siteItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {siteSearch ? "Ничего не найдено" : "Нет товаров-новинок — добавьте из 1С слева"}
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
              {siteItems.map(item => (
                <div key={item.id} className="px-4 py-3 hover:bg-green-50/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        {item.isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full uppercase tracking-wide flex-shrink-0">New</span>
                        )}
                        {item.isNewPending && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full flex-shrink-0">Ожидайте</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {item.article && <span className="text-xs text-gray-400 font-mono">Арт. {item.article}</span>}
                        {item.brand   && <span className="text-xs text-gray-400">{item.brand}</span>}
                        <span className="text-xs font-medium text-gray-600">{item.pricePerPc.toLocaleString("ru-RU")} ₸</span>
                        <span className={`text-xs font-medium ${item.stock === 0 ? "text-red-500" : "text-gray-400"}`}>{item.stock} шт</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {confirmPending?.id === item.id ? (
                        <>
                          <button
                            onClick={() => confirmAction(item)}
                            disabled={isPending}
                            className="px-2 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 whitespace-nowrap"
                          >
                            Подтвердить
                          </button>
                          <button
                            onClick={() => setConfirmPending(null)}
                            className="px-2 py-1 bg-gray-100 text-gray-500 text-[11px] font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Отмена
                          </button>
                        </>
                      ) : (
                        <>
                          {!item.isNew && (
                            <button
                              onClick={() => setConfirmPending({ id: item.id, action: "new" })}
                              disabled={isPending}
                              title="Вывести как активную новинку на сайте"
                              className="px-2 py-1 bg-green-500 text-white text-[11px] font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              Новинка
                            </button>
                          )}
                          {!item.isNewPending && (
                            <button
                              onClick={() => setConfirmPending({ id: item.id, action: "pending" })}
                              disabled={isPending}
                              title="Предварительная — Ожидайте поступления"
                              className="px-2 py-1 bg-amber-400 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              Предварит.
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFromSite(item)}
                            disabled={isPending}
                            title="Убрать из новинок"
                            className="px-2 py-1 bg-gray-100 text-gray-500 text-[11px] font-semibold rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            Убрать
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {siteTotal > 50 && (
            <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">Показано {Math.min((sitePage+1)*50, siteTotal)} из {siteTotal}</span>
              <div className="flex gap-1.5">
                <button onClick={() => setSitePage(p => p-1)} disabled={sitePage === 0}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Назад</button>
                <button onClick={() => setSitePage(p => p+1)} disabled={(sitePage+1)*50 >= siteTotal}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Вперёд →</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

type SyncLogRow = {
  id: number;
  source: string;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  message: string | null;
  createdAt: Date | string;
};

// ─── 1С category tree tab ──────────────────────────────────────────────────────

type OnecCategoryNode = { id: number; name: string; itemCount: number; children: OnecCategoryNode[] };
type OnecTreeItem = { id: number; name: string; article: string | null; brand: string | null; stock: number; pricePerPc: number };

function OnecCategoryTreeNode({ node, depth, selectedId, onSelect }: {
  node: OnecCategoryNode; depth: number;
  selectedId: number | null | undefined;
  onSelect: (id: number, name: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg px-1.5 py-1 cursor-pointer text-xs transition-colors ${
          selectedId === node.id ? "bg-sky-50 text-sky-700 font-semibold" : "text-gray-600 hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => onSelect(node.id, node.name)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-gray-400"
          >
            <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="truncate flex-1">{node.name || "(без имени)"}</span>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{node.itemCount}</span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <OnecCategoryTreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 1C sync tab ──────────────────────────────────────────────────────────────

function OnecSyncTab() {
  const [data, setData] = useState<{ onecItemCount: number; logs: SyncLogRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSyncStatus().then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <h2 className="font-bold text-gray-800 mr-auto">Обмен с 1С</h2>
        <span className="text-xs text-gray-400">
          Товаров в буфере: <span className="font-semibold text-gray-600">{data?.onecItemCount ?? "—"}</span>
        </span>
      </div>
      {loading ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">Загрузка...</div>
      ) : !data || data.logs.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">Синхронизаций пока не было</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.logs.map(l => (
            <div key={l.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${l.status === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {l.status === "success" ? "Успешно" : "Ошибка"}
              </span>
              <span className="text-xs font-semibold text-gray-600">{l.source}</span>
              <span className="text-xs text-gray-400">{fmtDate(l.createdAt)}, {fmtTime(l.createdAt)}</span>
              <span className="text-xs text-gray-500">создано {l.created} / обновлено {l.updated} / пропущено {l.skipped}</span>
              {l.message && <span className="text-xs text-red-500 w-full truncate" title={l.message}>{l.message}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OnecCategoryTreeTab() {
  const [tree, setTree] = useState<OnecCategoryNode[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [treeLoading, setTreeLoading] = useState(true);

  const [selected, setSelected] = useState<{ id: number | null; name: string } | null>(null);
  const [items, setItems] = useState<OnecTreeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    getOnecCategoryTree()
      .then((r) => { setTree(r.tree); setUncategorizedCount(r.uncategorizedCount); })
      .finally(() => setTreeLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (selected === null) return;
    setItemsLoading(true);
    getOnecItemsByCategory(selected.id, debSearch, page)
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .finally(() => setItemsLoading(false));
  }, [selected, debSearch, page]);

  function handleSelect(id: number | null, name: string) {
    setSelected({ id, name });
    setPage(0);
    setSearch("");
    setDebSearch("");
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Tree */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Дерево 1С</h2>
          <p className="text-xs text-gray-400 mt-0.5">Категории из классификатора 1С</p>
        </div>
        <div className="p-2 max-h-[70vh] overflow-y-auto">
          {treeLoading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Загрузка...</div>
          ) : tree.length === 0 && uncategorizedCount === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Категорий пока нет</div>
          ) : (
            <>
              {tree.map((node) => (
                <OnecCategoryTreeNode key={node.id} node={node} depth={0} selectedId={selected?.id} onSelect={handleSelect} />
              ))}
              {uncategorizedCount > 0 && (
                <div
                  className={`flex items-center gap-1 rounded-lg px-1.5 py-1 cursor-pointer text-xs transition-colors mt-1 border-t border-gray-50 pt-2 ${
                    selected?.id === null && selected !== null ? "bg-sky-50 text-sky-700 font-semibold" : "text-gray-500 hover:bg-gray-50"
                  }`}
                  onClick={() => handleSelect(null, "Без категории")}
                >
                  <span className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1">Без категории</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{uncategorizedCount}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 min-w-0 bg-white rounded-3xl border border-gray-100 overflow-hidden">
        {selected === null ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">Выберите категорию слева</div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <h2 className="font-bold text-gray-800 mr-auto truncate">{selected.name}</h2>
              <input
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-sky-300 transition-colors w-40"
              />
            </div>
            {itemsLoading ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">Загрузка...</div>
            ) : items.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                {search ? "Ничего не найдено" : "В этой категории нет товаров"}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {items.map((item) => (
                  <div key={item.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-700 flex-1 min-w-[160px] truncate">{item.name}</span>
                    {item.article && <span className="text-xs text-gray-400">{item.article}</span>}
                    {item.brand && <span className="text-xs text-gray-500">{item.brand}</span>}
                    <span className="text-xs text-gray-500 whitespace-nowrap">{item.stock} шт</span>
                    <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{item.pricePerPc}₸</span>
                  </div>
                ))}
              </div>
            )}
            {total > 50 && (
              <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">Показано {Math.min((page + 1) * 50, total)} из {total}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}
                    className="text-xs px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">Назад</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 50 >= total}
                    className="text-xs px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">Далее</button>
                </div>
              </div>
            )}
          </>
        )}
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
  const [activeTab, setActiveTab]   = useState<"orders" | "stock" | "arrivals" | "sale" | "export" | "new" | "onec" | "onecTree">("orders");
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
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Page header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-800">Панель управления</h1>
              <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
            </div>
            <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full uppercase tracking-wide">
              Администратор
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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

          {/* ─── Sidebar layout ─── */}
          <div className="flex gap-5 items-start">

            {/* ── Content area ── */}
            <div className="flex-1 min-w-0">

              {/* Mobile tab bar (hidden on lg+) */}
              <div className="lg:hidden flex flex-wrap gap-1.5 mb-5">
                {([ ["orders","Заказы","sky"], ["stock","Склад","sky"], ["arrivals","Новинки","amber"],
                    ["sale","Акции","purple"], ["export","Экспорт","sky"],
                    ["new","+ Товар","sky"], ["onec","Синхр. 1С","sky"], ["onecTree","Дерево 1С","sky"] ] as const).map(([tab, label, color]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      activeTab === tab
                        ? color === "amber" ? "bg-amber-500 text-white" : color === "purple" ? "bg-purple-500 text-white" : "bg-sky-500 text-white"
                        : "bg-white border border-gray-200 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {label}
                    {tab === "orders" && pendingOrders.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-yellow-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {pendingOrders.length}
                      </span>
                    )}
                  </button>
                ))}
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
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap gap-2 sm:gap-3 items-center">
                  <h2 className="font-bold text-gray-800 w-full sm:w-auto sm:mr-auto">Заказы</h2>
                  <input
                    type="text"
                    placeholder="Имя, телефон, ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-sky-300 w-full sm:w-48"
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
                        className={`px-4 sm:px-6 py-4 ${o.status === "Принят" ? "bg-yellow-50/40" : ""}`}
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

          {/* ─── New arrivals tab ─── */}
          {activeTab === "arrivals" && <NewArrivalsTab />}

          {/* ─── Sale tab ─── */}
          {activeTab === "sale" && <SaleTab />}

          {/* ─── Export tab ─── */}
          {activeTab === "export" && <ExportTab />}

          {/* ─── New item tab ─── */}
          {activeTab === "new" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <NewItemTab />
              <BulkItemImport />
            </div>
          )}

          {/* ─── 1C sync tab ─── */}
          {activeTab === "onec" && <OnecSyncTab />}
          {activeTab === "onecTree" && <OnecCategoryTreeTab />}

            </div>{/* /content area */}

            {/* ── Right sidebar (desktop) ── */}
            <aside className="hidden lg:flex flex-col w-52 flex-shrink-0 sticky top-[104px] self-start">
              <div className="bg-white rounded-3xl border border-gray-100 p-2 flex flex-col gap-0.5">

                {/* Основное */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Основное</p>

                <button onClick={() => setActiveTab("orders")} className={`relative flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "orders" ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  Заказы
                  {pendingOrders.length > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-yellow-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {pendingOrders.length}
                    </span>
                  )}
                </button>

                <button onClick={() => setActiveTab("stock")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "stock" ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Склад
                </button>

                {/* Маркетинг */}
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Маркетинг</p>

                <button onClick={() => setActiveTab("arrivals")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "arrivals" ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  Новинки
                </button>

                <button onClick={() => setActiveTab("sale")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "sale" ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                  Акции
                </button>

                {/* Данные */}
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Данные</p>

                <button onClick={() => setActiveTab("export")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "export" ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Экспорт
                </button>

                <button onClick={() => setActiveTab("new")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "new" ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  + Товар
                </button>

                <div className="my-1.5 border-t border-gray-100" />

                <button onClick={() => setActiveTab("onec")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "onec" ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Синхр. 1С
                </button>

                <button onClick={() => setActiveTab("onecTree")} className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${activeTab === "onecTree" ? "bg-sky-50 text-sky-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18M4 8h5m-5 4h5m-5 4h5M14 6h6M14 10h6M14 14h6M14 18h6" /></svg>
                  Дерево 1С
                </button>

              </div>
            </aside>

          </div>{/* /sidebar layout */}

        </div>
      </main>
      <Footer />
    </>
  );
}
