import Image from "next/image";

type Entry = {
  title: string;
  subtitle: string;
  icon: string;
  href: string;
};

const CATEGORIES: Entry[] = [
  { title: "Воздушные шары из латекса", subtitle: "Круглые, пастель, хром, металлик", icon: "/icons/latex-balloons.png", href: "/catalog?cat=vozdushnye-shary-iz-lateksa" },
  { title: "Воздушные шары из фольги", subtitle: "Цифры, звёзды, фигуры, сердца", icon: "/icons/foil-balloons.png", href: "/catalog?cat=vozdushnye-shary-iz-folgi" },
  { title: "Оборудование и аксессуары", subtitle: "Баллоны, насосы, клей, нитки", icon: "/icons/equipment-helium.png", href: "/catalog?cat=oborudovanie-i-aksessuary" },
  { title: "Карнавальные аксессуары", subtitle: "Маски, костюмы, реквизит", icon: "/icons/carnival-accessories.png", href: "/catalog?cat=karnavalnye-aksessuary" },
  { title: "Ленты и банты", subtitle: "Декоративные ленты, банты, тесьма", icon: "/icons/ribbons-bows.png", href: "/catalog?cat=lenty-i-banty" },
  { title: "Гирлянды и освещение", subtitle: "Гирлянды, огни, светодиоды", icon: "/icons/garlands-lighting.png", href: "/catalog?cat=girlyandy-osveshchenie-fotozony" },
  { title: "Полиграфия", subtitle: "Открытки, баннеры, наклейки", icon: "/icons/polygraphy.png", href: "/catalog?cat=prazdnichnaya-poligrafiya" },
  { title: "Праздничная упаковка", subtitle: "Коробки, пакеты, бумага", icon: "/icons/festive-packaging.png", href: "/catalog?cat=upakovka-dlya-podarkov" },
  { title: "Свечи", subtitle: "Праздничные, декоративные, цифры", icon: "/icons/candles.png", href: "/catalog?cat=svechi-i-fontany" },
  { title: "Сервировка стола", subtitle: "Тарелки, стаканы, скатерти", icon: "/icons/table-setting.png", href: "/catalog?cat=servirovka-stola" },
  { title: "Товары для праздника", subtitle: "Конфетти, хлопушки, украшения", icon: "/icons/party-goods.png", href: "/catalog?cat=tovary-dlya-prazdnika" },
];

export default function Categories() {
  return (
    <section id="catalog" className="py-10 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Категории товаров</h2>
          <a href="/catalog" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все товары →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((cat) => (
            <a
              key={cat.title}
              href={cat.href}
              className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all"
            >
              <div className="relative w-full aspect-square bg-gray-50">
                <Image
                  src={cat.icon}
                  alt={cat.title}
                  fill
                  className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold text-gray-800 leading-tight">{cat.title}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-tight">{cat.subtitle}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
