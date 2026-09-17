import Image from "next/image";

// Replaces the old 4-card "Почему выбирают нас" grid with Mirasbek's
// pre-designed banner (2026-09-17) — see "All the Files with material
// here/Почему нас.png", copied to public/banners/banner-9-pochemu-nas.png and
// cropped there to trim ~33px of blank space the source file had at the top
// (source file itself left untouched). Bump IMG_VERSION if that file is ever
// replaced, same convention as Hero.tsx.
const IMG_VERSION = 3;

export default function Benefits() {
  return (
    <section id="services" className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative w-full aspect-[1606/585] rounded-2xl overflow-hidden">
          <Image
            src={`/banners/banner-9-pochemu-nas.png?v=${IMG_VERSION}`}
            alt="Почему выбирают Sharmaster.kz — большой выбор, оптовые цены, всё в наличии, быстрая доставка"
            fill
            className="object-contain"
            sizes="(max-width: 1280px) 100vw, 1280px"
          />
        </div>
      </div>
    </section>
  );
}
