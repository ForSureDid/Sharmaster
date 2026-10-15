export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import CatalogView from "@/components/CatalogView";
import { getCollectionBySlug } from "@/lib/collections";

type SP = { [key: string]: string | string[] | undefined };

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const col = await getCollectionBySlug(slug);
  if (!col) return {};
  return {
    title: `Коллекция «${col.name}» — воздушные шары`,
    description: `Коллекция «${col.name}» в Sharmaster.kz: ${col.count} товаров, опт и розница, доставка по всему Казахстану.`,
    alternates: { canonical: `/collections/${slug}` },
    robots: Object.keys(sp).length > 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const col = await getCollectionBySlug(slug);
  if (!col) notFound();
  const sp = await searchParams;
  return (
    <>
      <Header />
      <CatalogView searchParams={Promise.resolve({ ...sp, collection: col.name })} basePath={`/collections/${slug}`} collectionName={col.name} />
      <Footer />
      <FloatingCart />
    </>
  );
}
