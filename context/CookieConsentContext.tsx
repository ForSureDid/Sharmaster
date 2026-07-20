"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ConsentCategories = {
  necessary: true;
  functional: boolean;
  analytical: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "sharmaster_cookie_consent";
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // ~12 months

type StoredConsent = {
  categories: ConsentCategories;
  decidedAt: number;
};

const DEFAULT_CATEGORIES: ConsentCategories = {
  necessary: true,
  functional: false,
  analytical: false,
  marketing: false,
};

function readStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (!parsed?.categories || typeof parsed.decidedAt !== "number") return null;
    if (Date.now() - parsed.decidedAt > CONSENT_TTL_MS) return null; // expired — ask again
    return parsed;
  } catch {
    return null;
  }
}

type CookieConsentContextType = {
  categories: ConsentCategories;
  /** Whether the user has an unexpired saved choice (banner should stay hidden). */
  hasResponded: boolean;
  /** Whether the consent banner should currently be visible. */
  bannerVisible: boolean;
  acceptAll: () => void;
  rejectOptional: () => void;
  savePreferences: (categories: Omit<ConsentCategories, "necessary">) => void;
  /** Re-opens the banner so the user can change their choice (footer "Настройки cookie"). */
  openSettings: () => void;
  /** Closes the banner without changing anything — only allowed once a choice already exists. */
  dismiss: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextType | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<ConsentCategories>(DEFAULT_CATEGORIES);
  const [hasResponded, setHasResponded] = useState(true); // default true until checked, so banner never flashes before hydration
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setCategories(stored.categories);
      setHasResponded(true);
      setBannerVisible(false);
    } else {
      setHasResponded(false);
      setBannerVisible(true);
    }
  }, []);

  const persist = useCallback((next: ConsentCategories) => {
    setCategories(next);
    setHasResponded(true);
    setBannerVisible(false);
    try {
      const toStore: StoredConsent = { categories: next, decidedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // localStorage unavailable (private mode, disabled storage) — consent
      // just won't persist across reloads, which is an acceptable fallback.
    }
  }, []);

  const acceptAll = useCallback(() => {
    persist({ necessary: true, functional: true, analytical: true, marketing: true });
  }, [persist]);

  const rejectOptional = useCallback(() => {
    persist({ necessary: true, functional: false, analytical: false, marketing: false });
  }, [persist]);

  const savePreferences = useCallback((partial: Omit<ConsentCategories, "necessary">) => {
    persist({ necessary: true, ...partial });
  }, [persist]);

  const openSettings = useCallback(() => {
    setBannerVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setBannerVisible((visible) => (hasResponded ? false : visible));
  }, [hasResponded]);

  return (
    <CookieConsentContext.Provider
      value={{ categories, hasResponded, bannerVisible, acceptAll, rejectOptional, savePreferences, openSettings, dismiss }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  return ctx;
}
