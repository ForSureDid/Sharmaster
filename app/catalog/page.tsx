import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogView from "@/components/CatalogView";
import { getOnecCategoryBySlug } from "@/lib/onecStock";

type SP = { [key: string]: string | string[] | undefined };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const catSlug = typeof sp.cat === "string" ? sp.cat : undefined;
  const category = catSlug ? await getOnecCategoryBySlug(catSlug) : null;

  const isHeliumCategory = category?.slug === "geliy-i-ballony" || category?.slug === "geliy";

  const title = isHeliumCategory
    ? "Гелий в Астане — продажа и аренда баллонов оптом"
    : category
    ? `${category.name} — купить в Казахстане`
    : "Каталог воздушных шаров — купить оптом и в розницу";
  const description = isHeliumCategory
    ? "Гелий в Астане без примесей и разбавок: баллоны 10 и 40 л — продажа и аренда, всегда в наличии, большой объём. Быстрая доставка день в день или по записи, в черте города."
    : category
    ? `${category.name} в интернет-магазине Sharmaster.kz: широкий выбор, доступные цены, доставка по всему Казахстану.`
    : "Каталог Sharmaster.kz: латексные шары, фольгированные шары, шары-сферы, гелий и оборудование. Более 10000 товаров, опт и розница, доставка по всему Казахстану.";

  // Only the plain catalog or a clean category URL is canonical/indexable — every other
  // param (filters, sort, pagination, search) points back there so those combos don't
  // compete with it as thin duplicate-content pages.
  const noiseParams = Object.keys(sp).filter((k) => k !== "cat");
  const canonicalPath = category ? `/catalog?cat=${category.slug}` : "/catalog";

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: noiseParams.length > 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <Header />
      <CatalogView searchParams={searchParams} basePath="/catalog" />
      <Footer />
      <FloatingCart />
    </>
  );
}
