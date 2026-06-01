const occasions = [
  { label: "День рождения", emoji: "🎂", href: "#catalog" },
  { label: "Свадьба", emoji: "💍", href: "#catalog" },
  { label: "Выпускной", emoji: "🎓", href: "#catalog" },
  { label: "Корпоратив", emoji: "🏢", href: "#catalog" },
  { label: "Детский праздник", emoji: "🧸", href: "#catalog" },
  { label: "Новый год", emoji: "🎄", href: "#catalog" },
];

export default function Occasions() {
  return (
    <section className="py-8 bg-gray-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 text-center">
          Выберите повод
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {occasions.map((o) => (
            <a
              key={o.label}
              href={o.href}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-sky-300 hover:text-sky-600 text-gray-700 text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all"
            >
              <span className="text-lg">{o.emoji}</span>
              {o.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
