"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";


export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();

  const accountRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { totalCount, openCart } = useCart();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = search.trim();
    router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Tier 1: Utility bar */}
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

      {/* Tier 2: Logo + Search + Cart */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <a href="/" className="flex-shrink-0">
            <Image src="/logo-nobg.png" alt="Sharmaster" width={280} height={84} className="h-14 w-auto" priority />
          </a>

          <form onSubmit={handleSearch} className="flex-1 hidden md:flex max-w-xl mx-auto">
            <div className="flex w-full rounded-lg overflow-hidden border border-gray-200 focus-within:border-sky-300 transition-colors">
              <input
                type="text"
                placeholder="Поиск шаров и товаров..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 text-sm outline-none bg-white"
              />
              <button type="submit" className="px-5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium transition-colors">
                Найти
              </button>
            </div>
          </form>

          <div className="flex items-center gap-3 ml-auto">
            <a href="tel:+77769510282"
              className="hidden lg:block text-sm font-semibold text-gray-700 hover:text-sky-500 transition-colors">
              +7 776 951 0282
            </a>
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

            <button
              onClick={openCart}
              className="relative p-2 text-gray-600 hover:text-sky-500 transition-colors"
              title="Корзина"
            >
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
            <button className="md:hidden p-2 text-gray-600" onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile search row */}
      {searchOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-2 shadow-sm">
          <form onSubmit={(e) => { setSearchOpen(false); handleSearch(e); }} className="flex rounded-lg overflow-hidden border border-gray-200 focus-within:border-sky-300 transition-colors">
            <input
              autoFocus
              type="text"
              placeholder="Поиск шаров и товаров..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
            />
            <button type="submit" className="px-4 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium transition-colors">Найти</button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <form onSubmit={(e) => { setMenuOpen(false); handleSearch(e); }} className="flex rounded-lg overflow-hidden border border-gray-200">
              <input
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
              <button type="submit" className="px-4 bg-sky-400 text-white text-sm font-medium">Найти</button>
            </form>
          </div>
          <nav className="flex flex-col py-1">
            <a href="/catalog" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-sky-50 hover:text-sky-600 border-b border-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>Каталог</a>
            <a href="tel:+77769510282" className="px-4 py-3 text-sky-500 font-semibold text-sm">
              +7 776 951 0282
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
