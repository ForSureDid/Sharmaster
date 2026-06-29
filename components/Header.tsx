"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getMatchingHint, type CategoryHint } from "@/lib/search-hints";

type SubCategory = { id: number; name: string; slug: string };
type TopCategory = { id: number; name: string; slug: string; children: SubCategory[] };

function CategoryIcon({ slug, className = "w-4 h-4" }: { slug: string; className?: string }) {
  switch (slug) {
    case "lateksnye-shary":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.686 2 6 5.134 6 9c0 3.314 1.8 6.1 4.5 7.45V18h3v-1.55C16.2 15.1 18 12.314 18 9c0-3.866-2.686-7-6-7z" />
          <path d="M10.5 18.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5" />
          <line x1="12" y1="20" x2="12" y2="22" />
        </svg>
      );
    case "folgirovannye-shary":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.3l-4.8 2.5.9-5.3L4.2 7.7l5.4-.8z" />
          <line x1="12" y1="17" x2="12" y2="22" />
        </svg>
      );
    case "aksessuary":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8c-2.5-3-6-3-6-3s0 3.5 3 6l3 3 3-3c3-2.5 3-6 3-6s-3.5 0-6 3z" />
          <line x1="12" y1="14" x2="12" y2="22" />
          <path d="M8 22h8" />
        </svg>
      );
    case "vse-dlya-prazdnika":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18l4-8 4 5 3-3 4 6H3z" />
          <circle cx="17" cy="5" r="2" />
          <line x1="17" y1="7" x2="17" y2="10" />
          <line x1="5" y1="3" x2="5" y2="6" />
          <line x1="3.5" y1="4.5" x2="6.5" y2="4.5" />
        </svg>
      );
    case "gelij-i-oborudovanie":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="4" width="8" height="14" rx="4" />
          <path d="M10 4V2h4v2" />
          <path d="M12 18v3" />
          <path d="M9 21h6" />
          <line x1="12" y1="8" x2="12" y2="14" />
        </svg>
      );
    case "igrushki":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3" />
          <path d="M9 11.5C6.5 12.5 5 15 5 18h14c0-3-1.5-5.5-4-6.5" />
          <path d="M10 8a2 2 0 010-4" />
        </svg>
      );
    case "raznoe":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 3" />
        </svg>
      );
  }
}

type SuggestItem = {
  id: number;
  name: string;
  brand: string | null;
  stock: number;
  pricePerPc: number;
  imageUrl: string | null;
};

