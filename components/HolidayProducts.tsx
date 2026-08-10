import Image from "next/image";

type Occasion = {
  label: string;
  image: string;
  occasion: string;
};

const OCCASIONS: Occasion[] = [
  { label: "1 Сентября", image: "/occasions/1_sentyabra.webp", occasion: "1 Сентября" },
  { label: "Хэллоуин", image: "/occasions/hellouin.webp", occasion: "Хэллоуин" },
  { label: "День Рождения", image: "/occasions/Birthday.webp", occasion: "День Рождения" },
  { label: "Свадьба", image: "/occasions/svadba.webp", occasion: "Свадьба" },
  { label: "Гендер Пати", image: "/occasions/gender.webp", occasion: "Гендер Пати" },
  { label: "Девичник", image: "/occasions/bride.webp", occasion: "Девичник" },
  { label: "Новый Год", image: "/occasions/new_year.webp", occasion: "Новый Год" },
  { label: "14 Февраля", image: "/occasions/14_fevralya.webp", occasion: "14 Февраля" },
  { label: "8 Марта", image: "/occasions/8_marta.webp", occasion: "8 Марта" },
  { label: "9 Мая", image: "/occasions/9_maya.webp", occasion: "9 Мая" },
];

export default function HolidayProducts() {
  return (
    <section className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Товары к праздникам</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
          {OCCASIONS.map((o) => (
            <a
              key={o.occasion}
              href={`/catalog?occasion=${encodeURIComponent(o.occasion)}`}
              className="group flex flex-col items-center text-center"
            >
              <div className="relative w-full aspect-square rounded-2xl bg-gray-50 overflow-hidden border border-gray-100 group-hover:border-sky-200 group-hover:shadow-md transition-all">
                <Image
                  src={o.image}
                  alt={o.label}
                  fill
                  className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                />
              </div>
              <p className="mt-3 text-sm sm:text-base font-medium text-gray-700 group-hover:text-sky-600 transition-colors">
                {o.label}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
