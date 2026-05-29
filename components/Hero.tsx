import Image from "next/image";

export default function Hero() {
  return (
    <section className="pt-16 min-h-screen flex flex-col items-center justify-center bg-[#c8c8c8] relative overflow-hidden">
      <div className="text-center px-4 z-10 flex flex-col items-center gap-6">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 leading-tight">
          Оптовый магазин воздушных шаров
        </h1>
        <p className="text-gray-600 text-lg max-w-md leading-relaxed">
          Широкий ассортимент шаров для любого праздника.<br />
          Качество, доступные цены и быстрая доставка по всему<br />
          Казахстану.
        </p>
        <a
          href="#catalog"
          className="inline-flex items-center gap-2 px-8 py-3 bg-white/80 hover:bg-white text-gray-700 font-medium rounded-full shadow-sm transition-all hover:shadow-md"
        >
          <span>🎈</span>
          Перейти в каталог
        </a>
      </div>

      {/* Big logo at bottom */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none select-none flex justify-center">
        <Image
          src="/logo.png"
          alt="Sharmaster"
          width={900}
          height={260}
          className="w-full max-w-4xl opacity-90"
          priority
        />
      </div>
    </section>
  );
}
