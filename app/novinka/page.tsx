export const dynamic = 'force-dynamic';

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import NovinkaGrid from "@/components/NovinkaGrid";
import { getNovinkaItems } from "@/lib/onecStock";

export const metadata = {
  title: "Новинки — Sharmaster",
  description: "Новые товары и предстоящие поступления",
};

export default async function NovinkaPage() {
  const items = await getNovinkaItems();

  const activeCount  = items.filter(i => i.isNew).length;
  const pendingCount = items.filter(i => i.isNewPending && !i.isNew).length;

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium">Новинки</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex flex-wrap items-baseline gap-3 mb-2">
            <h1 className="text-xl font-bold text-gray-800">Новинки</h1>
            {items.length > 0 && (
              <span className="text-sm text-gray-400">{items.length} товаров</span>
            )}
          </div>

          {/* Legend badges */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  New — {activeCount} {activeCount === 1 ? "новинка" : "новинки"} уже в наличии
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Ожидайте — {pendingCount} {pendingCount === 1 ? "товар" : "товара"} скоро поступит
                </span>
              )}
            </div>
          )}

          <NovinkaGrid items={items} />
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
