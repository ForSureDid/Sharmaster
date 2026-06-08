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
  colorGroups: string[];
  manufacturers: string[];
  shades: string[];
  sizes: string[];
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

export default function CatalogSidebar({ categories, colorGroups, manufacturers, shades, sizes }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

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
  const activeColor = sp.get("color") ?? "";
  const activeMfr = sp.get("mfr") ?? "";
  const activeShade = sp.get("shade") ?? "";
  const activeSize = sp.get("size") ?? "";
  const minPrice = sp.get("min") ?? "";
  const maxPrice = sp.get("max") ?? "";
  const inStockOnly = sp.get("instock") === "1";

  const activeCount = [activeCat, activeColor, activeMfr, activeShade, activeSize, minPrice, maxPrice].filter(Boolean).length + (inStockOnly ? 1 : 0);

  return (
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
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${activeCat === String(cat.id) ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-sky-500"}`}
              >
                {cat.name}
              </button>
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

      {sizes.length > 0 && (
        <Section title="Размер (дюймы)" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => update("size", activeSize === s ? null : s)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium ${activeSize === s ? "bg-sky-500 text-white border-sky-500" : "border-gray-200 text-gray-600 hover:border-sky-300 hover:text-sky-600"}`}
              >
                {s}&quot;
              </button>
            ))}
          </div>
        </Section>
      )}

      {colorGroups.length > 0 && (
        <Section title="Группа цвета" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {colorGroups.map((c) => (
              <li key={c}>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-sky-600">
                  <input
                    type="radio"
                    name="color"
                    checked={activeColor === c}
                    onChange={() => update("color", activeColor === c ? null : c)}
                    className="w-3.5 h-3.5 accent-sky-500"
                  />
                  {c}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {shades.length > 0 && (
        <Section title="Оттенок" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {shades.map((s) => (
              <li key={s}>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-sky-600">
                  <input
                    type="radio"
                    name="shade"
                    checked={activeShade === s}
                    onChange={() => update("shade", activeShade === s ? null : s)}
                    className="w-3.5 h-3.5 accent-sky-500"
                  />
                  {s}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {manufacturers.length > 0 && (
        <Section title="Производитель" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {manufacturers.map((m) => (
              <li key={m}>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-sky-600">
                  <input
                    type="radio"
                    name="mfr"
                    checked={activeMfr === m}
                    onChange={() => update("mfr", activeMfr === m ? null : m)}
                    className="w-3.5 h-3.5 accent-sky-500"
                  />
                  {m}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </aside>
  );
}
