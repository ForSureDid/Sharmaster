const photos = [
  { emoji: "🎈", bg: "from-orange-100 to-yellow-50", label: "Латексные шары" },
  { emoji: "💜", bg: "from-pink-100 to-purple-100", label: "Фольгированные шары" },
  { emoji: "🎡", bg: "from-blue-100 to-sky-50", label: "Праздничное оформление" },
];

export default function About() {
  return (
    <section id="about" className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">О нас</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-gray-600 leading-relaxed mb-4">
              Sharmaster — оптовый магазин воздушных шаров в Казахстане. Мы работаем с организаторами
              праздников, декораторами, магазинами и частными покупателями.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              В нашем ассортименте более 10000 наименований товаров: латексные и фольгированные шары,
              гелий, оборудование и аксессуары для оформления. Гарантируем качество и доступные оптовые цены.
            </p>
            <a
              href="https://wa.me/77769510282"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Связаться с нами
            </a>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {photos.map((p) => (
              <div
                key={p.label}
                className={`h-40 rounded-2xl bg-gradient-to-br ${p.bg} flex flex-col items-center justify-center gap-2`}
              >
                <span className="text-5xl">{p.emoji}</span>
                <span className="text-xs text-gray-500 font-medium text-center px-2 leading-tight">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
