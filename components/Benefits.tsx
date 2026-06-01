const benefits = [
  {
    title: "Широкий ассортимент",
    desc: "Более 500 видов воздушных шаров — латексные, фольгированные, хром, металлик.",
    icon: "🎈",
  },
  {
    title: "Высокое качество",
    desc: "Работаем только с проверенными производителями. Гарантия качества каждого товара.",
    icon: "✅",
  },
  {
    title: "Удобный заказ",
    desc: "Оформите заказ через WhatsApp или Instagram в любое удобное время.",
    icon: "📱",
  },
  {
    title: "Индивидуальный подход",
    desc: "Учитываем все пожелания — поможем подобрать шары для любого события.",
    icon: "🤝",
  },
];

export default function Benefits() {
  return (
    <section id="services" className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800">Почему выбирают нас</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b) => (
            <div key={b.title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all">
              <div className="text-3xl mb-3">{b.icon}</div>
              <h3 className="font-bold text-gray-800 mb-2 text-base">{b.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
