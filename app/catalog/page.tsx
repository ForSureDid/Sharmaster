import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogView from "@/components/CatalogView";

type SP = { [key: string]: string | string[] | undefined };

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
