"use client";

import { useState } from "react";
import { useCookieConsent, type ConsentCategories } from "@/context/CookieConsentContext";
import { useLocale } from "@/context/LocaleContext";

type ToggleKey = Exclude<keyof ConsentCategories, "necessary">;

function CategoryToggle({
  title,
  description,
  checked,
  locked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 ${locked ? "" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 w-4 h-4 accent-sky-500 disabled:opacity-60"
      />
      <span>
        <span className="block text-sm font-semibold text-gray-800">
          {title}
          {locked && <span className="ml-2 text-xs font-normal text-gray-400">(всегда вкл.)</span>}
        </span>
        <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
      </span>
    </label>
  );
}

export default function CookieBanner() {
  const { bannerVisible, categories, acceptAll, rejectOptional, savePreferences, dismiss, hasResponded } = useCookieConsent();
  const { dict } = useLocale();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<ConsentCategories, "necessary">>({
    functional: categories.functional,
    analytical: categories.analytical,
    marketing: categories.marketing,
  });

  if (!bannerVisible) return null;

  function openSettingsView() {
    setDraft({ functional: categories.functional, analytical: categories.analytical, marketing: categories.marketing });
    setSettingsOpen(true);
  }

  function handleSave() {
    savePreferences(draft);
    setSettingsOpen(false);
  }

  function toggle(key: ToggleKey) {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
      role="dialog"
      aria-modal="false"
      aria-label={dict.cookieBanner.title}
    >
      <div className="mx-auto max-w-2xl bg-white rounded-3xl border border-gray-200 shadow-xl p-5 sm:p-6">
        {!settingsOpen ? (
          <>
            <p className="text-sm font-bold text-gray-800 mb-1.5">{dict.cookieBanner.title}</p>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-4">
              {dict.cookieBanner.description}
              <a href="/cookie-policy" className="text-sky-600 hover:text-sky-700 underline underline-offset-2">
                {dict.cookieBanner.policyLinkLabel}
              </a>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptAll}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors"
              >
                {dict.cookieBanner.acceptAll}
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                {dict.cookieBanner.rejectOptional}
              </button>
              <button
                type="button"
                onClick={openSettingsView}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:border-gray-300 transition-colors"
              >
                {dict.cookieBanner.openSettings}
              </button>
              {hasResponded && (
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Закрыть"
                  className="ml-auto px-2 py-2 text-gray-400 hover:text-gray-600 transition-colors text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-gray-800 mb-1.5">{dict.cookieBanner.settingsTitle}</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{dict.cookieBanner.settingsDescription}</p>
            <div className="max-h-[45vh] overflow-y-auto pr-1">
              <CategoryToggle
                title={dict.cookieBanner.categories.necessary.title}
                description={dict.cookieBanner.categories.necessary.description}
                checked
                locked
              />
              <CategoryToggle
                title={dict.cookieBanner.categories.functional.title}
                description={dict.cookieBanner.categories.functional.description}
                checked={draft.functional}
                onChange={() => toggle("functional")}
              />
              <CategoryToggle
                title={dict.cookieBanner.categories.analytics.title}
                description={dict.cookieBanner.categories.analytics.description}
                checked={draft.analytical}
                onChange={() => toggle("analytical")}
              />
              <CategoryToggle
                title={dict.cookieBanner.categories.marketing.title}
                description={dict.cookieBanner.categories.marketing.description}
                checked={draft.marketing}
                onChange={() => toggle("marketing")}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors"
              >
                {dict.cookieBanner.save}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                {dict.cookieBanner.back}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
