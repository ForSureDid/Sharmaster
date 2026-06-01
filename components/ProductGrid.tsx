const products = [
  { name: "Шар латексный 12\" пастель белый", price: 15, unit: "шт", isNew: false, old: null, bg: "from-gray-100 to-slate-50", emoji: "⚪" },
  { name: "Шар латексный 12\" пастель ассорти", price: 18, unit: "шт", isNew: true, old: null, bg: "from-red-100 to-orange-50", emoji: "🔴" },
  { name: "Шар фольга \"Звезда\" 18\"", price: 350, unit: "шт", isNew: false, old: 450, bg: "from-yellow-100 to-amber-50", emoji: "⭐" },
  { name: "Шар фольга \"Сердце\" 18\"", price: 480, unit: "шт", isNew: true, old: null, bg: "from-pink-100 to-red-50", emoji: "❤️" },
  { name: "Шар фольга цифра \"1\"", price: 800, unit: "шт", isNew: false, old: 950, bg: "from-purple-100 to-violet-50", emoji: "1️⃣" },
  { name: "Набор латексных шаров пастель (10 шт)", price: 160, unit: "набор", isNew: false, old: null, bg: "from-blue-100 to-sky-50", emoji: "🎈" },
  { name: "Шар хром золото 12\"", price: 45, unit: "шт", isNew: true, old: null, bg: "from-yellow-100 to-yellow-50", emoji: "🟡" },
  { name: "Лента декоративная (50 м)", price: 200, unit: "рулон", isNew: false, old: 280, bg: "from-green-100 to-emerald-50", emoji: "🎀" },
];

export default function ProductGrid() {
  return (
    <section className="py-10 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Популярные товары</h2>
          <a href="#catalog" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все товары →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <div
              key={p.name}
              className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all group flex flex-col"
            >
              {/* Image area */}
              <div className={`relative h-40 bg-gradient-to-br ${p.bg} flex items-center justify-center`}>
                <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{p.emoji}</span>
                {p.isNew && (
                  <span className="absolute top-2 left-2 bg-sky-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Новинка
                  </span>
                )}
                {p.old && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Акция
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col flex-1">
                <p className="text-xs text-gray-500 leading-snug mb-2 flex-1">{p.name}</p>

                <div className="flex items-end justify-between gap-2 mt-auto">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-red-600">{p.price} ₸</span>
                      <span className="text-[11px] text-gray-400">/{p.unit}</span>
                    </div>
                    {p.old && (
                      <span className="text-xs text-gray-400 line-through">{p.old} ₸</span>
                    )}
                  </div>
                  <button className="flex-shrink-0 w-8 h-8 bg-sky-400 hover:bg-sky-500 text-white rounded-lg flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
