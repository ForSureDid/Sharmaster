import type { StockCard } from "@/lib/onecStock";
import { StockCardGrid } from "@/components/StockContent";

export default function SimilarProducts({ items }: { items: StockCard[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-8 max-w-[90rem]">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Похожие товары</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {items.map((item) => <StockCardGrid key={item.id} item={item} />)}
      </div>
    </div>
  );
}
