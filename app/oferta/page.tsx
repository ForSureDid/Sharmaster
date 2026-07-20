import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getLegalMarkdown } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Публичная оферта — Sharmaster.kz",
  description:
    "Договор публичной оферты интернет-магазина sharmaster.kz: условия заключения договора, цена и оплата, доставка, возврат, права и обязанности сторон.",
  robots: { index: true, follow: true },
};

export default async function OfertaPage() {
  const markdown = await getLegalMarkdown("02-publichnaya-oferta-ru");
  return <LegalPageLayout breadcrumbLabel="Публичная оферта" markdown={markdown} />;
}
