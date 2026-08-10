import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  // Tables can be wide (legal docs have several) — wrap so they scroll
  // horizontally on mobile instead of breaking the page layout.
  table({ children }) {
    return (
      <div className="overflow-x-auto -mx-1 px-1">
        <table>{children}</table>
      </div>
    );
  },
};

export default function LegalPageLayout({
  breadcrumbLabel,
  markdown,
}: {
  breadcrumbLabel: string;
  markdown: string;
}) {
  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <Link href="/" className="hover:text-sky-500 transition-colors">Главная</Link>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium">{breadcrumbLabel}</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <article className="legal-content mx-auto max-w-[760px] bg-white rounded-3xl border border-gray-100 p-6 sm:p-10">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {markdown}
            </ReactMarkdown>
          </article>
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
