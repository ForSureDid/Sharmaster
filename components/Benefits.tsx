const benefits = [
  {
    title: "Широкий ассортимент",
    desc: "В наличии более 100 видов воздушных шаров для любых целей и мероприятий.",
  },
  {
    title: "Высокое качество продукции",
    desc: "Используем только качественные и проверенные шары.",
  },
  {
    title: "Удобство заказа",
    desc: "Оформить заказ можно в любое удобное время, а также получить консультацию по ассортименту и услугам.",
  },
  {
    title: "Индивидуальный подход",
    desc: "Учитываем все пожелания клиентов и предлагаем индивидуальные решения для каждого заказа.",
  },
];

export default function Benefits() {
  return (
    <section id="services" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">
          Преимущества
        </h2>
        <p className="text-gray-500 text-center max-w-xl mx-auto mb-14 leading-relaxed">
          Предлагаем широкий ассортимент качественных воздушных шаров ярких цветов и долговечности, а также выгодные условия для оптовиков.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {benefits.map((b) => (
            <div key={b.title} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-full bg-teal-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{b.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
