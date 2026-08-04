import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import StockItemDetail from "@/components/StockItemDetail";
import { getStockItemBySlug, getStockItemById } from "@/lib/onecStock";

// Resolves the same way the page body below does — both hit lib/onecStock.ts's
// unstable_cache-wrapped fetchers, so calling it again here doesn't re-query the DB.
async function resolveItem(slug: string) {
  let item = await getStockItemBySlug(slug);
  if (!item) {
    const asId = parseInt(slug, 10);
    if (Number.isFinite(asId) && asId > 0 && String(asId) === slug) {
      item = await getStockItemById(asId);
    }
  }
  return item;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await resolveItem(slug);
  if (!item) return {};

  const title = `${item.name} — купить в Казахстане | Sharmaster.kz`;
  const description = `${item.name}${item.brand ? ` от ${item.brand}` : ""} — ${item.pricePerPc.toLocaleString("ru-RU")} ₸. Оптовый магазин воздушных шаров, доставка по всему Казахстану.`;

  return {
    title,
    description,
    alternates: { canonical: `https://www.sharmaster.kz/catalog/${item.slug ?? item.id}` },
    openGraph: {
      title,
      description,
      images: item.imageUrl ? [item.imageUrl] : undefined,
    },
  };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const item = await resolveItem(slug);
  if (!item) notFound();

  // Legacy numeric links, or an item whose slug hasn't been (re)generated yet —
  // resolve by id and redirect to the canonical slug URL. Slugs are always
  // non-numeric text, so a slug-param that parses as a plain integer can only
  // have reached here via resolveItem's id fallback.
  const asId = parseInt(slug, 10);
  const isIdLookup = Number.isFinite(asId) && asId > 0 && String(asId) === slug;
  if (isIdLookup && item.slug) redirect(`/catalog/${item.slug}`);

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
