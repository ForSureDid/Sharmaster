"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { nextOneTimeTier } from "@/lib/discounts";

type PrimaryAction =
  | { kind: "link"; href: string; label: string }
  // formId associates this button with a <form> it isn't nested inside (the
  // form lives in a different grid column) via the standard HTML `form`
  // attribute, so native `required` field validation still runs on click.
  | { kind: "submit"; label: string; formId: string; loading?: boolean; disabled?: boolean };

// Shared by /cart and /order — both read the same CartContext, so the numbers
// shown on each screen can never drift apart from one another.
export default function CartSummaryCard({
  title = "Товары",
  primaryAction,
  secondaryAction,
  showNextTierHint = false,
}: {
  title?: string;
  primaryAction: PrimaryAction;
  secondaryAction?: React.ReactNode;
  showNextTierHint?: boolean;
}) {
  const { totalCount, totalPrice, discountPercent, discountAmount, finalTotal } = useCart();
  const nextTier = showNextTierHint ? nextOneTimeTier(totalPrice) : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{title} ({totalCount})</span>
        <span className="text-sm font-semibold text-gray-700">{totalPrice.toLocaleString()} ₸</span>
      </div>

      {discountPercent > 0 && (
        <div className="flex items-center justify-between -mt-2">
          <span className="text-sm text-gray-500">Скидка {discountPercent}%</span>
          <span className="text-sm font-semibold text-green-600">−{discountAmount.toLocaleString()} ₸</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <span className="text-base font-semibold text-gray-800">Итого</span>
        <span className="text-2xl font-extrabold text-gray-800">{finalTotal.toLocaleString()} ₸</span>
      </div>

      {nextTier && (
        <p className="text-xs text-gray-400 -mt-2 leading-relaxed">
          Добавьте товаров ещё на <b className="text-sky-600">{(nextTier.amount - totalPrice).toLocaleString()} ₸</b>,
          чтобы получить скидку <b className="text-sky-600">{nextTier.percent}%</b>
        </p>
      )}

      {primaryAction.kind === "link" ? (
        <Link
          href={primaryAction.href}
          className="w-full py-4 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-base font-bold rounded-2xl transition-colors shadow-sm"
        >
          {primaryAction.label}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <button
          type="submit"
          form={primaryAction.formId}
          disabled={primaryAction.disabled}
          className="w-full py-4 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white text-base font-bold rounded-2xl transition-colors shadow-sm"
        >
          {primaryAction.loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Оформляем...
            </>
          ) : (
            primaryAction.label
          )}
        </button>
      )}

      {secondaryAction}
    </div>
  );
}
