import Image from "next/image";

type Brand = { name: string; file: string; color: string };

const BRANDS: Brand[] = [
  { name: "Agura", file: "agura.jpeg", color: "#EC4899" },
  { name: "Qualatex", file: "qualatex.jpeg", color: "#0EA5E9" },
  { name: "Sempertex", file: "sempertex.png", color: "#7C3AED" },
  { name: "Belbal", file: "belbal.png", color: "#2563EB" },
  { name: "Everts", file: "everts.jpeg", color: "#DC2626" },
  { name: "Falali", file: "falali.jpeg", color: "#991B1B" },
  { name: "Flexmetal", file: "flexmetal.png", color: "#1E3A8A" },
  { name: "Grabo", file: "grabo.jpeg", color: "#3B82F6" },
  { name: "Смайл Берри", file: "smail_berri.jpeg", color: "#F59E0B" },
  { name: "Волна Веселья", file: "volna_veselya.jpeg", color: "#65A30D" },
  { name: "512 Шар", file: "512brand.jpeg", color: "#F97316" },
  { name: "Дон Баллон", file: "donballon.svg", color: "#F43F5E" },
  { name: "Anagram", file: "anagram.svg", color: "#A78BFA" },
];

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <div className="relative flex-shrink-0 mx-3 sm:mx-4">
      <div
        className="absolute inset-x-4 -bottom-1 h-3 rounded-full opacity-60 blur-[6px]"
        style={{ backgroundColor: brand.color }}
      />
      <div className="relative w-36 h-20 sm:w-44 sm:h-24 bg-white rounded-2xl border border-gray-100 flex items-center justify-center px-4 py-3">
        <Image
          src={`/brands/${brand.file}`}
          alt={brand.name}
          width={220}
          height={140}
          className="max-h-12 sm:max-h-16 w-auto max-w-full object-contain"
        />
      </div>
    </div>
  );
}

export default function BrandsMarquee() {
  const track = [...BRANDS, ...BRANDS];

  return (
    <section className="py-3 bg-white border-t border-gray-100 overflow-hidden">
      <div className="group overflow-hidden">
        <div
          className="flex w-max animate-[brands-marquee_32s_linear_infinite] group-hover:[animation-play-state:paused]"
        >
          {track.map((brand, i) => (
            <BrandCard key={`${brand.file}-${i}`} brand={brand} />
          ))}
        </div>
      </div>
    </section>
  );
}
