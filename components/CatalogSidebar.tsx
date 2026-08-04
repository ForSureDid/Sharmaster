"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Category = {
  id: number;
  name: string;
  slug: string | null;
  children: { id: number; name: string; slug: string | null }[];
};

type FilterOptions = {
  brands: string[];
  sizes: string[];
  shades: string[];
  colors: string[];
  occasions: string[];
};

// OnecStockItem.colorGroup values (Russian color-bucket names from the 1C/donballon
// feed) -> a representative swatch fill. Plain hex for solid colors; a CSS gradient
// string for the multi-tone ones (Ассорти/Золото/Серебро/Розовое золото), applied as
// backgroundImage instead of backgroundColor. Прозрачный gets no fill — just the ring,
// like a real transparent balloon swatch.
const COLOR_SWATCHES: Record<string, string> = {
  "ассорти": "conic-gradient(from 90deg, #f43f5e, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #f43f5e)",
  "бежевый": "#e8dcc0",
  "белый": "#ffffff",
  "бирюзовый": "#40e0d0",
  "бордовый": "#7b1e2b",
  "голубой": "#7ec8f2",
  "желтый": "#fde047",
  "зеленый": "#22a559",
  "золото": "linear-gradient(135deg, #f7e199, #d4af37, #f7e199)",
  "красный": "#e02424",
  "оранжевый": "#f5901e",
  "персиковый": "#f3b28c",
  "прозрачный": "transparent",
  "розовое золото": "linear-gradient(135deg, #f3c8be, #d19a8f, #f3c8be)",
  "розовый": "#f7b6cf",
  "серебро": "linear-gradient(135deg, #f0f0f0, #b8b8b8, #f0f0f0)",
  "серый": "#9ca3af",
  "синий": "#1e3fd6",
  "сиреневый": "#c9a3e8",
  "фиолетовый": "#6b21c9",
  "фуше": "#d6247a",
  "черный": "#1a1a1a",
  "шоколадный": "#5a3a22",
};

function colorSwatchStyle(name: string): React.CSSProperties {
  const fill = COLOR_SWATCHES[name.toLowerCase()] ?? "#d1d5db";
  return fill.includes("gradient") ? { backgroundImage: fill } : { backgroundColor: fill };
}

