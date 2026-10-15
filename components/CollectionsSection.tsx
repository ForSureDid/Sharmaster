import Image from "next/image";
import Link from "next/link";
import { getCollections } from "@/lib/collections";
import { existsSync } from "node:fs";
import { join } from "node:path";

const HOME_TILES = 10;

// Big left card is the entry point to /collections (same layout as HolidayProducts).
// public/collections/promo-card.webp is the generated hero; until it exists the card
// falls back to a plain gradient so the section never shows a broken image.
const HAS_PROMO = existsSync(join(process.cwd(), "public/collections/promo-card.webp"));

export default async function CollectionsSection() {
  const tiles = (await getCollections()).slice(0, HOME_TILES);
  if (tiles.length === 0) return null;

  return (
    <section className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Коллекции</h2>
          <Link
            href="/collections"
            className="text-sm text-sky-500 hover:text-sky-600 font-medium bg-sky-50 hover:bg-sky-100 rounded-full px-5 py-2 transition-colors"
          >
            Смотреть всё
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.75fr_repeat(5,1fr)] gap-4 sm:gap-5">
          <Link
            href="/collections"
            className="group relative col-span-2 sm:col-span-3 lg:col-span-1 lg:row-span-2 min-h-[460px] lg:min-h-0 rounded-2xl overflow-hidden bg-[#6cc0e6]"
          >
            {HAS_PROMO && (
              <div
                className="absolute inset-x-0 bottom-0 h-[76%]"
                style={{ maskImage: "linear-gradient(to bottom, transparent, #000 22%)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%)" }}
              >
                <Image
                  src="/collections/promo-card.webp"
                  alt=""
                  fill
                  className="object-cover object-bottom group-hover:scale-[1.03] transition-transform duration-500"
                  sizes="(max-width: 1024px) 100vw, 25vw"
                />
              </div>
            )}
            <div className="relative p-6 sm:p-7">
              <p className="text-2xl sm:text-[1.7rem] leading-snug font-semibold text-white max-w-[17rem] drop-shadow-[0_1px_2px_rgba(15,60,100,0.35)]">
                Тематические коллекции шаров для любого повода
              </p>
            </div>
            <span className="absolute left-6 sm:left-7 bottom-6 text-base font-semibold text-white bg-white/25 backdrop-blur-sm rounded-full px-4 py-1.5 group-hover:bg-white/40 transition-colors">
              Все коллекции →
            </span>
          </Link>

          {tiles.map((t) => (
            <Link key={t.slug} href={`/collections/${t.slug}`} className="group flex flex-col text-center">
              <div className="relative w-full aspect-square rounded-xl bg-gray-50 overflow-hidden">
                {t.cover && (
                  <Image
                    src={t.cover}
                    alt={t.name}
                    fill
                    unoptimized={t.cover.startsWith("http") || t.cover.endsWith(".svg")}
                    className={`${t.cover.startsWith("/collections/db/") ? "object-contain p-3" : "object-cover"} group-hover:scale-105 transition-transform duration-300`}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 14vw"
                  />
                )}
              </div>
              <p className="mt-3 text-sm sm:text-base font-medium text-slate-700 group-hover:text-sky-600 transition-colors">
                {t.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
