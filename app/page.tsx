import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import Benefits from "@/components/Benefits";
import About from "@/components/About";
import Schedule from "@/components/Schedule";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Categories />
        <Benefits />
        <About />
        <Schedule />
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