function SearchDropdown({
  items,
  query,
  isAdmin,
  onSelect,
  onShowAll,
}: {
  items: SuggestItem[];
  query: string;
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onShowAll: () => void;
}) {
  const hint: CategoryHint | null = query.trim().length >= 2 ? getMatchingHint(query) : null;
  if (items.length === 0 && !hint) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
      {hint && (
        <a
          href={hint.url}
          onMouseDown={(e) => e.preventDefault()}
          className="flex items-center gap-3 px-3 py-2.5 bg-sky-50 hover:bg-sky-100 transition-colors border-b border-sky-100"
        >
          <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-sky-400 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sky-700">{hint.label}</p>
            <p className="text-xs text-sky-500 truncate">{hint.subtitle}</p>
          </div>
          <svg className="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item.id); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-sky-50 transition-colors text-left"
        >
          <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">{item.name}</p>
            {item.brand && <p className="text-xs text-gray-400 truncate">{item.brand}</p>}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-semibold text-sky-600">{item.pricePerPc.toLocaleString("ru-RU")} ₸</p>
            <p className={`text-xs ${item.stock > 0 ? "text-green-500" : "text-red-400"}`}>
              {isAdmin ? (item.stock > 0 ? `${item.stock} шт` : "нет") : (item.stock > 0 ? "есть" : "нет")}
            </p>
          </div>
        </button>
      ))}
      <button
        onMouseDown={(e) => { e.preventDefault(); onShowAll(); }}
        className="w-full px-3 py-2.5 text-sm text-sky-600 hover:bg-sky-50 border-t border-gray-100 transition-colors font-medium flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Показать все результаты для «{query}»
      </button>
    </div>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState<TopCategory[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeL1, setActiveL1] = useState<number | null>(null);

  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, isAdmin, logout } = useAuth();
  const { totalCount, openCart } = useCart();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) {
        setCatalogOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setCatalogOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: TopCategory[]) => {
        setCategories(data);
        if (data.length > 0) setActiveL1(data[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setSuggestions(data.items ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 280);
  }, []);

  function handleSearchChange(val: string) {
    setSearch(val);
    fetchSuggestions(val);
  }

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = search.trim();
    setShowSuggestions(false);
    router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  }

  function handleSuggestSelect(id: number) {
    setShowSuggestions(false);
    setSearch("");
    setSuggestions([]);
    router.push(`/catalog/${id}`);
  }

  function handleShowAll() {
    setShowSuggestions(false);
    handleSearch();
  }

  function handleInputBlur() {
    setTimeout(() => setShowSuggestions(false), 150);
  }

  function handleInputFocus() {
    if (suggestions.length > 0) setShowSuggestions(true);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setShowSuggestions(false);
  }

  const activeCategory = categories.find((c) => c.id === activeL1) ?? null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50" ref={catalogRef}>
      {/* Utility bar */}
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-8 text-xs text-gray-500">
          <span className="hidden sm:block">Оптовый магазин воздушных шаров в Казахстане</span>
          <div className="flex items-center gap-4 ml-auto">
            <a href="tel:+77769510282" className="hover:text-gray-800 font-medium transition-colors">
              +7 776 951 0282
            </a>
            <div className="flex items-center gap-2">
              <a href="https://wa.me/77769510282" target="_blank" rel="noopener noreferrer"
                className="hover:text-green-600 transition-colors" title="WhatsApp">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.526 5.845L.057 23.428a.5.5 0 00.514.572l5.701-1.496A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.503-5.237-1.382l-.376-.214-3.882 1.019.993-3.786-.234-.389A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/sharoptom.kz/" target="_blank" rel="noopener noreferrer"
                className="hover:text-pink-500 transition-colors" title="Instagram">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main bar: Logo + Catalog btn + Search + Icons */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3 h-14">
          {/* Logo */}
          <a href="/" className="flex-shrink-0">
            <Image src="/logo-header.png" alt="Sharmaster" width={320} height={96} className="h-8 sm:h-11 w-auto" priority />
          </a>

          {/* Catalog button — desktop only */}
          {categories.length > 0 && (
            <button
              onClick={() => setCatalogOpen((o) => !o)}
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                catalogOpen
                  ? "bg-sky-500 text-white"
                  : "bg-sky-500 hover:bg-sky-600 text-white"
              }`}
            >
              {catalogOpen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
              Каталог товаров
            </button>
          )}

          {/* Desktop search */}
          <div className="flex-1 hidden md:block relative">
            <form onSubmit={handleSearch} className="w-full">
              <div className="flex w-full rounded-lg overflow-hidden border border-gray-200 focus-within:border-sky-300 transition-colors">
                <input
                  type="text"
                  placeholder="Поиск шаров и товаров..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  className="flex-1 px-4 py-2 text-sm outline-none bg-white"
                />
                <button type="submit" className="px-5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium transition-colors">
                  Найти
                </button>
              </div>
            </form>
            {showSuggestions && (
              <SearchDropdown
                items={suggestions}
                query={search}
                isAdmin={isAdmin}
                onSelect={handleSuggestSelect}
                onShowAll={handleShowAll}
              />
            )}
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-3 ml-auto">
            <a href="https://wa.me/77769510282" target="_blank" rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
              Связаться
            </a>

            {/* Account */}
            <div className="relative" ref={accountRef}>
              {user ? (
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-full hover:bg-sky-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-400 flex items-center justify-center text-white text-sm font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </button>
              ) : (
                <a href="/login" className="p-2 text-gray-600 hover:text-sky-500 transition-colors flex items-center" title="Войти">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </a>
              )}
              {accountOpen && user && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-semibold text-gray-800 text-sm truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <a href="/account"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                    onClick={() => setAccountOpen(false)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Мой профиль
                  </a>
                  <button
                    onClick={() => { logout(); setAccountOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Выйти
                  </button>
                </div>
              )}
            </div>

            {/* Cart */}
            <button onClick={openCart} className="relative p-2 text-gray-600 hover:text-sky-500 transition-colors" title="Корзина">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {totalCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 bg-sky-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalCount > 99 ? "99+" : totalCount}
                </span>
              )}
            </button>

            {/* Mobile search toggle */}
            <button
              className="md:hidden p-2 text-gray-600 hover:text-sky-500 transition-colors"
              onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
            >
              {searchOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 text-gray-600" onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mega-menu dropdown ── */}
      {catalogOpen && categories.length > 0 && (
        <div className="hidden md:block absolute left-0 right-0 top-full bg-white shadow-2xl border-t border-gray-100 z-40">
          <div className="max-w-7xl mx-auto flex" style={{ minHeight: 320 }}>
            {/* Left column — L1 categories */}
            <div className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-100 py-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onMouseEnter={() => setActiveL1(cat.id)}
                  onClick={() => { router.push(`/catalog?cat=${cat.id}`); setCatalogOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left ${
                    activeL1 === cat.id
                      ? "bg-white text-sky-600 font-semibold border-l-2 border-sky-500"
                      : "text-gray-700 hover:bg-white hover:text-sky-600 border-l-2 border-transparent"
                  }`}
                >
                  <CategoryIcon slug={cat.slug} className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{cat.name}</span>
                  <svg className="w-4 h-4 flex-shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Right panel — L2 subcategories */}
            <div className="flex-1 p-6">
              {activeCategory && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-800">{activeCategory.name}</h3>
                    <a
                      href={`/catalog?cat=${activeCategory.id}`}
                      onClick={() => setCatalogOpen(false)}
                      className="text-sm text-sky-500 hover:text-sky-700 transition-colors"
                    >
                      Смотреть все →
                    </a>
                  </div>
                  {activeCategory.children.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
                      {activeCategory.children.map((sub) => (
                        <a
                          key={sub.id}
                          href={`/catalog?cat=${sub.id}`}
                          onClick={() => setCatalogOpen(false)}
                          className="py-2 text-sm text-gray-600 hover:text-sky-600 transition-colors border-b border-gray-50 hover:border-sky-100 truncate"
                        >
                          {sub.name}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Нет подкатегорий</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile search row */}
      {searchOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-2 shadow-sm">
          <div className="relative">
            <form onSubmit={(e) => { setSearchOpen(false); setShowSuggestions(false); handleSearch(e); }}
              className="flex rounded-lg overflow-hidden border border-gray-200 focus-within:border-sky-300 transition-colors">
              <input
                autoFocus
                type="text"
                placeholder="Поиск шаров и товаров..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
              />
              <button type="submit" className="px-4 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium transition-colors">Найти</button>
            </form>
            {showSuggestions && (
              <SearchDropdown
                items={suggestions}
                query={search}
                isAdmin={isAdmin}
                onSelect={(id) => { setSearchOpen(false); handleSuggestSelect(id); }}
                onShowAll={() => { setSearchOpen(false); handleShowAll(); }}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <form onSubmit={(e) => { setMenuOpen(false); setShowSuggestions(false); handleSearch(e); }}
                className="flex rounded-lg overflow-hidden border border-gray-200">
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  className="flex-1 px-3 py-2 text-sm outline-none"
                />
                <button type="submit" className="px-4 bg-sky-400 text-white text-sm font-medium">Найти</button>
              </form>
              {showSuggestions && (
                <SearchDropdown
                  items={suggestions}
                  query={search}
                  isAdmin={isAdmin}
                  onSelect={(id) => { setMenuOpen(false); handleSuggestSelect(id); }}
                  onShowAll={() => { setMenuOpen(false); handleShowAll(); }}
                />
              )}
            </div>
          </div>
          <nav className="flex flex-col py-1">
            <a href="/catalog"
              className="px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-sky-50 hover:text-sky-600 border-b border-gray-100 transition-colors"
              onClick={() => setMenuOpen(false)}>
              Весь каталог
            </a>
            {categories.map((cat) => (
              <div key={cat.id}>
                <a
                  href={`/catalog?cat=${cat.id}`}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-sky-50 hover:text-sky-600 border-b border-gray-50 transition-colors flex items-center gap-2"
                  onClick={() => setMenuOpen(false)}
                >
                  <CategoryIcon slug={cat.slug} />
                  {cat.name}
                </a>
                {cat.children.map((sub) => (
                  <a
                    key={sub.id}
                    href={`/catalog?cat=${sub.id}`}
                    className="pl-10 pr-4 py-2 text-xs text-gray-500 hover:bg-sky-50 hover:text-sky-600 border-b border-gray-50 transition-colors flex items-center"
                    onClick={() => setMenuOpen(false)}
                  >
                    {sub.name}
                  </a>
                ))}
              </div>
            ))}
            <a href="tel:+77769510282" className="px-4 py-3 text-sky-500 font-semibold text-sm border-t border-gray-100 mt-1">
              +7 776 951 0282
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
