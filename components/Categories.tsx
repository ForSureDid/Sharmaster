import Image from "next/image";
import { getCategories } from "@/lib/products";

type StaticEntry = {
  title: string;
  subtitle: string;
  icon: string;
  keywords: string[];
};

const STATIC: StaticEntry[] = [
  { title: "Воздушные шары из латекса", subtitle: "Круглые, пастель, хром, металлик", icon: "/icons/latex-balloons.png", keywords: ["латекс"] },
  { title: "Воздушные шары из фольги", subtitle: "Цифры, звёзды, фигуры, сердца", icon: "/icons/foil-balloons.png", keywords: ["фольг"] },
  { title: "Оборудование и аксессуары", subtitle: "Баллоны, насосы, клей, нитки", icon: "/icons/equipment-helium.png", keywords: ["оборудован", "аксессуар", "насос"] },
  { title: "Карнавальные аксессуары", subtitle: "Маски, костюмы, реквизит", icon: "/icons/carnival-accessories.png", keywords: ["карнавал"] },
  { title: "Ленты и банты", subtitle: "Декоративные ленты, банты, тесьма", icon: "/icons/ribbons-bows.png", keywords: ["лент", "бант"] },
  { title: "Гирлянды и освещение", subtitle: "Гирлянды, огни, светодиоды", icon: "/icons/garlands-lighting.png", keywords: ["гирлянд"] },
  { title: "Полиграфия", subtitle: "Открытки, баннеры, наклейки", icon: "/icons/polygraphy.png", keywords: ["полиграф"] },
  { title: "Праздничная упаковка", subtitle: "Коробки, пакеты, бумага", icon: "/icons/festive-packaging.png", keywords: ["упаковк"] },
  { title: "Свечи", subtitle: "Праздничные, декоративные, цифры", icon: "/icons/candles.png", keywords: ["свеч"] },
  { title: "Сервировка стола", subtitle: "Тарелки, стаканы, скатерти", icon: "/icons/table-setting.png", keywords: ["сервиров", "тарелк"] },
  { title: "Товары для праздника", subtitle: "Конфетти, хлопушки, украшения", icon: "/icons/party-goods.png", keywords: ["праздник"] },
];

export default async function Categories() {
  const dbCats = await getCategories();
  const dbLower = dbCats.map((c: { id: number; name: string }) => ({ id: c.id, lower: c.name.toLowerCase() }));

  const items = STATIC.map((entry) => {
    const match = dbLower.find((dc) => entry.keywords.some((kw) => dc.lower.includes(kw)));
    return {
      title: entry.title,
      subtitle: entry.subtitle,
      icon: entry.icon,
      href: match ? `/catalog?cat=${match.id}` : "/catalog",
    };
  });

  return (
    <section id="catalog" className="py-10 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Категории товаров</h2>
          <a href="/catalog" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все товары →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((cat) => (
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
