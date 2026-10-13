import ProductCarousel from "@/components/ProductCarousel";
import type { StockCard } from "@/lib/onecStock";

export default function HitsSection({ items }: { items: (StockCard & { article?: string | null })[] }) {
  if (items.length === 0) return null;

  return (
    <section className="py-10 bg-gray-50 border-t border-gray-100">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <ProductCarousel items={items} title="Хиты" href="/catalog?hit=1" variant="hit" />
      </div>
    </section>
  );
}
