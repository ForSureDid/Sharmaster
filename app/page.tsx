import Header from "@/components/Header";
import Hero from "@/components/Hero";
// import Occasions from "@/components/Occasions";
import Categories from "@/components/Categories";
import ProductGrid from "@/components/ProductGrid";
import Benefits from "@/components/Benefits";
import About from "@/components/About";
import Schedule from "@/components/Schedule";
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
        {/* <Occasions /> */}
        <Categories />
        <ProductGrid items={saleItems} />
        <Benefits />
        <About />
        <Schedule />
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
