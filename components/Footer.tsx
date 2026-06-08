import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Image
              src="/logo-nobg.png"
              alt="Sharmaster"
              width={200}
              height={70}
              className="h-[70px] w-auto mb-4"
            />
            <p className="text-sm leading-relaxed text-gray-500">
              Оптовый магазин воздушных шаров в Казахстане. Более 10000 видов товаров для любого праздника.
            </p>
          </div>

          {/* Catalog */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Каталог</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#catalog" className="hover:text-white transition-colors">Шары латексные</a></li>
              <li><a href="#catalog" className="hover:text-white transition-colors">Шары фольгированные</a></li>
              <li><a href="#catalog" className="hover:text-white transition-colors">Гелий и оборудование</a></li>
              <li><a href="#catalog" className="hover:text-white transition-colors">Аксессуары</a></li>
              <li><a href="#catalog" className="hover:text-white transition-colors">Акции</a></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Информация</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#about" className="hover:text-white transition-colors">О магазине</a></li>
              <li><a href="#schedule" className="hover:text-white transition-colors">График работы</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Преимущества</a></li>
              <li><a href="#schedule" className="hover:text-white transition-colors">Контакты</a></li>
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Контакты</h4>
            <div className="space-y-3 text-sm">
              <div>
                <a href="tel:+77769510282" className="text-white font-medium text-base hover:text-violet-300 transition-colors">
                  +7 776 951 0282
                </a>
              </div>
              <div className="flex gap-3">
                <a href="https://wa.me/77769510282" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.526 5.845L.057 23.428a.5.5 0 00.514.572l5.701-1.496A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.503-5.237-1.382l-.376-.214-3.882 1.019.993-3.786-.234-.389A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                  WhatsApp
                </a>
                <a href="https://www.instagram.com/sharoptom.kz/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <p>© 2025 Sharmaster.kz — Оптовый магазин воздушных шаров</p>
          <p>Казахстан</p>
        </div>
      </div>
    </footer>
  );
}
