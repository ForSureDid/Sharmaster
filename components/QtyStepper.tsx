"use client";

import { useEffect, useState } from "react";

type Size = "xs" | "sm" | "lg";

const SIZE_CLASSES: Record<Size, { btn: string; inputFixed: string; border: string; unit: string }> = {
  xs: { btn: "w-7 h-7 text-sm", inputFixed: "w-7 text-xs", border: "border", unit: "text-[10px]" },
  sm: { btn: "w-9 h-9 text-lg", inputFixed: "w-9 text-sm", border: "border", unit: "text-xs" },
  lg: { btn: "w-14 h-14 text-2xl", inputFixed: "w-14 text-lg", border: "border-2", unit: "text-sm" },
};

export default function QtyStepper({
  qty,
  onChange,
  size = "sm",
  unit,
  fill = false,
  className = "",
}: {
  qty: number;
  onChange: (qty: number) => void;
  size?: Size;
  unit?: string;
  // fill=true stretches to the full width of its container and lets the
  // input grow to fill the gap, pinning the +/- buttons to the edges —
  // for a card's full-width action row. fill=false (default) sizes to
  // content, for a stepper sitting inline next to other row elements.
  fill?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(qty));
  // Keep the field in sync when qty changes from elsewhere (+/- buttons,
  // stock reconciliation) — but not while the user is actively typing.
  useEffect(() => setDraft(String(qty)), [qty]);

  function commit() {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) onChange(n);
    else setDraft(String(qty));
  }

  const s = SIZE_CLASSES[size];

  return (
    <div className={`flex items-center ${s.border} border-sky-300 rounded-lg overflow-hidden ${fill ? "w-full" : ""} ${className}`}>
      <button
        onClick={() => onChange(qty - 1)}
        className={`${s.btn} flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors font-bold flex-shrink-0`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={`${fill ? "flex-1 min-w-0" : s.inputFixed} text-center font-bold text-sky-600 outline-none bg-transparent`}
      />
      {unit && <span className={`${s.unit} text-gray-400 pr-1 flex-shrink-0`}>{unit}</span>}
      <button
        onClick={() => onChange(qty + 1)}
        className={`${s.btn} flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors font-bold flex-shrink-0`}
      >
        +
      </button>
    </div>
  );
}
