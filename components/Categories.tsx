import Image from "next/image";
import { getCategories } from "@/lib/products";

const ICON_MAP: Record<string, string> = {
  "Воздушные шары из латекса": "/icons/latex-balloons.png",
  "Воздушные шары из фольги": "/icons/foil-balloons.png",
  "Оборудование и аксессуары": "/icons/equipment-helium.png",
  "Карнавальные аксессуары": "/icons/carnival-accessories.png",
  "Ленты и банты": "/icons/ribbons-bows.png",
  "Гирлянды, освещение, фотозоны": "/icons/garlands-lighting.png",
  "Праздничная полиграфия": "/icons/polygraphy.png",
  "Упаковка для подарков": "/icons/festive-packaging.png",
  "Свечи и фонтаны": "/icons/candles.png",
  "Сервировка стола": "/icons/table-setting.png",
  "Товары для праздника": "/icons/party-goods.png",
  "Флористика": "/icons/party-goods.png",
};

const SUBTITLE_MAP: Record<string, string> = {
  "Воздушные шары из латекса": "Круглые, пастель, хром, металлик",
  "Воздушные шары из фольги": "Цифры, звёзды, фигуры, сердца",
  "Оборудование и аксессуары": "Баллоны, насосы, клей, нитки",
  "Карнавальные аксессуары": "Маски, костюмы, реквизит",
  "Ленты и банты": "Декоративные ленты, банты, тесьма",
  "Гирлянды, освещение, фотозоны": "Гирлянды, огни, светодиоды",
  "Праздничная полиграфия": "Открытки, баннеры, наклейки",
  "Упаковка для подарков": "Коробки, пакеты, упаковочная бумага",
  "Свечи и фонтаны": "Праздничные, декоративные, цифры",
  "Сервировка стола": "Тарелки, стаканы, скатерти",
  "Товары для праздника": "Конфетти, хлопушки, украшения",
  "Флористика": "Искусственные и натуральные цветы",
};

export default async function Categories() {
  const categories = await getCategories();

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
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`/catalog?cat=${cat.id}`}
              className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all"
            >
              <div className="relative w-full aspect-square bg-gray-50">
                <Image
                  src={ICON_MAP[cat.name] ?? "/icons/party-goods.png"}
                  alt={cat.name}
                  fill
                  className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold text-gray-800 leading-tight">{cat.name}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-tight">
                  {SUBTITLE_MAP[cat.name] ?? ""}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
