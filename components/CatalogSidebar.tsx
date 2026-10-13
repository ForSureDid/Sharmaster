"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  countries?: string[];
  popularSizes?: string[];
  popularOccasions?: string[];
  priceMin: number;
  priceMax: number;
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
  basePath?: string;
  // Zone this page is pinned to (e.g. /novinka is always novinki=1) — hides that
  // toggle from "Зоны" since it's implied, not a filter the user can turn off here.
  lockedZone?: "novinki" | "akcii";
};

// Always-open section (donballon style): bold title, content below, thin divider between sections.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 last:border-0 py-4 first:pt-1">
      <h3 className="text-sm font-bold text-gray-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// Gray pill chip; active = filled sky.
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${active ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
    >
      {label}
    </button>
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

function ToggleRow({ label, checked, onChange, activeColor, labelColor = "text-gray-600" }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; activeColor?: string; labelColor?: string;
}) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
      <Toggle checked={checked} onChange={onChange} activeColor={activeColor} />
    </label>
  );
}

// Chip list that shows only the popular values (plus any active one) and reveals the rest
// below on "Все …".
function ChipGroup({ all, popular, isActive, onPick, allLabel }: {
  all: string[]; popular: string[]; isActive: (v: string) => boolean; onPick: (v: string) => void; allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const head = all.filter((v) => popular.includes(v) || isActive(v));
  const rest = all.filter((v) => !head.includes(v));
  const shown = open ? [...head, ...rest] : head;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {shown.map((v) => <Chip key={v} label={v} active={isActive(v)} onClick={() => onPick(v)} />)}
      </div>
      {rest.length > 0 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-3 text-xs font-semibold text-sky-500 hover:text-sky-600 flex items-center gap-1">
          {open ? "Свернуть" : allLabel}
          <svg className={`w-3 h-3 transition-transform ${open ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  );
}

// Dual-thumb price slider: two stacked native range inputs. Local state while dragging,
// URL (min/max) is updated on release so the catalog isn't refetched on every pixel.
function PriceSlider({ bounds, min, max, onCommit }: {
  bounds: [number, number]; min: string; max: string; onCommit: (min: string | null, max: string | null) => void;
}) {
  const step = bounds[1] - bounds[0] > 1000 ? 10 : 1;
  // align the track ends to the step grid so the right thumb can sit exactly on "max"
  const lo = Math.floor(bounds[0] / step) * step;
  const hi = Math.ceil(bounds[1] / step) * step;
  const clamp = (n: number) => Math.min(hi, Math.max(lo, n));
  const curLo = min ? clamp(Number(min)) : lo;
  const curHi = max ? clamp(Number(max)) : hi;
  const [a, setA] = useState(curLo);
  const [b, setB] = useState(curHi);
  useEffect(() => { setA(curLo); setB(curHi); }, [curLo, curHi]);

  const commit = (x: number, y: number) => onCommit(x <= lo ? null : String(x), y >= hi ? null : String(y));
  const pct = (n: number) => ((n - lo) / (hi - lo)) * 100;
  const thumb = "pointer-events-none absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-sky-500 [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-sky-500";

  return (
    <div>
      <div className="relative h-5 mx-2.5 mb-3 touch-none">
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1 rounded-full bg-gray-200" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-sky-500" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        <input type="range" aria-label="Цена от" min={lo} max={hi} step={step} value={a}
          onChange={(e) => setA(Math.min(Number(e.target.value), b))}
          onPointerUp={() => commit(a, b)} onKeyUp={() => commit(a, b)} className={thumb} style={{ zIndex: a > hi - (hi - lo) * 0.1 ? 5 : 3 }} />
        <input type="range" aria-label="Цена до" min={lo} max={hi} step={step} value={b}
          onChange={(e) => setB(Math.max(Number(e.target.value), a))}
          onPointerUp={() => commit(a, b)} onKeyUp={() => commit(a, b)} className={thumb} style={{ zIndex: 4 }} />
      </div>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" value={a} min={lo} max={hi}
          onChange={(e) => setA(e.target.value === "" ? lo : Number(e.target.value))}
          onBlur={() => { const v = Math.min(clamp(a), b); setA(v); commit(v, b); }}
          className="w-full bg-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-300" />
        <span className="text-gray-300 text-xs">—</span>
        <input type="number" inputMode="numeric" value={b} min={lo} max={hi}
          onChange={(e) => setB(e.target.value === "" ? hi : Number(e.target.value))}
          onBlur={() => { const v = Math.max(clamp(b), a); setB(v); commit(a, v); }}
          className="w-full bg-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-300" />
      </div>
    </div>
  );
}

export default function CatalogSidebar({ categories, filterOptions, basePath = "/catalog", lockedZone }: Props) {
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
    router.push(`${basePath}?${params.toString()}`);
  }

  function toggleInList(key: string, value: string) {
    const current = sp.get(key)?.split(",").filter(Boolean) ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update(key, next.length > 0 ? next.join(",") : null);
  }

  const activeCat = sp.get("cat") ?? "";
  const activeBrands = sp.get("brand")?.split(",").filter(Boolean) ?? [];
  const activeSize = sp.get("size") ?? "";
  const activeShade = sp.get("shade") ?? "";
  const activeCountry = sp.get("country") ?? "";
  const activeColor = sp.get("color") ?? "";
  const activeOccasions = sp.get("occasion")?.split(",").filter(Boolean) ?? [];
  const minPrice = sp.get("min") ?? "";
  const maxPrice = sp.get("max") ?? "";
  const inStockOnly = sp.get("instock") === "1";
  const novinki = sp.get("novinki") === "1";
  const akcii = sp.get("akcii") === "1";
  const hit = sp.get("hit") === "1";

  const activeCount = [activeCat, activeCountry, activeSize, activeShade, activeColor, minPrice, maxPrice].filter(Boolean).length
    + activeOccasions.length + activeBrands.length + (inStockOnly ? 1 : 0)
    + (novinki && lockedZone !== "novinki" ? 1 : 0)
    + (akcii && lockedZone !== "akcii" ? 1 : 0)
    + (hit ? 1 : 0);

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
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Наличие">
        <div className="space-y-1">
          <ToggleRow label="Наличие" checked={inStockOnly} onChange={(v) => update("instock", v ? "1" : null)} />
        </div>
      </Section>

      <Section title="Зоны">
        <div className="space-y-1">
          {lockedZone !== "akcii" && (
            <ToggleRow label="Акции" checked={akcii} onChange={(v) => update("akcii", v ? "1" : null)} activeColor="bg-red-500" labelColor="text-red-600" />
          )}
          {lockedZone !== "novinki" && (
            <ToggleRow label="Новинки" checked={novinki} onChange={(v) => update("novinki", v ? "1" : null)} activeColor="bg-green-500" labelColor="text-green-600" />
          )}
        </div>
      </Section>

      <Section title="Хиты продаж">
        <div className="space-y-1">
          <ToggleRow label="Хиты продаж" checked={hit} onChange={(v) => update("hit", v ? "1" : null)} activeColor="bg-orange-500" labelColor="text-orange-600" />
        </div>
      </Section>

      {filterOptions.sizes.length > 0 && (
        <Section title="Размер">
          <ChipGroup all={filterOptions.sizes} popular={filterOptions.popularSizes ?? []} isActive={(v) => activeSize === v} onPick={(v) => update("size", activeSize === v ? null : v)} allLabel="Все размеры" />
        </Section>
      )}

      {filterOptions.colors.length > 0 && (
        <Section title="Цвет">
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 ">
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
        <Section title="Оттенок">
          <div className="flex flex-wrap gap-2">
            {filterOptions.shades.map((v) => (
              <Chip key={v} label={v} active={activeShade === v} onClick={() => update("shade", activeShade === v ? null : v)} />
            ))}
          </div>
        </Section>
      )}

      {filterOptions.priceMax > filterOptions.priceMin && (
        <Section title="Цена (₸/шт)">
          <PriceSlider
            bounds={[filterOptions.priceMin, filterOptions.priceMax]}
            min={minPrice}
            max={maxPrice}
            onCommit={(mn, mx) => {
              const params = new URLSearchParams(sp.toString());
              mn ? params.set("min", mn) : params.delete("min");
              mx ? params.set("max", mx) : params.delete("max");
              params.delete("page");
              router.push(`${basePath}?${params.toString()}`);
            }}
          />
        </Section>
      )}

      {filterOptions.brands.length > 0 && (
        <Section title="Производитель">
          <div className="flex flex-wrap gap-2">
            {filterOptions.brands.map((v) => (
              <Chip key={v} label={v} active={activeBrands.includes(v)} onClick={() => toggleInList("brand", v)} />
            ))}
          </div>
        </Section>
      )}

      {filterOptions.countries && filterOptions.countries.length > 0 && (
        <Section title="Страна">
          <div className="flex flex-wrap gap-2">
            {filterOptions.countries.map((v) => (
              <Chip key={v} label={v} active={activeCountry === v} onClick={() => update("country", activeCountry === v ? null : v)} />
            ))}
          </div>
        </Section>
      )}

      {filterOptions.occasions.length > 0 && (
        <Section title="Праздник">
          <ChipGroup all={filterOptions.occasions} popular={filterOptions.popularOccasions ?? []} isActive={(v) => activeOccasions.includes(v)} onPick={(v) => toggleInList("occasion", v)} allLabel="Все праздники" />
        </Section>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">Фильтры</h2>
          {activeCount > 0 && (
            <button onClick={() => router.push(basePath)} className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
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
                      onClick={() => { router.push(basePath); setMobileOpen(false); }}
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
