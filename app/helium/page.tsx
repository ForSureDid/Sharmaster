"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";

type LatexRow = {
  size: string;
  inflated: string;
  lift: string;
  gasVolume: string;
  tank10: string;
  tank20: string;
  tank25: string;
  tank40: string;
  tank50: string;
};

type FoilRow = {
  shape: string;
  inflated: string;
  tank10: string;
  tank40: string;
};

type SphereRow = {
  size: string;
  diameter: string;
  lift: string;
  volume: string;
  tank40: string;
};

const latexRows: LatexRow[] = [
  { size: "R-5 круглый", inflated: '5" – 13 см', lift: "—", gasVolume: "0,002 м³", tank10: "715 шт", tank20: "2 000 шт", tank25: "1 800 шт", tank40: "2 850 шт", tank50: "4 800 шт" },
  { size: "R-10 круглый", inflated: '10" – 24,5 см', lift: "6,2 г", gasVolume: "0,008 м³", tank10: "180 шт", tank20: "500 шт", tank25: "450 шт", tank40: "713 шт", tank50: "1 200 шт" },
  { size: "R-12 круглый", inflated: '12" – 29 см', lift: "10 г", gasVolume: "0,015 м³", tank10: "95 шт", tank20: "270 шт", tank25: "240 шт", tank40: "380 шт", tank50: "660 шт" },
  { size: "R-16 круглый", inflated: '16" – 38 см', lift: "31 г", gasVolume: "0,041 м³", tank10: "35 шт", tank20: "98 шт", tank25: "88 шт", tank40: "139 шт", tank50: "240 шт" },
  { size: "3'' футовый", inflated: '3" – 91 см', lift: "184 г", gasVolume: "0,226 м³", tank10: "6 шт", tank20: "18 шт", tank25: "16 шт", tank40: "25 шт", tank50: "44 шт" },
  { size: "6'' сердце", inflated: "6'' – 15 см", lift: "—", gasVolume: "0,002 м³", tank10: "—", tank20: "—", tank25: "—", tank40: "—", tank50: "—" },
];

const foilRows: FoilRow[] = [
  { shape: 'Круг 18" (46 см)', inflated: "34 × 34 см", tank10: "102 шт", tank40: "407 шт" },
  { shape: 'Круг 20" (51 см)', inflated: "41 × 41 см", tank10: "62 шт", tank40: "248 шт" },
  { shape: 'Круг 24" (61 см)', inflated: "59 × 58 см", tank10: "48 шт", tank40: "190 шт" },
  { shape: 'Круг 31" (79 см)', inflated: "61 × 61 см", tank10: "32 шт", tank40: "127 шт" },
  { shape: 'Круг 36" (91 см)', inflated: "69 × 69 см", tank10: "11 шт", tank40: "46 шт" },
  { shape: 'Сердце 18" (46 см)', inflated: "36 × 33 см", tank10: "102 шт", tank40: "407 шт" },
  { shape: 'Сердце 21" (53 см)', inflated: "41 × 41 см", tank10: "72 шт", tank40: "285 шт" },
  { shape: 'Сердце 24" (61 см)', inflated: "61 × 58 см", tank10: "51 шт", tank40: "204 шт" },
  { shape: 'Сердце 32" (81 см)', inflated: "77 × 77 см", tank10: "16 шт", tank40: "66 шт" },
  { shape: 'Сердце 36" (91 см)', inflated: "70 × 69 см", tank10: "13 шт", tank40: "50 шт" },
  { shape: 'Звезда 20" (51 см)', inflated: "46 × 45 см", tank10: "84 шт", tank40: "335 шт" },
  { shape: 'Звезда 32" (81 см)', inflated: "77 × 73 см", tank10: "17 шт", tank40: "66 шт" },
  { shape: 'Звезда 36" (91 см)', inflated: "90 × 86 см", tank10: "13 шт", tank40: "50 шт" },
  { shape: 'Конус 38" (96 см)', inflated: "30 × 106 см", tank10: "109 шт", tank40: "430 шт" },
  { shape: 'Полумесяц 35" (89 см)', inflated: "74 × 98 см", tank10: "38 шт", tank40: "154 шт" },
  { shape: 'Звезда 4-хконечная 40" (101 см)', inflated: "97 × 106 см", tank10: "40 шт", tank40: "162 шт" },
];

