import { Suspense } from "react";
import CatalogSidebar from "@/components/CatalogSidebar";
import StockContent from "@/components/StockContent";
import { getStockItems, getDescendantCategoryIds, getOnecCategories, getOnecFilterOptions, getOnecCategoryBySlug } from "@/lib/onecStock";
import { db } from "@/lib/db";

type SP = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

type Props = {
  searchParams: Promise<SP>;
  basePath: string;
  // Pins the page to a zone regardless of the novinki/akcii query params — used by
  // /novinka and /sale so they're always that zone, with the rest of the catalog's
  // filter/sort/pagination machinery (CatalogSidebar + StockContent) still working.
  forceNovinki?: boolean;
  forceAkcii?: boolean;
};

export default async function CatalogView({ searchParams, basePath, forceNovinki = false, forceAkcii = false }: Props) {
  const sp = await searchParams;

  function safeInt(v: string | undefined, fallback: number): number {
    const n = v ? parseInt(v, 10) : fallback;
    return Number.isFinite(n) ? n : fallback;
  }
  function safeFloat(v: string | undefined): number | undefined {
    if (!v) return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  const catSlug = str(sp.cat);
  const catsParam = str(sp.cats);
  const catsSlugs = catsParam ? catsParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;

  const [activeCategory, multiCatRoots] = await Promise.all([
    catSlug ? getOnecCategoryBySlug(catSlug) : Promise.resolve(null),
    catsSlugs && catsSlugs.length > 0
      ? db.onecCategory.findMany({ where: { slug: { in: catsSlugs } }, select: { id: true } })
      : Promise.resolve(undefined),
  ]);
  const catId = activeCategory?.id;
  const expandedCategoryIds = multiCatRoots && multiCatRoots.length > 0
    ? (await Promise.all(multiCatRoots.map(r => getDescendantCategoryIds(r.id)))).flat()
    : undefined;
  const brandParam = str(sp.brand);
  const brandList = brandParam ? brandParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const brand = brandList && brandList.length === 1 ? brandList[0] : undefined;
  const brands = brandList && brandList.length > 1 ? brandList : undefined;
  const size = str(sp.size);
  const shade = str(sp.shade);
  const color = str(sp.color);
  const occasionParam = str(sp.occasion);
  const occasions = occasionParam ? occasionParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const minPrice = safeFloat(str(sp.min));
  const maxPrice = safeFloat(str(sp.max));
  const SORT_OPTS = ["smart", "hit", "price_asc", "price_desc", "name_asc"] as const;
  const rawSort = str(sp.sort);
  const sort = (SORT_OPTS.includes(rawSort as typeof SORT_OPTS[number]) ? rawSort : "smart") as "smart" | "hit" | "price_asc" | "price_desc" | "name_asc";
  const page = Math.max(safeInt(str(sp.page), 1), 1);
  const per = Math.min(Math.max(safeInt(str(sp.per), 48), 1), 200);
  const q = str(sp.q);
  const inStockOnly = str(sp.instock) === "1";
  const novinki = forceNovinki || str(sp.novinki) === "1";
  const akcii = forceAkcii || str(sp.akcii) === "1";
  const hit = str(sp.hit) === "1";

  // Same category scope the item query uses — keeps filter option lists (brand/size/
  // shade/occasion) scoped to the active category's subtree instead of the whole catalog.
  const filterCategoryIds = expandedCategoryIds ?? (catId ? await getDescendantCategoryIds(catId) : null);

  const [{ items, total }, categories, filterOptions] =
    await Promise.all([
      getStockItems({ categoryId: expandedCategoryIds ? undefined : catId, categoryIds: expandedCategoryIds, brand, brands, sizeInches: size, shade, colorGroup: color, occasions, minPrice, maxPrice, sort, page, pageSize: per, search: q, inStockOnly, isNewPending: novinki, onSale: akcii, isHit: hit }),
      getOnecCategories(),
      getOnecFilterOptions(filterCategoryIds),
    ]);

  const totalPages = Math.ceil(total / per);
  const activeZones = [novinki && "Новинки", akcii && "Акции", hit && "Хиты продаж"].filter(Boolean) as string[];
  const zoneTitle = activeZones.length > 0 ? activeZones.join(" и ") : null;
  const lockedZone = forceNovinki ? "novinki" as const : forceAkcii ? "akcii" as const : undefined;

  // Keyword-bearing paragraph per category/zone — the grid above is all widgets and
  // images, this is the only real indexable text Google/Yandex see on these pages.
  const seoText = activeCategory?.slug === "geliy-i-ballony" || activeCategory?.slug === "geliy"
    ? "Гелий в Астане без примесей и разбавок: продажа и аренда баллонов 10 и 40 литров для салонов, флористов и организаторов праздников. Всегда в наличии, большой объём на складе. Быстрая доставка день в день или по записи, в черте Астаны."
    : activeCategory
    ? `Купить ${activeCategory.name.toLowerCase()} в интернет-магазине Sharmaster.kz — доступные оптовые и розничные цены, доставка по всему Казахстану. В наличии латексные и фольгированные шары, шары-сферы, ШДМ, цифры, буквы и аксессуары для оформления праздников.`
    : akcii
    ? "Акции и скидки на воздушные шары в Sharmaster.kz: латексные и фольгированные шары, шары-сферы и аксессуары по сниженным ценам. Ассортимент акционных товаров обновляется регулярно — успейте купить шары со скидкой."
    : novinki
    ? "Новинки Sharmaster.kz — свежие поступления воздушных шаров: новые модели латексных и фольгированных шаров, шаров-сфер, цифр и фигур. Опт и розница, доставка по Казахстану."
    : "Sharmaster.kz — оптовый и розничный магазин воздушных шаров в Казахстане. Латексные шары, фольгированные шары, шары-сферы, ШДМ, цифры и буквы, гирлянды и аксессуары для оформления дня рождения, выписки из роддома, свадьбы, юбилея, выпускного и Нового года. Доставка по всему Казахстану.";

  return (
    <main className="pt-[88px] min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-gray-400">
            <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {activeCategory || zoneTitle ? (
              <>
                <a href="/catalog" className="hover:text-sky-500 transition-colors">Каталог</a>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-600 font-medium">{activeCategory ? activeCategory.name : zoneTitle}</span>
              </>
            ) : (
              <span className="text-gray-600 font-medium">Каталог</span>
            )}
          </nav>
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">
          {activeCategory ? activeCategory.name : zoneTitle ?? "Каталог товаров"}
        </h1>

        <div className="flex lg:gap-6 items-start">
          <Suspense fallback={null}>
            <CatalogSidebar
              categories={categories}
              filterOptions={filterOptions}
              basePath={basePath}
              lockedZone={lockedZone}
            />
          </Suspense>

          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
            </div>
          }>
            <StockContent
              items={items}
              total={total}
              page={page}
              totalPages={totalPages}
              per={per}
              basePath={basePath}
            />
          </Suspense>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 text-sm text-gray-500 leading-relaxed">
          {seoText}
        </div>
      </div>
    </main>
  );
}
