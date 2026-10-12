import ProductCarousel from "@/components/ProductCarousel";
import type { NovinkaCard } from "@/lib/onecStock";

type Props = { items: NovinkaCard[] };

export default function NovinkaSection({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="py-10 bg-gray-50 border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <ProductCarousel items={items} title="Новинки" href="/novinka" variant="new" />
      </div>
    </section>
  );
}
