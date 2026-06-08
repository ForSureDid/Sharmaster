"use client";

import { useCart } from "@/context/CartContext";

const products = [
  { id: -1, name: "Шар латексный 12\" пастель белый", price: 15, salePrice: null, imageUrl: null, colorGroup: null, sizeInches: "12", manufacturer: null, isNew: false, old: null, bg: "from-gray-100 to-slate-50", emoji: "⚪" },
  { id: -2, name: "Шар латексный 12\" пастель ассорти", price: 18, salePrice: null, imageUrl: null, colorGroup: null, sizeInches: "12", manufacturer: null, isNew: true, old: null, bg: "from-red-100 to-orange-50", emoji: "🔴" },
  { id: -3, name: "Шар фольга \"Звезда\" 18\"", price: 350, salePrice: 450, imageUrl: null, colorGroup: null, sizeInches: "18", manufacturer: null, isNew: false, old: 450, bg: "from-yellow-100 to-amber-50", emoji: "⭐" },
  { id: -4, name: "Шар фольга \"Сердце\" 18\"", price: 480, salePrice: null, imageUrl: null, colorGroup: null, sizeInches: "18", manufacturer: null, isNew: true, old: null, bg: "from-pink-100 to-red-50", emoji: "❤️" },
  { id: -5, name: "Шар фольга цифра \"1\"", price: 800, salePrice: 950, imageUrl: null, colorGroup: null, sizeInches: null, manufacturer: null, isNew: false, old: 950, bg: "from-purple-100 to-violet-50", emoji: "1️⃣" },
  { id: -6, name: "Набор латексных шаров пастель (10 шт)", price: 160, salePrice: null, imageUrl: null, colorGroup: null, sizeInches: null, manufacturer: null, isNew: false, old: null, bg: "from-blue-100 to-sky-50", emoji: "🎈" },
  { id: -7, name: "Шар хром золото 12\"", price: 45, salePrice: null, imageUrl: null, colorGroup: null, sizeInches: "12", manufacturer: null, isNew: true, old: null, bg: "from-yellow-100 to-yellow-50", emoji: "🟡" },
  { id: -8, name: "Лента декоративная (50 м)", price: 200, salePrice: 280, imageUrl: null, colorGroup: null, sizeInches: null, manufacturer: null, isNew: false, old: 280, bg: "from-green-100 to-emerald-50", emoji: "🎀" },
];

export default function ProductGrid() {
  const { items, addToCart, updateQty } = useCart();

  return (
    <section className="py-10 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Популярные товары</h2>
          <a href="#catalog" className="text-sm text-sky-500 hover:text-sky-700 font-medium transition-colors">
            Все товары →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => {
            const cartItem = items.find((i) => i.id === p.id);
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all group flex flex-col"
              >
                <div className={`relative h-40 bg-gradient-to-br ${p.bg} flex items-center justify-center`}>
                  <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{p.emoji}</span>
                  {p.isNew && (
                    <span className="absolute top-2 left-2 bg-sky-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Новинка
                    </span>
                  )}
                  {p.old && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Акция
                    </span>
                  )}
                </div>

                <div className="p-3 flex flex-col flex-1">
                  <p className="text-xs text-gray-500 leading-snug mb-2 flex-1">{p.name}</p>

                  <div className="flex items-end justify-between gap-2 mt-auto">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-red-600">{p.price} ₸</span>
                      </div>
                      {p.old && (
                        <span className="text-xs text-gray-400 line-through">{p.old} ₸</span>
                      )}
                    </div>

                    {cartItem ? (
                      <div className="flex items-center border border-sky-300 rounded-lg overflow-hidden flex-shrink-0">
                        <button
                          onClick={() => updateQty(p.id, cartItem.qty - 1)}
                          className="w-7 h-7 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors font-bold"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-sky-600">{cartItem.qty}</span>
                        <button
                          onClick={() => updateQty(p.id, cartItem.qty + 1)}
                          className="w-7 h-7 flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors font-bold"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(p)}
                        className="flex-shrink-0 w-8 h-8 bg-sky-400 hover:bg-sky-500 text-white rounded-lg flex items-center justify-center transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
