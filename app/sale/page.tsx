export const dynamic = 'force-dynamic';

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogView from "@/components/CatalogView";

type SP = { [key: string]: string | string[] | undefined };

export const metadata = {
  title: "Акции и скидки на воздушные шары",
  description: "Товары со скидками в Sharmaster.kz: латексные и фольгированные шары, шары-сферы и аксессуары по акционным ценам. Доставка по всему Казахстану.",
  alternates: { canonical: "/sale" },
};

export default async function SalePage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <Header />
      <CatalogView searchParams={searchParams} basePath="/sale" forceAkcii />
      <Footer />
      <FloatingCart />
    </>
  );
}
