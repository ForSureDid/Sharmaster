"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getRecentlyViewed, addRecentlyViewed, type RecentlyViewedItem } from "@/lib/recentlyViewed";

// Photo-only history strip (à la Don Ballon) — just the thumbnail, no name/
// price/stock/add-to-cart, so it never needs fresh data from the server and
// can live entirely in localStorage. Distinct from <SimilarProducts>, which
// is category/attribute similarity, not personal browsing history.
export default function RecentlyViewed({ current }: { current: RecentlyViewedItem }) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    if (current.imageUrl) addRecentlyViewed(current);
    setItems(getRecentlyViewed().filter((i) => i.id !== current.id));
    // Re-run only when navigating to a different product, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  if (items.length === 0) return null;

  return (
    <div className="mt-8 max-w-[90rem]">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Вы недавно смотрели</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item) => (
          <a
            key={item.id}
            href={`/catalog/${item.slug ?? item.id}`}
            className="relative flex-shrink-0 aspect-square w-[62%] sm:w-[38%] md:w-[29%] lg:w-[calc((100%-4*1rem)/5)] rounded-xl overflow-hidden border border-gray-100 bg-white hover:border-sky-300 hover:shadow-md transition-all"
          >
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt="" fill className="object-contain p-1.5" sizes="(max-width: 640px) 62vw, (max-width: 768px) 38vw, (max-width: 1024px) 29vw, 20vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-sky-50">
                <svg className="w-16 h-16 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
