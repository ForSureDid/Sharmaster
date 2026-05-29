const hours = [
  { day: "Пн", time: "Выходной" },
  { day: "Вт", time: "10:00–19:00" },
  { day: "Ср", time: "10:00–19:00" },
  { day: "Чт", time: "10:00–19:00" },
  { day: "Пт", time: "10:00–19:00" },
  { day: "Сб", time: "10:00–19:00" },
  { day: "Вс", time: "10:00–19:00" },
];

export default function Schedule() {
  return (
    <section id="schedule" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Hours */}
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">График работы</h2>
            <div className="space-y-2">
              {hours.map((h) => (
                <div key={h.day} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-700">{h.day}</span>
                  <span className={h.time === "Выходной" ? "text-red-400" : "text-gray-600"}>
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-red-400">
              Выходные дни уточните по контактному номеру!
            </p>
          </div>

          {/* Contacts */}
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Контакты</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Телефон для связи</p>
                <a href="tel:+77769510282"
                  className="text-xl font-semibold text-gray-800 hover:text-teal-500 transition-colors">
                  +7 776 951 0282
                </a>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">WhatsApp</p>
                <a href="https://wa.me/77769370282" target="_blank" rel="noopener noreferrer"
                  className="text-teal-500 hover:underline font-medium">
                  Написать в WhatsApp
                </a>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Instagram</p>
                <a href="https://instagram.com/sharmaster.kz" target="_blank" rel="noopener noreferrer"
                  className="text-teal-500 hover:underline font-medium">
                  @sharmaster.kz
                </a>
              </div>
            </div>

            {/* Map placeholder */}
            <div className="mt-6 h-48 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
              📍 Карта — добавьте iframe Яндекс.Карт
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
