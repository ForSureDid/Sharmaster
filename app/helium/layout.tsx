import type { Metadata } from "next";

const TITLE = "Гелий в Астане — продажа и аренда баллонов, быстрая доставка";
const DESCRIPTION =
  "Гелий в Астане без примесей и разбавок: баллоны 10 и 40 л — продажа и аренда, всегда в наличии, большой объём. Быстрая доставка день в день или по записи, в черте города. Таблицы расхода гелия на шары.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/helium" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/helium",
    type: "website",
  },
};

export default function HeliumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
