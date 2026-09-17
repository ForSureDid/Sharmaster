import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";

type KitCard = { slug: string; price: number; image: string | null };

// Self-contained on purpose (queries Kit directly rather than going through
// lib/kits.ts's getKitBySlug/getKitById) — that file resolves a kit's full,
// live-priced composition, which this homepage teaser doesn't need and
// shouldn't have to pull in just to show a photo + price. Real kits fill
// slots 1..N in creation order; remaining slots up to 4 render as "coming
// soon" placeholders — Mirasbek 2026-09-17: only kit #1 exists so far.
async function getHomepageKits(): Promise<(KitCard | null)[]> {
  const rows = await db.kit.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 4,
    select: { slug: true, price: true, images: true },
  });
  const real: KitCard[] = rows.map((r) => ({
    slug: r.slug,
    price: Number(r.price),
    image: r.images[0] ?? null,
  }));
  const placeholders: null[] = Array(Math.max(0, 4 - real.length)).fill(null);
  return [...real, ...placeholders];
}

function RealKitCard({ kit, label, wide }: { kit: KitCard; label: string; wide?: boolean }) {
  return (
    <Link href={`/kits/${kit.slug}`} className="group h-full flex flex-col">
      <div className={`relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group-hover:border-sky-200 group-hover:shadow-md transition-all md:flex-1 ${wide ? "aspect-[2/1]" : "aspect-square"}`}>
        {kit.image ? (
          <Image
            src={kit.image}
            alt={label}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes={wide || label === "Набор 1" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-sky-50">
            <svg className="w-10 h-10 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-700 group-hover:text-sky-600 transition-colors">{label}</span>
        <span className="text-sm font-bold text-gray-800 flex-shrink-0">{kit.price.toLocaleString("ru-RU")} ₸</span>
      </div>
      <span className="text-xs text-gray-400 group-hover:text-sky-500 transition-colors">Подробнее →</span>
    </Link>
  );
}

function PlaceholderKitCard({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className="h-full flex flex-col" aria-hidden>
      <div className={`relative rounded-2xl overflow-hidden bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center md:flex-1 ${wide ? "aspect-[2/1]" : "aspect-square"}`}>
        <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <span className="absolute top-2 left-2 bg-gray-200 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
          Скоро
        </span>
      </div>
      {/* Same two-line caption shape as RealKitCard (name+price, then a link line) so a
          placeholder sitting next to a real card never throws off the row's image height. */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-400">{label}</span>
        <span className="text-sm font-bold text-gray-300 flex-shrink-0">Скоро</span>
      </div>
      <span className="text-xs text-transparent select-none">—</span>
    </div>
  );
}

export default async function StarterKitsSection() {
  const [main, second, third, fourth] = await getHomepageKits();

  return (
    <section className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Стартовые наборы для аэродизайнеров</h2>
          <p className="mt-1.5 text-sm text-gray-500 max-w-2xl">
            Всё необходимое для оформления уже собрано в одном наборе — выбирайте готовое решение и добавляйте его в корзину одним нажатием.
          </p>
        </div>

        {/* Bento grid: main kit is a 2x2 block (square), kits 2/3 are 1x1 squares
            stacked above kit 4 (a 2x1 wide block) — see the ASCII layout Mirasbek
            sent 2026-09-17. Named grid-areas keep one shared markup for both the
            mobile 2-col stack and the desktop 4x2 bento, no duplicated JSX. */}
        <div
          className="grid grid-cols-2 gap-4 md:gap-5 md:grid-cols-4 md:grid-rows-2 md:aspect-[2/1]
            [grid-template-areas:'main_main'_'k2_k3'_'k4_k4']
            md:[grid-template-areas:'main_main_k2_k3'_'main_main_k4_k4']"
        >
          <div style={{ gridArea: "main" }}>
            {main ? <RealKitCard kit={main} label="Набор 1" /> : <PlaceholderKitCard label="Набор 1" />}
          </div>
          <div style={{ gridArea: "k2" }}>
            {second ? <RealKitCard kit={second} label="Набор 2" /> : <PlaceholderKitCard label="Набор 2" />}
          </div>
          <div style={{ gridArea: "k3" }}>
            {third ? <RealKitCard kit={third} label="Набор 3" /> : <PlaceholderKitCard label="Набор 3" />}
          </div>
          <div style={{ gridArea: "k4" }}>
            {fourth ? <RealKitCard kit={fourth} label="Набор 4" wide /> : <PlaceholderKitCard label="Набор 4" wide />}
          </div>
        </div>
      </div>
    </section>
  );
}
