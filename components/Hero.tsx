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

      {/* Centered logo + intro text — no banner image */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 flex flex-col items-center text-center">
          <Image
            src="/logo-nobg.png"
            alt="Sharmaster"
            width={480}
            height={240}
            className="h-[120px] sm:h-[160px] md:h-[220px] w-auto mb-6"
            priority
          />

          <p className="text-sky-500 text-sm font-semibold mb-3 uppercase tracking-widest">
            Оптовый магазин
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-800 leading-tight mb-5 max-w-2xl">
            Воздушные шары оптом в Казахстане
          </h1>
          <p className="text-gray-500 text-base md:text-lg mb-8 leading-relaxed max-w-lg">
            Более 10000 наименований для любого праздника — латексные, фольгированные, аксессуары.
            Быстрая доставка по всему Казахстану.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
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

      {/* Info strip — white */}
      <div className="bg-white border-t border-gray-100">
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