type Props = {
  categories: Category[];
  filterOptions: FilterOptions;
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

function Toggle({ checked, onChange, activeColor = "bg-sky-500" }: {
  checked: boolean; onChange: (v: boolean) => void; activeColor?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 flex-shrink-0 rounded-full transition-colors ${checked ? activeColor : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

function ToggleRow({ label, checked, onChange, activeColor }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; activeColor?: string;
}) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-xs text-gray-600">{label}</span>
      <Toggle checked={checked} onChange={onChange} activeColor={activeColor} />
    </label>
  );
}

export default function CatalogSidebar({ categories, filterOptions }: Props) {
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

  function toggleInList(key: string, value: string) {
    const current = sp.get(key)?.split(",").filter(Boolean) ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update(key, next.length > 0 ? next.join(",") : null);
  }

  const activeCat = sp.get("cat") ?? "";
  const activeBrand = sp.get("brand") ?? "";
  const activeSize = sp.get("size") ?? "";
  const activeShade = sp.get("shade") ?? "";
  const activeColor = sp.get("color") ?? "";
  const activeOccasions = sp.get("occasion")?.split(",").filter(Boolean) ?? [];
  const minPrice = sp.get("min") ?? "";
  const maxPrice = sp.get("max") ?? "";
  const inStockOnly = sp.get("instock") === "1";
  const novinki = sp.get("novinki") === "1";
  const akcii = sp.get("akcii") === "1";

  const activeCount = [activeCat, activeBrand, activeSize, activeShade, activeColor, minPrice, maxPrice].filter(Boolean).length
    + activeOccasions.length + (inStockOnly ? 1 : 0) + (novinki ? 1 : 0) + (akcii ? 1 : 0);

  // When a category is active, scope the category nav to just that branch (its own
  // top-level parent + siblings) instead of showing the whole catalog tree — same
  // idea as filterOptions being scoped server-side: once you're in "фольга", you
  // shouldn't be browsing latex categories from the same list.
  const activeCatRoot = activeCat
    ? categories.find((c) => (c.slug ?? String(c.id)) === activeCat || c.children.some((s) => (s.slug ?? String(s.id)) === activeCat))
    : undefined;

  const filterSections = (
    <>
      <Section title={activeCatRoot ? activeCatRoot.name : "Категории"}>
        {activeCatRoot ? (
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => update("cat", null)}
                className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-sky-500 hover:bg-gray-50 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Все категории
              </button>
            </li>
            <li>
              <button
                onClick={() => update("cat", activeCatRoot.slug ?? String(activeCatRoot.id))}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCat === (activeCatRoot.slug ?? String(activeCatRoot.id)) ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-700 hover:bg-gray-50 hover:text-sky-500"}`}
              >
                {activeCatRoot.name}
              </button>
            </li>
            {activeCatRoot.children.length > 0 && (
              <ul className="ml-3 mt-0.5 space-y-0.5">
                {activeCatRoot.children.map((sub) => {
                  const subKey = sub.slug ?? String(sub.id);
                  return (
                    <li key={sub.id}>
                      <button
                        onClick={() => update("cat", activeCat === subKey ? (activeCatRoot.slug ?? String(activeCatRoot.id)) : subKey)}
                        className={`w-full text-left px-2 py-1 rounded-lg text-xs transition-colors ${activeCat === subKey ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-sky-500"}`}
                      >
                        {sub.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ul>
        ) : (
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => update("cat", null)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${!activeCat ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-sky-500"}`}
              >
                Все категории
              </button>
            </li>
            {categories.map((cat) => {
              const catKey = cat.slug ?? String(cat.id);
              return (
                <li key={cat.id}>
                  <button
                    onClick={() => update("cat", activeCat === catKey ? null : catKey)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCat === catKey ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-700 hover:bg-gray-50 hover:text-sky-500"}`}
                  >
                    {cat.name}
                  </button>
                  {cat.children.length > 0 && (
                    <ul className="ml-3 mt-0.5 space-y-0.5">
                      {cat.children.map((sub) => {
                        const subKey = sub.slug ?? String(sub.id);
                        return (
                          <li key={sub.id}>
                            <button
                              onClick={() => update("cat", activeCat === subKey ? null : subKey)}
                              className={`w-full text-left px-2 py-1 rounded-lg text-xs transition-colors ${activeCat === subKey ? "bg-sky-50 text-sky-600 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-sky-500"}`}
                            >
                              {sub.name}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Зоны и наличие">
        <div className="space-y-1">
          <ToggleRow label="Новинки" checked={novinki} onChange={(v) => update("novinki", v ? "1" : null)} activeColor="bg-amber-500" />
          <ToggleRow label="Акции" checked={akcii} onChange={(v) => update("akcii", v ? "1" : null)} activeColor="bg-red-500" />
          <ToggleRow label="Наличие" checked={inStockOnly} onChange={(v) => update("instock", v ? "1" : null)} />
        </div>
      </Section>

      {filterOptions.sizes.length > 0 && (
        <Section title="Размер" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {filterOptions.sizes.map((s) => (
              <li key={s}>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-sky-600">
                  <input
                    type="radio"
                    name="size"
                    checked={activeSize === s}
                    onChange={() => update("size", activeSize === s ? null : s)}
                    className="w-3.5 h-3.5 accent-sky-500"
                  />
                  {s}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {filterOptions.colors.length > 0 && (
        <Section title="Цвет">
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 max-h-64 overflow-y-auto pr-1">
            {filterOptions.colors.map((c) => {
              const active = activeColor === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => update("color", active ? null : c)}
                  className="flex flex-col items-center gap-1 group"
                  title={c}
                >
                  <span
                    className={`w-9 h-9 rounded-full border transition-all ${active ? "ring-2 ring-sky-500 ring-offset-2 border-transparent" : "border-gray-200 group-hover:border-sky-300"}`}
                    style={colorSwatchStyle(c)}
                  />
                  <span className={`text-[10px] leading-tight text-center truncate w-full ${active ? "text-sky-600 font-semibold" : "text-gray-500"}`}>
                    {c}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {filterOptions.shades.length > 0 && (
        <Section title="Оттенок" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {filterOptions.shades.map((s) => (
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

      {filterOptions.brands.length > 0 && (
        <Section title="Производитель" defaultOpen={false}>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {filterOptions.brands.map((b) => (
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

      {filterOptions.occasions.length > 0 && (
        <Section title="Праздник" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.occasions.map((o) => {
              const active = activeOccasions.includes(o);
              return (
                <button
                  key={o}
                  onClick={() => toggleInList("occasion", o)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${active ? "bg-sky-500 border-sky-500 text-white" : "border-gray-200 text-gray-600 hover:border-sky-300 hover:text-sky-600"}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
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
