"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Category = {
  id: number;
  name: string;
  children: { id: number; name: string; children: { id: number; name: string }[] }[];
};

type Props = {
  categories: Category[];
  brands: string[];
};

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-700 hover:text-sky-600 transition-colors"
      >
        {title}
        <svg className={`w-4 h-4 transition-transform text-gray-400 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

export default function CatalogSidebar({ categories, brands }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/catalog?${params.toString()}`);
  }

  const activeCat = sp.get("cat") ?? "";
  const activeBrand = sp.get("brand") ?? "";
  const minPrice = sp.get("min") ?? "";
  const maxPrice = sp.get("max") ?? "";
  const inStockOnly = sp.get("instock") === "1";

  const activeCount = [activeCat, activeBrand, minPrice, maxPrice].filter(Boolean).length + (inStockOnly ? 1 : 0);

  const filterSections = (
    <>
      <Section title="Наличие">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-sky-600">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => update("instock", e.target.checked ? "1" : null)}
            className="w-3.5 h-3.5 rounded accent-sky-500"
          />
          Только в наличии
        </label>
      </Section>

      <Section title="Категории">
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => update("cat", null)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${!activeCat ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-sky-500"}`}
            >
              Все категории
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => update("cat", activeCat === String(cat.id) ? null : String(cat.id))}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCat === String(cat.id) ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-700 hover:bg-gray-50 hover:text-sky-500"}`}
              >
                {cat.name}
              </button>
              {cat.children.length > 0 && (
                <ul className="ml-3 mt-0.5 space-y-0.5">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <button
                        onClick={() => update("cat", activeCat === String(sub.id) ? null : String(sub.id))}
                        className={`w-full text-left px-2 py-1 rounded-lg text-xs transition-colors ${activeCat === String(sub.id) ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-sky-500"}`}
                      >
                        {sub.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Цена (₸/шт)" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="от"
            value={minPrice}
            onChange={(e) => update("min", e.target.value || null)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-sky-300 transition-colors"
          />
          <span className="text-gray-300 text-xs">—</span>
          <input
            type="number"
            placeholder="до"
            value={maxPrice}
            onChange={(e) => update("max", e.target.value || null)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-sky-300 transition-colors"
          />
        </div>
      </Section>

      {brands.length > 0 && (
        <Section title="Бренд" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {brands.map((b) => (
              <li key={b}>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-sky-600">
                  <input
                    type="radio"
                    name="brand"
                    checked={activeBrand === b}
                    onChange={() => update("brand", activeBrand === b ? null : b)}
                    className="w-3.5 h-3.5 accent-sky-500"
                  />
                  {b}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 bg-white rounded-xl border border-gray-100 p-4 sticky top-[130px] max-h-[calc(100vh-150px)] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">Фильтры</h2>
          {activeCount > 0 && (
            <button onClick={() => router.push("/catalog")} className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Сбросить ({activeCount})
            </button>
          )}
        </div>
        {filterSections}
      </aside>

      {/* Mobile: fixed button + bottom drawer */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-6 left-4 z-40 flex items-center gap-2 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-full shadow-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Фильтры{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>

        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Фильтры</h2>
                <div className="flex items-center gap-3">
                  {activeCount > 0 && (
                    <button
                      onClick={() => { router.push("/catalog"); setMobileOpen(false); }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Сбросить ({activeCount})
                    </button>
                  )}
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto px-4 pb-4 flex-1">
                {filterSections}
              </div>
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors"
                >
                  Показать товары
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
