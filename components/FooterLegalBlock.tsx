"use client";

import Link from "next/link";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import { useLocale } from "@/context/LocaleContext";

const FOUNDING_YEAR = 2025;

function LocaleOption({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`px-2 py-0.5 rounded-md transition-colors ${active ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function LocaleSwitch() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 text-xs">
      <LocaleOption active={locale === "ru"} label="РУС" onSelect={() => setLocale("ru")} />
      <LocaleOption active={locale === "kk"} label="ҚАЗ" onSelect={() => setLocale("kk")} />
    </div>
  );
}

export default function FooterLegalBlock() {
  const { dict } = useLocale();
  const currentYear = new Date().getFullYear();
  const yearLabel = currentYear > FOUNDING_YEAR ? `${FOUNDING_YEAR}–${currentYear}` : `${FOUNDING_YEAR}`;

  return (
    <>
      {/* Legal */}
      <div className="border-t border-gray-800">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3">
            <p className="text-xs text-gray-500 text-center sm:text-left">{dict.footer.disclaimer}</p>
            <LocaleSwitch />
          </div>

          <nav
            aria-label="Правовые документы"
            className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1.5 text-xs text-gray-500"
          >
            <Link href="/privacy-policy" className="hover:text-white transition-colors">{dict.footer.links.privacyPolicy}</Link>
            <span aria-hidden="true" className="text-gray-700">·</span>
            <Link href="/oferta" className="hover:text-white transition-colors">{dict.footer.links.oferta}</Link>
            <span aria-hidden="true" className="text-gray-700">·</span>
            <Link href="/delivery" className="hover:text-white transition-colors">{dict.footer.links.delivery}</Link>
            <span aria-hidden="true" className="text-gray-700">·</span>
            <Link href="/returns" className="hover:text-white transition-colors">{dict.footer.links.returns}</Link>
            <span aria-hidden="true" className="text-gray-700">·</span>
            <Link href="/cookie-policy" className="hover:text-white transition-colors">{dict.footer.links.cookiePolicy}</Link>
            <span aria-hidden="true" className="text-gray-700">·</span>
            <CookieSettingsButton className="hover:text-white transition-colors underline decoration-dotted underline-offset-2">
              {dict.footer.links.cookieSettings}
            </CookieSettingsButton>
          </nav>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <p>© {yearLabel} {dict.footer.copyrightHolder}. {dict.footer.copyrightRights}</p>
          <p>Казахстан</p>
        </div>
      </div>
    </>
  );
}
