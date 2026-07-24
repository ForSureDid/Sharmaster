import Link from "next/link";
import NovinkaGrid from "@/components/NovinkaGrid";
import type { NovinkaCard } from "@/lib/onecStock";

type Props = { items: NovinkaCard[] };

export default function NovinkaSection({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="py-10 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Новинки</h2>
          <Link href="/novinka" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все новинки →
          </Link>
        </div>

        <div className="border border-gray-200 rounded-2xl bg-gray-50 p-4 sm:p-6">
          <NovinkaGrid
            items={items}
            gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
          />
        </div>
      </div>
    </section>
  );
}
