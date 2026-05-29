const photos = [
  { emoji: "🎈", bg: "from-orange-100 to-yellow-50", label: "Латексные шары" },
  { emoji: "💜", bg: "from-pink-100 to-purple-100", label: "Праздничное оформление" },
  { emoji: "🎡", bg: "from-blue-100 to-sky-50", label: "Воздушные шары" },
];

export default function About() {
  return (
    <section id="about" className="py-20 bg-[#e8f4f8]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">
          О нас
        </h2>
        <p className="text-gray-500 text-center max-w-xl mx-auto mb-12 leading-relaxed">
          На этой странице вы узнаете об истории нашего магазина воздушных шаров и принципах его работы.
          Мы стремимся предоставить нашим клиентам высококачественную продукцию и лучший сервис.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {photos.map((p) => (
            <div
              key={p.label}
              className={`h-56 rounded-2xl bg-gradient-to-br ${p.bg} flex items-center justify-center`}
            >
              <span className="text-7xl">{p.emoji}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
