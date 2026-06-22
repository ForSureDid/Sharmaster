import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";

const nunito = Nunito({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Sharmaster — Оптовый магазин воздушных шаров",
  description: "Широкий ассортимент шаров для любого праздника. Качество, доступные цены и быстрая доставка по всему Казахстану.",
  icons: {
    icon: "/profile-icon.png",
  },
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
        <AuthProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
