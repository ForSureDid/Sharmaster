import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogSidebar from "@/components/CatalogSidebar";
import CatalogContent from "@/components/CatalogContent";
import {
  getProducts,
  getCategories,
  getColorGroups,
  getManufacturers,
  getSizes,
  getShades,
} from "@/lib/products";

type SP = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const catId = str(sp.cat) ? Number(sp.cat) : undefined;
  const colorGroup = str(sp.color);
  const shade = str(sp.shade);
  const sizeInches = str(sp.size);
  const manufacturer = str(sp.mfr);
  const minPrice = str(sp.min) ? Number(sp.min) : undefined;
  const maxPrice = str(sp.max) ? Number(sp.max) : undefined;
  const sort = (str(sp.sort) ?? "price_asc") as "price_asc" | "price_desc" | "name_asc";
  const page = str(sp.page) ? Number(sp.page) : 1;
  const per = str(sp.per) ? Number(sp.per) : 48;
  const q = str(sp.q);

  const [{ items, total }, categories, colorGroups, manufacturers, sizes, shades] =
    await Promise.all([
      getProducts({ categoryId: catId, colorGroup, shade, sizeInches, manufacturer, minPrice, maxPrice, sort, page, pageSize: per, search: q }),
      getCategories(),
      getColorGroups(),
      getManufacturers(),
      getSizes(),
      getShades(),
    ]);

  const totalPages = Math.ceil(total / per);

  const activeCategory = catId
    ? categories.find((c) => c.id === catId)
    : null;

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        {/* Breadcrumbs */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {activeCategory ? (
                <>
                  <a href="/catalog" className="hover:text-sky-500 transition-colors">Каталог</a>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-gray-600 font-medium">{activeCategory.name}</span>
                </>
              ) : (
                <span className="text-gray-600 font-medium">Каталог</span>
              )}
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl font-bold text-gray-800 mb-4">
            {activeCategory ? activeCategory.name : "Каталог товаров"}
          </h1>

          <div className="flex gap-6 items-start">
            <Suspense fallback={null}>
              <CatalogSidebar
                categories={categories}
                colorGroups={colorGroups}
                manufacturers={manufacturers}
                shades={shades}
                sizes={sizes}
              />
            </Suspense>

            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
              </div>
            }>
              <CatalogContent
                items={items}
                total={total}
                page={page}
                totalPages={totalPages}
                per={per}
              />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
