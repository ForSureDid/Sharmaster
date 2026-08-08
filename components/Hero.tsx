"use client";

import { useState } from "react";
import Image from "next/image";

type Slide = {
  key: string;
  href: string;
  bgClass: string;
  content: React.ReactNode;
};

const DONBALLON_BRANDS_HREF = `/catalog?brand=${encodeURIComponent("Falali,Волна веселья,Дон Баллон")}`;
const SENTYABRA_HREF = `/catalog?occasion=${encodeURIComponent("1 Сентября")}`;
const SEMPERTEX_HREF = `/catalog?brand=${encodeURIComponent("Sempertex S.A.")}`;

const SLIDES: Slide[] = [
  {
    key: "main",
    href: "#catalog",
    bgClass: "bg-gradient-to-r from-sky-100 via-pink-50 to-green-50",
    content: (
      <>
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-sky-200/40 pointer-events-none" />
        <div className="absolute -bottom-10 right-40 w-48 h-48 rounded-full bg-pink-200/30 pointer-events-none" />
        <div className="absolute top-6 left-1/3 w-24 h-24 rounded-full bg-yellow-100/50 pointer-events-none" />

        <div className="hidden lg:block absolute left-[42%] right-0 top-0 bottom-0 pointer-events-none select-none">
          <Image src="/logo-nobg.png" alt="Sharmaster" fill className="object-contain object-center" priority />
        </div>

        <div className="relative max-w-xl">
          <p className="text-sky-500 text-sm font-semibold mb-3 uppercase tracking-widest">
            Оптовый магазин
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-800 leading-tight mb-5">
            Воздушные шары<br className="hidden sm:block" /> оптом в Казахстане
          </h1>
          <p className="text-gray-500 text-base md:text-lg mb-8 leading-relaxed max-w-lg">
            Более 10000 наименований для любого праздника —<br className="hidden md:block" />
            латексные, фольгированные, аксессуары.<br className="hidden md:block" />
            Быстрая доставка по всему Казахстану.
          </p>
          <span className="inline-block px-6 py-3 bg-sky-400 text-white font-bold rounded-xl shadow-sm">
            Перейти в каталог
          </span>
        </div>
      </>
    ),
  },
  {
    key: "donballon",
    href: DONBALLON_BRANDS_HREF,
    bgClass: "bg-gradient-to-r from-rose-50 via-white to-orange-50",
    content: (
      <>
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-rose-200/30 pointer-events-none" />
        <div className="absolute -top-10 right-24 w-40 h-40 rounded-full bg-orange-100/40 pointer-events-none" />

        <div className="relative flex items-center gap-6 md:gap-10 w-full">
          <div className="relative w-28 h-32 sm:w-36 sm:h-40 md:w-44 md:h-48 flex-shrink-0">
            <Image src="/banners/donballon-mascot.png" alt="Дон Баллон" fill className="object-contain" />
          </div>
          <div className="max-w-lg">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 leading-snug mb-3">
              Официальные партнёры брендов<br className="hidden sm:block" />
              <span className="text-rose-500">Falali</span>,{" "}
              <span className="text-lime-600">Волна Веселья</span> и{" "}
              <span className="text-rose-500">Дон Баллон</span>
            </h2>
            <span className="inline-block px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-sm transition-colors">
              Смотреть
            </span>
          </div>
        </div>
      </>
    ),
  },
  {
    key: "sentyabr",
    href: SENTYABRA_HREF,
    bgClass: "bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50",
    content: (
      <>
        <div className="absolute -top-14 -left-14 w-56 h-56 rounded-full bg-amber-200/30 pointer-events-none" />
        <div className="absolute -bottom-12 right-10 w-44 h-44 rounded-full bg-orange-200/30 pointer-events-none" />

        <div className="relative flex items-center gap-6 md:gap-10 w-full">
          <div className="max-w-lg">
            <p className="text-orange-500 text-sm font-semibold mb-2 uppercase tracking-widest">
              Коллекция ко Дню Знаний
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-800 leading-tight mb-5">
              Снова в школу!
            </h2>
            <span className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm transition-colors">
              Смотреть
            </span>
          </div>
          <div className="relative flex-1 h-32 sm:h-40 md:h-48 hidden sm:block">
            <Image
              src="/occasions/1_sentyabra.webp"
              alt="1 Сентября"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </>
    ),
  },
  {
    key: "sempertex",
    href: SEMPERTEX_HREF,
    bgClass: "bg-gradient-to-r from-violet-50 via-purple-50 to-white",
    content: (
      <>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-violet-200/30 pointer-events-none" />
        <div className="absolute -top-10 left-16 w-36 h-36 rounded-full bg-purple-100/40 pointer-events-none" />

        <div className="relative flex items-center gap-6 md:gap-10 w-full">
          <div className="relative w-40 h-14 sm:w-56 sm:h-20 md:w-64 md:h-24 flex-shrink-0">
            <Image src="/brands/sempertex.png" alt="Sempertex" fill className="object-contain object-left" />
          </div>
          <div className="max-w-lg">
            <p className="text-violet-700 text-sm md:text-base font-medium leading-relaxed mb-5">
              100% натуральный латекс из сока каучукового дерева. Безопасны, биоразлагаемы
              и долго держат гелий — латексные шары Sempertex всех размеров.
            </p>
            <span className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-sm transition-colors">
              Смотреть
            </span>
          </div>
        </div>
      </>
    ),
  },
];

export default function Hero() {
  const [index, setIndex] = useState(0);

  function prev() {
    setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }
  function next() {
    setIndex((i) => (i + 1) % SLIDES.length);
  }

  return (
    <section className="pt-[90px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="relative rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {SLIDES.map((slide) => (
              <a
                key={slide.key}
                href={slide.href}
                className={`relative w-full flex-shrink-0 flex items-center min-h-[420px] sm:min-h-[300px] md:min-h-[280px] px-6 sm:px-10 md:px-14 py-10 overflow-hidden ${slide.bgClass}`}
              >
                {slide.content}
              </a>
            ))}
          </div>

          <div className="absolute bottom-4 left-4 flex gap-2 z-10">
            <button
              type="button"
              onClick={prev}
              aria-label="Предыдущий баннер"
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Следующий баннер"
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Info strip — white */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
