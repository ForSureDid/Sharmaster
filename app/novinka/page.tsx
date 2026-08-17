export const dynamic = 'force-dynamic';

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogView from "@/components/CatalogView";

type SP = { [key: string]: string | string[] | undefined };

export const metadata = {
  title: "Новинки — Sharmaster",
  description: "Новые товары и предстоящие поступления",
};

export default async function NovinkaPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <Header />
      <CatalogView searchParams={searchParams} basePath="/novinka" forceNovinki />
      <Footer />
      <FloatingCart />
    </>
  );
}
