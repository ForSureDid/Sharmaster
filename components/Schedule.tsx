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
    <section id="schedule" className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800">Контакты и режим работы</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Hours */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-4">График работы</h3>
            <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
              {hours.map((h, i) => (
                <div
                  key={h.day}
                  className={`flex justify-between items-center px-4 py-3 text-sm ${i !== hours.length - 1 ? "border-b border-gray-100" : ""}`}
                >
                  <span className="font-medium text-gray-700 w-8">{h.day}</span>
                  <span className={h.time === "Выходной" ? "text-red-500 font-medium" : "text-gray-600"}>
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              * Выходные дни уточняйте по телефону
            </p>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-4">Контакты</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Телефон</p>
                <a href="tel:+77769370282" className="text-xl font-bold text-gray-800 hover:text-sky-500 transition-colors">
                  +7 776 937 0282
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://wa.me/77769370282"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border border-green-100 rounded-xl p-4 transition-colors"
                >
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.526 5.845L.057 23.428a.5.5 0 00.514.572l5.701-1.496A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.503-5.237-1.382l-.376-.214-3.882 1.019.993-3.786-.234-.389A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-400">Мессенджер</p>
                    <p className="text-sm font-semibold text-gray-700">WhatsApp</p>
                  </div>
                </a>
                <a
                  href="https://www.instagram.com/sharoptom.kz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 border border-pink-100 rounded-xl p-4 transition-colors"
                >
                  <svg className="w-5 h-5 text-pink-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-400">Соцсеть</p>
                    <p className="text-sm font-semibold text-gray-700">Instagram</p>
                  </div>
                </a>
              </div>

              {/* Map placeholder */}
              <div className="h-36 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm border border-gray-100">
                📍 Казахстан — уточните адрес по телефону
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
