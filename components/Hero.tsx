import Image from "next/image";

export default function Hero() {
  return (
    <section className="pt-[90px]">
      {/* Beta notice strip */}
      <div className="bg-amber-50 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-2 text-sm text-amber-700">
          <span>🚧</span>
          <span>
            Сайт работает в тестовом режиме — будем рады вашим отзывам.{" "}
            <a
              href="#feedback"
              className="underline underline-offset-2 hover:text-amber-900 font-medium"
            >
              Оставить отзыв
            </a>
          </span>
        </div>
      </div>

      {/* Main banner — pastel gradient matching logo colors */}
      <div className="bg-gradient-to-r from-sky-100 via-pink-50 to-green-50 relative overflow-hidden">
        {/* Decorative soft circles */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-sky-200/40 pointer-events-none" />
        <div className="absolute -bottom-10 right-40 w-48 h-48 rounded-full bg-pink-200/30 pointer-events-none" />
        <div className="absolute top-6 left-1/3 w-24 h-24 rounded-full bg-yellow-100/50 pointer-events-none" />

        {/* Right: logo — absolute, spans full banner height, centered in right half */}
        <div className="hidden lg:block absolute left-[38%] right-0 top-0 bottom-0 pointer-events-none select-none">
          <Image
            src="/logo-nobg.png"
            alt="Sharmaster"
            fill
            className="object-contain object-center"
            priority
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          {/* Left content */}
          <div className="z-10 max-w-xl">
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
            <div className="flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="px-6 py-3 bg-sky-400 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                Перейти в каталог
              </a>
              <a
                href="https://wa.me/77769510282"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors border border-gray-200 shadow-sm"
              >
                Написать нам
              </a>
            </div>
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
