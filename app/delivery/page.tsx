import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика доставки — Sharmaster.kz",
  description:
    "Условия доставки sharmaster.kz: территория и способы доставки, стоимость, сроки, приёмка заказа и особые условия для гелиевых композиций.",
  robots: { index: true, follow: true },
};

export default async function DeliveryPage() {
  const markdown = await getLegalMarkdown("03-politika-dostavki-ru");
  return <LegalPageLayout breadcrumbLabel="Доставка" markdown={markdown} />;
}
