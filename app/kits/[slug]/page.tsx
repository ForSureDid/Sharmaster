import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import KitDetail from "@/components/KitDetail";
import { getKitBySlug } from "@/lib/kits";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const kit = await getKitBySlug(slug);
  if (!kit) return {};

  const title = `${kit.name} — купить в Казахстане | Sharmaster.kz`;
  const description = `${kit.name} — готовый набор за ${kit.price.toLocaleString("ru-RU")} ₸. Оптовый магазин воздушных шаров, доставка по всему Казахстану.`;

  return {
    title,
    description,
    alternates: { canonical: `https://www.sharmaster.kz/kits/${kit.slug}` },
    openGraph: { title, description, images: kit.images[0] ? [kit.images[0]] : undefined },
  };
}

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kit = await getKitBySlug(slug);
  if (!kit) notFound();

  return (
    <>
      <Header />
      <main className="pt-14 sm:pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium line-clamp-1">{kit.name}</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <KitDetail kit={kit} />
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
