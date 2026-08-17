export const dynamic = 'force-dynamic';

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogView from "@/components/CatalogView";

type SP = { [key: string]: string | string[] | undefined };

export const metadata = {
  title: "Акции — Sharmaster",
  description: "Все акционные товары со скидками",
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
