import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import StockItemDetail from "@/components/StockItemDetail";
import SimilarProducts from "@/components/SimilarProducts";
import { getStockItemBySlug, getStockItemById, getSimilarStockItems } from "@/lib/onecStock";

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

const SITE_URL = "https://www.sharmaster.kz";

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const item = await resolveItem(slug);
  if (!item) notFound();

  const similarItems = await getSimilarStockItems(item.id);

  // Legacy numeric links, or an item whose slug hasn't been (re)generated yet —
  // resolve by id and redirect to the canonical slug URL. Slugs are always
  // non-numeric text, so a slug-param that parses as a plain integer can only
  // have reached here via resolveItem's id fallback.
  const asId = parseInt(slug, 10);
  const isIdLookup = Number.isFinite(asId) && asId > 0 && String(asId) === slug;
  if (isIdLookup && item.slug) redirect(`/catalog/${item.slug}`);

  const canonicalUrl = `${SITE_URL}/catalog/${item.slug ?? item.id}`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: item.description || `${item.name}${item.brand ? ` от ${item.brand}` : ""} — купить в Sharmaster.kz`,
    image: item.images.length > 0 ? item.images : item.imageUrl ? [item.imageUrl] : undefined,
    sku: item.article ?? String(item.id),
    ...(item.brand ? { brand: { "@type": "Brand", name: item.brand } } : {}),
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "KZT",
      price: item.pricePerPc,
      availability: item.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Каталог", item: `${SITE_URL}/catalog` },
      { "@type": "ListItem", position: 3, name: item.name, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
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

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <StockItemDetail item={item} />
          <SimilarProducts items={similarItems} />
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
