import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCart from "@/components/FloatingCart";
import { CUMULATIVE_DISCOUNT_TIERS, ONE_TIME_DISCOUNT_TIERS, type DiscountTier } from "@/lib/discounts";

export const metadata: Metadata = {
  title: "Скидки — оптовые цены на воздушные шары",
  description: "Система скидок Sharmaster.kz: накопительная скидка по итогам заказов за 30 дней и прогрессивная скидка на разовый заказ. Выгодные оптовые цены на шары в Казахстане.",
  alternates: { canonical: "/discounts" },
};

function TierScale({ tiers }: { tiers: DiscountTier[] }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 sm:p-6 overflow-x-auto">
      <div className="min-w-max">
        <div className="flex items-center gap-8 sm:gap-12">
          {tiers.map((t, i) => (
            <div
              key={i}
              className={`w-20 text-center font-bold ${
                i === 0 ? "text-lg sm:text-xl text-sky-600" : "text-sm sm:text-base text-gray-600"
              }`}
            >
              {t.percent}%
            </div>
          ))}
        </div>

        <div className="relative flex items-center gap-8 sm:gap-12 my-3">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200" />
          {tiers.map((t, i) => (
            <div key={i} className="w-20 flex justify-center relative z-10">
              <span
                className={`rounded-full ${
                  i === 0 ? "w-3 h-3 bg-sky-500 ring-4 ring-sky-100" : "w-2 h-2 bg-gray-300"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-8 sm:gap-12">
          {tiers.map((t, i) => (
            <div key={i} className="w-20 text-center text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              от {t.amount.toLocaleString("ru-RU")} ₸
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConditionsList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-600 text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function DiscountsPage() {
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
              <span className="text-gray-600 font-medium">Скидки</span>
            </nav>
          </div>
        </div>

        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="mb-8 max-w-2xl">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Скидки</h1>
            <p className="text-sm text-gray-400">
              Для наших оптовых партнеров мы предоставляем следующую систему скидок.
            </p>
          </div>

          <div className="space-y-6">
            {/* Накопительная скидка */}
            <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8">
              <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-2">Накопительная скидка</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-2xl">
                Размер скидки зависит от суммы заказов за последние 30 дней. Такая система скидок
                выгодна, если вы можете влиять на объем заказов и удерживать его на заявленном уровне —
                скидка пересчитывается каждый день по итогам суммы заказов за последние 30 дней от
                текущей даты. Сумма чека на момент покупки не учитывается.
              </p>

              <TierScale tiers={CUMULATIVE_DISCOUNT_TIERS} />

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Условия получения скидки</h3>
                <ConditionsList
                  items={[
                    "Регистрация как оптового покупателя: ФИО, адрес нахождения, название магазина/Instagram, номер телефона.",
                    "Информирование продавца о наличии накопительной скидки при каждой покупке.",
                  ]}
                />
              </div>
            </div>

            {/* Прогрессивная / разовая скидка */}
            <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8">
              <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-2">
                Прогрессивная скидка <span className="text-gray-400 font-medium">(разовая)</span>
              </h2>
              <p className="text-sm text-gray-500 mb-6 max-w-2xl">
                Размер скидки зависит от общей суммы заказа в момент оформления покупки. Скидка
                действует единожды — на тот заказ, с которым была достигнута итоговая сумма.
                Применяется автоматически в корзине.
              </p>

              <TierScale tiers={ONE_TIME_DISCOUNT_TIERS} />

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Условия получения скидки</h3>
                <ConditionsList
                  items={[
                    "Осуществление закупки на соответствующую сумму.",
                    "Скидка рассчитывается и применяется автоматически при оформлении заказа.",
                  ]}
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4">
                <p className="text-sm text-sky-700">
                  Для получения индивидуальных скидок нужно обратиться к менеджеру.
                </p>
                <a
                  href="/contacts"
                  className="flex-shrink-0 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors"
                >
                  Связаться с менеджером
                </a>
              </div>
            </div>

            {/* Важно */}
            <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8">
              <h3 className="text-sm font-bold text-gray-800 mb-1">Важно!</h3>
              <p className="text-sm text-gray-500">
                Определенные категории товаров отпускаются без скидки или с ограничением процента скидки.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingCart />
    </>
  );
}
