import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import { getCollections } from "@/lib/collections";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Коллекции воздушных шаров — тематические серии",
  description: "Тематические коллекции шаров Sharmaster.kz: животные, единороги, динозавры, Хэллоуин, Новый год, день рождения и другие серии. Опт и розница, доставка по Казахстану.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const tiles = await getCollections();
  return (
    <>
      <Header />
      <main className="pt-14 sm:pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <Link href="/" className="hover:text-sky-500 transition-colors">Главная</Link>
              <span>/</span>
              <span className="text-gray-600 font-medium">Коллекции</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Коллекции</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {tiles.map((t) => (
              <Link
                key={t.slug}
                href={`/collections/${t.slug}`}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative w-full aspect-square bg-gray-50">
                  {t.cover && (
                    <Image
                      src={t.cover}
                      alt={t.name}
                      fill
                      unoptimized={t.cover.startsWith("http") || t.cover.endsWith(".svg")}
                      className={`${t.cover.startsWith("/collections/db/") ? "object-contain p-3" : "object-cover"} group-hover:scale-105 transition-transform duration-300`}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  )}
                </div>
                <div className="p-3 text-center">
                  <p className="text-sm sm:text-base font-medium text-slate-700 group-hover:text-sky-600 transition-colors">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.count} шт.</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
