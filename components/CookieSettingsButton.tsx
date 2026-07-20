"use client";

import { useCookieConsent } from "@/context/CookieConsentContext";

export default function CookieSettingsButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { openSettings } = useCookieConsent();
  return (
    <button type="button" onClick={openSettings} className={className}>
      {children}
    </button>
  );
}
