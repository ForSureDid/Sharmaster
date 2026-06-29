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
  getAdminMeta,
  createStockItem,
  bulkCreateItems,
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

// ─── Import tab ───────────────────────────────────────────────────────────────

type PreviewRow = {
  article: string;
  name: string;
  qty: number;
  price: number | null;
  existingId: number | null;
  existingStock: number | null;
  willCreate: boolean;
};
type PreviewData = {
  rows: PreviewRow[];
  stats: { total: number; willUpdate: number; willCreate: number };
};
type ImportResult = { updated: number; created: number; errors: string[] };

function ImportTab() {
  const [phase, setPhase]     = useState<"idle" | "uploading" | "preview" | "applying" | "done">("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [drag, setDrag]       = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError("Загрузите файл в формате .xlsx"); return;
    }
    setPhase("uploading"); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/imports/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка чтения файла");
      setPreview(data);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      setPhase("idle");
    }
  }

  async function handleApply() {
    if (!preview) return;
    setPhase("applying"); setError(null);
    try {
      const res = await fetch("/api/admin/imports/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка импорта");
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      setPhase("preview");
    }
  }

  function reset() {
    setPhase("idle"); setPreview(null); setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (phase === "idle" || phase === "uploading") return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800">Импорт прихода</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Загрузите Excel-файл — система найдёт товары в базе и пополнит остатки
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-3xl py-16 px-8 cursor-pointer transition-colors ${
          drag ? "border-sky-400 bg-sky-50" : "border-gray-200 bg-white hover:border-sky-300 hover:bg-sky-50/30"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {phase === "uploading" ? (
          <>
            <div className="w-10 h-10 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
            <p className="text-sm text-sky-600 font-medium">Анализируем файл...</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">Перетащите файл сюда</p>
              <p className="text-xs text-gray-400 mt-1">или нажмите, чтобы выбрать</p>
            </div>
            <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-semibold rounded-full">.xlsx</span>
          </>
        )}
      </div>

      {/* Format hint */}
      <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Поддерживаемые форматы</p>
        <div className="space-y-1.5 text-xs text-gray-500">
          <div className="flex gap-2">
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Артикул</span>
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Наименование</span>
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Количество</span>
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Цена</span>
          </div>
          <p className="text-gray-400">Заголовки распознаются автоматически. Также поддерживается формат Оценка.xlsx.</p>
        </div>
      </div>
    </div>
  );

  // ── Preview ────────────────────────────────────────────────────────────────
  if (phase === "preview" && preview) return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Проверьте данные перед импортом</h2>
          <p className="text-sm text-gray-400 mt-0.5">Убедитесь, что всё верно, затем нажмите «Применить»</p>
        </div>
        <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
          Отмена
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          Пополнение: {preview.stats.willUpdate} позиций
        </div>
        {preview.stats.willCreate > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
            Новых товаров: {preview.stats.willCreate}
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium">
          Итого: {preview.stats.total} строк
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Артикул</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Наименование</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Приход, шт</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Было → Станет</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Цена</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {preview.rows.map((row, idx) => (
                <tr key={idx} className={`${row.willCreate ? "bg-sky-50/30" : "bg-green-50/20"} hover:bg-gray-50 transition-colors`}>
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{row.article || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium max-w-xs">
                    <div className="truncate">{row.name}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center font-bold text-gray-800">+{row.qty}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-gray-500">
                    {row.willCreate
                      ? <span className="text-sky-600 font-medium">новый</span>
                      : <><span className="text-gray-400">{row.existingStock}</span><span className="mx-1 text-gray-300">→</span><span className="text-green-600 font-semibold">{(row.existingStock ?? 0) + row.qty}</span></>
                    }
                  </td>
                  <td className="px-5 py-2.5 text-right text-gray-600 text-xs">
                    {row.price != null ? `${row.price.toLocaleString("ru-RU")} ₸` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.willCreate
                      ? <span className="text-xs px-2 py-0.5 bg-sky-100 text-sky-700 font-medium rounded-full">Создать</span>
                      : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 font-medium rounded-full">Пополнить</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleApply}
          className="px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
        >
          Применить приход
        </button>
        <button onClick={reset} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );

  // ── Applying ───────────────────────────────────────────────────────────────
  if (phase === "applying") return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-600 font-medium">Применяем приход...</p>
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === "done" && result) return (
    <div>
      <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Импорт завершён</h2>
            <p className="text-sm text-gray-400">Остатки склада обновлены</p>
          </div>
        </div>
        <div className="space-y-2.5 text-sm mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-500">Пополнено позиций</span>
            <span className="font-bold text-green-600">{result.updated}</span>
          </div>
          {result.created > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-500">Создано новых товаров</span>
              <span className="font-bold text-sky-600">{result.created}</span>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="py-2">
              <p className="text-red-600 text-xs font-medium mb-1">Ошибки ({result.errors.length}):</p>
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
            </div>
          )}
        </div>
        <button
          onClick={reset}
          className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          Загрузить ещё один файл
        </button>
      </div>
    </div>
  );

  return null;
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
  name: "", fullName: "", article: "", barcode: "",
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
        fullName:   form.fullName   || undefined,
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

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Полное название</label>
          <input value={form.fullName} onChange={e => set("fullName", e.target.value)}
            placeholder="Полное описание для поиска (необязательно)"
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
          <div className="grid grid-cols-4 gap-2">
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
  const [activeTab, setActiveTab]   = useState<"orders" | "stock" | "export" | "import" | "new">("orders");
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
            <button
              onClick={() => setActiveTab("import")}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === "import" ? "bg-sky-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Импорт
            </button>
            <button
              onClick={() => setActiveTab("new")}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === "new" ? "bg-sky-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              + Товар
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

          {/* ─── Import tab ─── */}
          {activeTab === "import" && <ImportTab />}

          {/* ─── New item tab ─── */}
          {activeTab === "new" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <NewItemTab />
              <BulkItemImport />
            </div>
          )}

        </div>
      </main>
      <Footer />
    </>
  );
}
