const categories = [
  {
    title: "Шары латексные",
    subtitle: "Круглые, пастель, хром, металлик",
    emoji: "🎈",
    bg: "from-red-100 to-orange-50",
    count: "200+ видов",
    href: "#catalog",
  },
  {
    title: "Шары фольгированные",
    subtitle: "Цифры, звёзды, фигуры, сердца",
    emoji: "⭐",
    bg: "from-yellow-100 to-amber-50",
    count: "150+ видов",
    href: "#catalog",
  },
  {
    title: "Гелий и оборудование",
    subtitle: "Баллоны, насосы, клей, нитки",
    emoji: "🫧",
    bg: "from-blue-100 to-sky-50",
    count: "30+ товаров",
    href: "#catalog",
  },
  {
    title: "Аксессуары",
    subtitle: "Ленты, конфетти, украшения",
    emoji: "🎀",
    bg: "from-pink-100 to-purple-50",
    count: "50+ видов",
    href: "#catalog",
  },
];

export default function Categories() {
  return (
    <section id="catalog" className="py-10 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Категории товаров</h2>
          <a href="#catalog" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все категории →
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <a
              key={cat.title}
              href={cat.href}
              className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all"
            >
              <div className={`h-36 bg-gradient-to-br ${cat.bg} flex items-center justify-center`}>
                <span className="text-6xl group-hover:scale-110 transition-transform duration-300">
                  {cat.emoji}
                </span>
              </div>
              <div className="p-4">
                <p className="text-[11px] text-sky-500 font-semibold mb-0.5 uppercase tracking-wide">{cat.count}</p>
                <h3 className="text-base font-bold text-gray-800 leading-tight">{cat.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{cat.subtitle}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
