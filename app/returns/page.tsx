import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Возврат и обмен товара — Sharmaster.kz",
  description:
    "Политика возврата и обмена товаров sharmaster.kz: условия обмена товара надлежащего качества, порядок действий при браке, сроки и способы возврата денег.",
  robots: { index: true, follow: true },
};

export default async function ReturnsPage() {
  const markdown = await getLegalMarkdown("04-politika-vozvrata-ru");
  return <LegalPageLayout breadcrumbLabel="Возврат и обмен" markdown={markdown} />;
}
