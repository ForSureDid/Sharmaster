import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { LikesProvider } from "@/context/LikesContext";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import { LocaleProvider } from "@/context/LocaleContext";
import CookieBanner from "@/components/CookieBanner";
import AnalyticsScripts from "@/components/AnalyticsScripts";

const nunito = Nunito({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Sharmaster.kz — оптовый магазин воздушных шаров в Казахстане",
  description: "Широкий ассортимент шаров для любого праздника. Качество, доступные цены и быстрая доставка по всему Казахстану.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full scroll-smooth">
      <head>
        <link rel="preconnect" href="https://tjoreojidkjhfksspbwe.supabase.co" />
        <link rel="dns-prefetch" href="https://tjoreojidkjhfksspbwe.supabase.co" />
      </head>
      <body className={`${nunito.className} min-h-full flex flex-col`}>
        <LocaleProvider>
          <CookieConsentProvider>
            <AuthProvider>
              <CartProvider>
                <LikesProvider>
                  {children}
                </LikesProvider>
              </CartProvider>
            </AuthProvider>
            <CookieBanner />
            <AnalyticsScripts />
          </CookieConsentProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
