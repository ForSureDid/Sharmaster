const categories = [
  {
    title: "Латексные шары",
    subtitle: "Широкий выбор цветов и размеров",
    emoji: "🎈",
    bg: "from-red-100 to-yellow-50",
  },
  {
    title: "Фольгированные шары",
    subtitle: "Фигурные шары для особых событий",
    emoji: "⭐",
    bg: "from-pink-100 to-purple-50",
  },
  {
    title: "Гелий и оборудование",
    subtitle: "Гелий и оборудование для шаров",
    emoji: "🫧",
    bg: "from-blue-100 to-teal-50",
  },
];

export default function Categories() {
  return (
    <section id="catalog" className="py-20 bg-[#e8f4f8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-800 text-center mb-12">
          Категории товаров
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.title}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            >
              {/* Image placeholder */}
              <div className={`h-52 bg-gradient-to-br ${cat.bg} flex items-center justify-center`}>
                <span className="text-8xl group-hover:scale-110 transition-transform duration-300">
                  {cat.emoji}
                </span>
              </div>
              {/* Text */}
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-1">{cat.subtitle}</p>
                <h3 className="text-xl font-bold text-gray-800">{cat.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
