export const dynamic = 'force-dynamic';

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import SaleGrid from "@/components/SaleGrid";
import { getAllSaleItems } from "@/lib/stock";

export const metadata = {
  title: "Акции — Sharmaster",
  description: "Все акционные товары со скидками",
};

export default async function SalePage() {
  const items = await getAllSaleItems();

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium">Акции</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-baseline gap-3 mb-6">
            <h1 className="text-xl font-bold text-gray-800">Акционные товары</h1>
            {items.length > 0 && (
              <span className="text-sm text-gray-400">{items.length} товаров</span>
            )}
          </div>

          <SaleGrid items={items} />
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
