"use client";

export default function FloatingCart() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
      {/* Cart */}
      <div className="flex items-center gap-1.5 bg-white shadow-lg rounded-full px-3 py-2 text-sm font-medium text-gray-600 cursor-pointer hover:shadow-xl transition-shadow">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span>0</span>
      </div>

      {/* Help button */}
      <button className="w-12 h-12 bg-teal-500 hover:bg-teal-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors">
        <span className="text-xl font-bold">?</span>
      </button>
    </div>
  );
}
