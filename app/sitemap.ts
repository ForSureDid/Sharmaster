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
  ];

  // All stock item pages
  const items = await db.stockItem.findMany({
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" },
  });

  const dynamic: MetadataRoute.Sitemap = items.map((item) => ({
    url: `${BASE_URL}/catalog/${item.id}`,
    lastModified: item.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...statics, ...dynamic];
}
