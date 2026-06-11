import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import StockItemDetail from "@/components/StockItemDetail";
import { getStockItemById } from "@/lib/stock";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (!Number.isFinite(itemId) || itemId <= 0) notFound();

  const item = await getStockItemById(itemId);
  if (!item) notFound();

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <a href="/catalog" className="hover:text-sky-500 transition-colors">Каталог</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium line-clamp-1">{item.name}</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <StockItemDetail item={item} />
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
