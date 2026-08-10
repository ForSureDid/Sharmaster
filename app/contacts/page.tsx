import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";

const hours = [
  { day: "Пн", time: "10:00–19:00" },
  { day: "Вт", time: "10:00–19:00" },
  { day: "Ср", time: "10:00–19:00" },
  { day: "Чт", time: "10:00–19:00" },
  { day: "Пт", time: "10:00–19:00" },
  { day: "Сб", time: "10:00–19:00" },
  { day: "Вс", time: "10:00–19:00" },
];

function ArrowIcon() {
  return (
    <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ContactButton({
  href,
  iconBg,
  icon,
  title,
  subtitle,
}: {
  href: string;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 bg-white rounded-3xl border border-gray-100 p-5 sm:p-6 hover:border-gray-200 hover:shadow-md transition-all"
    >
      <div
        className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base sm:text-lg font-bold text-gray-800">{title}</p>
        <p className="text-sm text-gray-400 truncate">{subtitle}</p>
      </div>
      <ArrowIcon />
    </a>
  );
}

export default function ContactsPage() {
  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium">Контакты</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="mb-8 max-w-2xl">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Контакты</h1>
            <p className="text-sm text-gray-400">
              Свяжитесь с нами удобным способом — ответим быстро.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <ContactButton
              href="tel:+77769510282"
              iconBg="bg-sky-500"
              title="Позвонить"
              subtitle="+7 776 951 0282"
              icon={
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              }
            />

            <ContactButton
              href="https://wa.me/77769510282"
              iconBg="bg-[#25D366]"
              title="WhatsApp"
              subtitle="Написать нам в мессенджер"
              icon={
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.526 5.845L.057 23.428a.5.5 0 00.514.572l5.701-1.496A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.503-5.237-1.382l-.376-.214-3.882 1.019.993-3.786-.234-.389A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
              }
            />

            <ContactButton
              href="https://www.instagram.com/sharoptom.kz/"
              iconBg="bg-gradient-to-br from-[#FEDA75] via-[#D62976] to-[#4F5BD5]"
              title="Instagram"
              subtitle="@sharoptom.kz"
              icon={
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              }
            />

            <ContactButton
              href="https://go.2gis.com/tvVMM"
              iconBg="bg-[#12C956]"
              title="2ГИС"
              subtitle="Найти нас на карте"
              icon={
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s7-6.686 7-12A7 7 0 105 10c0 5.314 7 12 7 12z" />
                  <circle cx="12" cy="10" r="2.5" strokeWidth={1.8} />
                </svg>
              }
            />
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8">
            <h2 className="text-sm font-bold text-gray-800 mb-4">График работы</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {hours.map((h) => (
                <div key={h.day} className="bg-gray-50 rounded-xl border border-gray-100 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{h.day}</p>
                  <p className="text-xs text-gray-700">{h.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
