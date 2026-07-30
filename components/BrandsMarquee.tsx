import Image from "next/image";

type Brand = { name: string; file: string; color: string; logoMaxHeight?: number };

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
  { name: "Дон Баллон", file: "donballon.png", color: "#F43F5E", logoMaxHeight: 35 },
  { name: "Anagram", file: "anagram.svg", color: "#A78BFA" },
  { name: "Забава", file: "zabava.jpeg", color: "#2563EB" },
];

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <div className="relative flex-shrink-0 mx-2.5 sm:mx-3">
      <div
        className="absolute inset-x-3 -bottom-1 h-3 rounded-full opacity-60 blur-[6px]"
        style={{ backgroundColor: brand.color }}
      />
      <div className="relative w-28 h-14 sm:w-32 sm:h-16 bg-white rounded-2xl border border-gray-100 flex items-center justify-center px-3 py-2">
        <Image
          src={`/brands/${brand.file}`}
          alt={brand.name}
          width={160}
          height={80}
          className="max-h-6 sm:max-h-7 w-auto object-contain"
          style={brand.logoMaxHeight ? { maxHeight: brand.logoMaxHeight } : undefined}
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