const sphereRows: SphereRow[] = [
  { size: 'Сфера баблс 18"', diameter: "40 см", lift: "35 г", volume: "37 л", tank40: "160 шт" },
  { size: 'Сфера баблс 24"', diameter: "56 см", lift: "72 г", volume: "100 л", tank40: "60 шт" },
];

const tabs = [
  { key: "latex", label: "Латексные шары" },
  { key: "foil", label: "Фольгированные шары" },
  { key: "sphere", label: "Шары-сферы" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 sm:px-5 py-3.5 text-left text-xs sm:text-sm font-semibold text-gray-500 whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 sm:px-5 py-3.5 text-sm text-gray-700 whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-5 pt-5 pb-1">
        <h2 className="text-sm sm:text-base font-bold text-gray-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default function HeliumPage() {
  const [tab, setTab] = useState<TabKey>("latex");

  return (
    <>
      <Header />
      <main className="pt-[88px] min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400">
              <a href="/" className="hover:text-sky-500 transition-colors">Главная</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-600 font-medium">Расход гелия</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Расход гелия</h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Сколько шаров можно надуть из одного баллона гелия — таблицы расхода для латексных
              и фольгированных шаров, а также шаров-сфер.
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex flex-wrap gap-1 bg-white rounded-2xl border border-gray-100 p-1 mb-6 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  tab === t.key ? "bg-sky-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "latex" && (
            <TableCard title="Расход гелия на латексные шары">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <Th>Размер шара</Th>
                    <Th>Размер надутого шара</Th>
                    <Th>Подъемная сила</Th>
                    <Th>Объем газа в надутом шаре</Th>
                    <Th>Баллон 10 л</Th>
                    <Th>Баллон 20 л 200 атм</Th>
                    <Th>Баллон 25 л</Th>
                    <Th>Баллон 40 л</Th>
                    <Th>Баллон 50 л</Th>
                  </tr>
                </thead>
                <tbody>
                  {latexRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-sky-50/40 transition-colors">
                      <Td className="font-medium text-gray-800">{r.size}</Td>
                      <Td>{r.inflated}</Td>
                      <Td>{r.lift}</Td>
                      <Td>{r.gasVolume}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank10}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank20}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank25}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank40}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank50}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          )}

          {tab === "foil" && (
            <TableCard title="Расход гелия на фольгированные шары">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <Th>Форма и размер шара</Th>
                    <Th>Размер надутого шара</Th>
                    <Th>Баллон 10 л</Th>
                    <Th>Баллон 40 л</Th>
                  </tr>
                </thead>
                <tbody>
                  {foilRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-sky-50/40 transition-colors">
                      <Td className="font-medium text-gray-800">{r.shape}</Td>
                      <Td>{r.inflated}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank10}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank40}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          )}

          {tab === "sphere" && (
            <TableCard title="Расход гелия на шары-сферы">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <Th>Размер шара</Th>
                    <Th>Диаметр шара</Th>
                    <Th>Подъемная сила</Th>
                    <Th>Объем сферы</Th>
                    <Th>Баллон 40 л</Th>
                  </tr>
                </thead>
                <tbody>
                  {sphereRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-sky-50/40 transition-colors">
                      <Td className="font-medium text-gray-800">{r.size}</Td>
                      <Td>{r.diameter}</Td>
                      <Td>{r.lift}</Td>
                      <Td>{r.volume}</Td>
                      <Td className="text-sky-600 font-semibold">{r.tank40}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          )}
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
