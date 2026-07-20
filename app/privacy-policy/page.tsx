import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Sharmaster.kz",
  description:
    "Политика конфиденциальности интернет-магазина sharmaster.kz: какие персональные данные мы собираем, зачем, как их храним и защищаем, и какие права есть у пользователя.",
  robots: { index: true, follow: true },
};

export default async function PrivacyPolicyPage() {
  const markdown = await getLegalMarkdown("01-politika-konfidencialnosti-ru");
  return <LegalPageLayout breadcrumbLabel="Политика конфиденциальности" markdown={markdown} />;
}
