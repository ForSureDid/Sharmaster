import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика использования cookie — Sharmaster.kz",
  description:
    "Политика использования cookie-файлов sharmaster.kz: какие cookie мы используем, зачем, и как управлять согласием через баннер или настройки браузера.",
  robots: { index: true, follow: true },
};

export default async function CookiePolicyPage() {
  const markdown = await getLegalMarkdown("05-politika-cookie-ru");
  return <LegalPageLayout breadcrumbLabel="Cookie" markdown={markdown} />;
}
