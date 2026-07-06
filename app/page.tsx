export const revalidate = 300;

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import BrandsMarquee from "@/components/BrandsMarquee";
import Categories from "@/components/Categories";
import ProductGrid from "@/components/ProductGrid";
import Benefits from "@/components/Benefits";
import HolidayProducts from "@/components/HolidayProducts";
import Schedule from "@/components/Schedule";
import AboutReviews from "@/components/AboutReviews";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import { getSaleItems } from "@/lib/stock";

export default async function Home() {
  const saleItems = await getSaleItems();
  return (
    <>
      <Header />
      <main>
        <Hero />
        <BrandsMarquee />
        <Categories />
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
