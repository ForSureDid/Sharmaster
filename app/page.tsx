export const revalidate = 300;

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import BrandsMarquee from "@/components/BrandsMarquee";
import Categories from "@/components/Categories";
import StarterKitsSection from "@/components/StarterKitsSection";
import NovinkaSection from "@/components/NovinkaSection";
import HitsSection from "@/components/HitsSection";
import ProductGrid from "@/components/ProductGrid";
import Benefits from "@/components/Benefits";
import CollectionsSection from "@/components/CollectionsSection";
import HolidayProducts from "@/components/HolidayProducts";
import Schedule from "@/components/Schedule";
import AboutReviews from "@/components/AboutReviews";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import { getSaleItems, getNovinkaItems, getHitItems } from "@/lib/onecStock";

export default async function Home() {
  const [saleItems, novinkaItems, hitItems] = await Promise.all([
    getSaleItems(),
    getNovinkaItems(),
    getHitItems(),
  ]);
  return (
    <>
      <Header />
      <main>
        <Hero />
        <h1 className="sr-only">Воздушные шары оптом и в розницу в Казахстане</h1>
        <BrandsMarquee />
        <Categories />
        <NovinkaSection items={novinkaItems.slice(0, 15)} />
        <StarterKitsSection />
        <HitsSection items={hitItems} />
        <CollectionsSection />
        <ProductGrid items={saleItems} />
        <HolidayProducts />
        <Benefits />
        <Schedule />
        <AboutReviews />
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
