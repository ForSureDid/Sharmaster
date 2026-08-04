import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE_URL = "https://www.sharmaster.kz";

export const revalidate = 3600; // regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const statics: MetadataRoute.Sitemap = [
    { url: BASE_URL,           lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/catalog`, lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/sale`,    lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/novinka`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/helium`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/discounts`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contacts`,  lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/oferta`,         lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/delivery`,       lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/returns`,        lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/cookie-policy`,  lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Live catalog product pages — OnecStockItem is the storefront source of truth
  // post-migration (app/catalog/[slug]/page.tsx resolves by slug via
  // lib/onecStock.ts's getStockItemBySlug, not the legacy StockItem table this
  // used to query). slug is nullable until backfilled and isHidden rows never
  // resolve publicly, so both are excluded — every sitemap entry should be a real 200.
  const items = await db.onecStockItem.findMany({
    where: { isHidden: false, slug: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { id: "asc" },
  });

  const dynamic: MetadataRoute.Sitemap = items.map((item) => ({
    url: `${BASE_URL}/catalog/${item.slug}`,
    lastModified: item.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...statics, ...dynamic];
}
