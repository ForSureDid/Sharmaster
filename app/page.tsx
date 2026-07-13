export const revalidate = 300;

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import BrandsMarquee from "@/components/BrandsMarquee";
import Categories from "@/components/Categories";
import NovinkaSection from "@/components/NovinkaSection";
import ProductGrid from "@/components/ProductGrid";
import Benefits from "@/components/Benefits";
import HolidayProducts from "@/components/HolidayProducts";
import Schedule from "@/components/Schedule";
import AboutReviews from "@/components/AboutReviews";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import { getSaleItems, getNovinkaItems } from "@/lib/stock";

export default async function Home() {
  const [saleItems, novinkaItems] = await Promise.all([
    getSaleItems(),
    getNovinkaItems(),
  ]);
  return (
    <>
      <Header />
      <main>
        <Hero />
        <BrandsMarquee />
        <Categories />
        <NovinkaSection items={novinkaItems.slice(0, 6)} />
        <Benefits />
        <ProductGrid items={saleItems} />
        <HolidayProducts />
        <Schedule />
        <AboutReviews />
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
