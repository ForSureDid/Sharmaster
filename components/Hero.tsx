"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Slide = {
  key: string;
  href: string;
  image: string;
  alt: string;
};

// Banner artwork is final, pre-designed (see "All the Files with material
// here/1.png..4.png") — this component only handles the slider mechanics
// (slides, arrows, dots, links), not the visual design of each banner.
// `v=` cache-busts the static /public asset so a re-uploaded banner with the
// same filename doesn't keep serving a stale cached copy — bump it whenever
// any of these images is replaced.
const IMG_VERSION = 2;
// Order below is deliberate (not file-number order) — banner-8 leads, then
// banner-3, then the rest in their prior relative order. Re-order here only
// on explicit request.
const SLIDES: Slide[] = [
  {
    key: "magicmax",
    href: `/catalog?q=${encodeURIComponent("Magic Max")}`,
    image: `/banners/banner-8-magicmax.png?v=${IMG_VERSION}`,
    alt: "MagicMax — новая линейка полимерного геля для шаров, ожидайте поступления",
  },
  {
    key: "sentyabr",
    href: `/catalog?occasion=${encodeURIComponent("1 Сентября")}`,
    image: `/banners/banner-3-1sentyabrya.png?v=${IMG_VERSION}`,
    alt: "Снова в школу! Коллекция ко Дню Знаний",
  },
  {
    key: "giant-heart",
    href: "/catalog/gigant-serdtse-2-5-m-krasnyy-g",
    image: `/banners/banner-7-giant-heart.png?v=${IMG_VERSION}`,
    alt: "Гигантское сердце 2.5 м — спец размер для ярких событий и фотозон",
  },
  {
    key: "bk-sale",
    href: `/catalog?brand=${encodeURIComponent("БиКей")}&akcii=1`,
    image: `/banners/banner-6-bk-sale.png?v=${IMG_VERSION}`,
    alt: "Большая распродажа — 25% на всю шёлкографию БиКей",
  },
  {
    key: "512",
    href: `/catalog?brand=${encodeURIComponent("512")}`,
    image: `/banners/banner-5-512.png?v=${IMG_VERSION}`,
    alt: "512 Шар — универсальный шар и полимерный гель для обработки",
  },
  {
    key: "main",
    href: "#catalog",
    image: `/banners/banner-1-main.png?v=${IMG_VERSION}`,
    alt: "Sharmaster.kz — воздушные шары оптом в Казахстане",
  },
  {
    key: "donballon",
    href: `/catalog?brand=${encodeURIComponent("Falali,Волна веселья,Дон Баллон")}`,
    image: `/banners/banner-2-donballon.png?v=${IMG_VERSION}`,
    alt: "Официальные партнёры торговой компании «Дон Баллон»",
  },
  {
    key: "sempertex",
    href: `/catalog?brand=${encodeURIComponent("Sempertex S.A.")}`,
    image: `/banners/banner-4-sempertex.png?v=${IMG_VERSION}`,
    alt: "Sempertex — The World's Best Balloons",
  },
];

const SWIPE_THRESHOLD_PX = 40;
const AUTOPLAY_MS = 3000;

export default function Hero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function prev() {
    setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }
  function next() {
    setIndex((i) => (i + 1) % SLIDES.length);
  }

  // Auto-advance every 3s, looping back to the first slide; pauses on
  // hover/touch and restarts from a manual arrow/dot click or swipe.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, index]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta > SWIPE_THRESHOLD_PX) prev();
    else if (delta < -SWIPE_THRESHOLD_PX) next();
  }

  return (
    <section className="pt-[90px]">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div
          className="relative rounded-2xl overflow-hidden border-2 border-gray-300/50"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {SLIDES.map((slide) => (
              <a
                key={slide.key}
                href={slide.href}
                className="relative block w-full flex-shrink-0 aspect-[1680/720]"
              >
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  priority={slide.key === "main"}
                />
              </a>
            ))}
          </div>

          {/* Navigation — separate DOM elements layered over the banner image,
              not part of the artwork; sibling of the slide links so a click here
              never triggers the banner's own href. */}
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex gap-2 z-10">
            <button
              type="button"
              onClick={prev}
              aria-label="Предыдущий баннер"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Следующий баннер"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Pagination dots — current slide indicator, also directly clickable. */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 sm:bottom-4 flex gap-1.5 z-10">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Баннер ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ring-2 ring-white/80 shadow-sm ${
                  i === index ? "w-5 bg-gray-700" : "w-2 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Info strip — white */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center md:justify-between gap-4 py-3 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <span className="text-sky-400 font-bold">✓</span> Более 10000 наименований
            </span>
            <span className="flex items-center gap-2">
              <span className="text-pink-400 font-bold">✓</span> Оптовые цены
            </span>
            <span className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold">✓</span> Доставка по Казахстану
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400 font-bold">✓</span> Работаем с организациями
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
