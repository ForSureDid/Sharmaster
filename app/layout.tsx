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

const SITE_URL = "https://www.sharmaster.kz";
const SITE_TITLE = "Sharmaster.kz — оптовый магазин воздушных шаров в Казахстане";
const SITE_DESCRIPTION =
  "Воздушные шары оптом и в розницу: латексные шары, фольгированные шары, шары-сферы, гелий и оборудование. Более 10000 товаров, доставка по всему Казахстану.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Sharmaster.kz",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "воздушные шары", "шары оптом", "шарики", "шар", "гелиевые шары",
    "фольгированные шары", "латексные шары", "шары на день рождения",
    "шары Астана", "шары Казахстан", "sharmaster",
    "гелий", "гелий Астана", "гелий оптом", "купить гелий", "баллон гелия",
    "доставка гелия", "быстрая доставка гелия", "гелий для шаров",
    "аренда баллона гелия", "сертифицированный гелий", "качественный гелий",
    "гелий без примесей", "гелий в наличии",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Sharmaster.kz",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo-bright.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo-bright.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Set YANDEX_SITE_VERIFICATION in env once you add the site in Yandex Webmaster
  // (verification code from webmaster.yandex.ru → Site → Verification → Meta tag).
  // Google is already verified via public/google3a20882386492ff5.html.
  verification: {
    yandex: process.env.YANDEX_SITE_VERIFICATION,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Sharmaster.kz",
  url: SITE_URL,
  logo: `${SITE_URL}/logo-nobg.png`,
  image: `${SITE_URL}/logo-bright.png`,
  telephone: "+7-776-951-0282",
  priceRange: "₸₸",
  address: {
    "@type": "PostalAddress",
    streetAddress: "пр. Мәңгілік Ел, 36 (цокольный этаж)",
    addressLocality: "Астана",
    addressCountry: "KZ",
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "10:00",
    closes: "19:00",
  },
  sameAs: [
    "https://www.instagram.com/sharoptom.kz/",
    "https://go.2gis.com/tvVMM",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Sharmaster.kz",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/catalog?q={search_term_string}`,
    "query-input": "required name=search_term_string",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
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
