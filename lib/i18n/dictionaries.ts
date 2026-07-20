export type Locale = "ru" | "kk";

export const DEFAULT_LOCALE: Locale = "ru";

export const dictionaries = {
  ru: {
    footer: {
      disclaimer: "Все цены и условия, указанные на данном сайте, не являются публичной офертой.",
      links: {
        privacyPolicy: "Политика конфиденциальности",
        oferta: "Публичная оферта",
        delivery: "Доставка",
        returns: "Возврат и обмен",
        cookiePolicy: "Cookie",
        cookieSettings: "Настройки cookie",
      },
      copyrightHolder: "SHARMASTER",
      copyrightRights: "Все права защищены.",
    },
    cookieBanner: {
      title: "Мы используем cookie",
      description:
        "Строго необходимые cookie обеспечивают базовую работу сайта — корзину, вход в аккаунт, безопасность — и загружаются всегда. Остальные категории используются только с вашего согласия. Подробнее — в ",
      policyLinkLabel: "Политике использования cookie",
      acceptAll: "Принять все",
      rejectOptional: "Отклонить необязательные",
      openSettings: "Настройки",
      settingsTitle: "Настройки cookie",
      settingsDescription: "Выберите, какие категории cookie можно использовать. Своё решение вы можете изменить в любой момент через ссылку «Настройки cookie» в футере.",
      save: "Сохранить выбор",
      back: "Назад",
      categories: {
        necessary: {
          title: "Строго необходимые",
          description: "Работа корзины, авторизация, безопасность сессии. Всегда включены и не могут быть отключены.",
        },
        functional: {
          title: "Функциональные",
          description: "Языковые настройки, список избранного для неавторизованных пользователей, пользовательские предпочтения.",
        },
        analytics: {
          title: "Аналитические",
          description: "Google Analytics, Google Tag Manager, Yandex Metrica — статистика посещаемости и поведения на сайте.",
        },
        marketing: {
          title: "Маркетинговые",
          description: "Meta Pixel, Google Ads — оценка эффективности рекламы и ремаркетинг.",
        },
      },
    },
  },
  kk: {
    footer: {
      // Ready-made translation from the source legal package (ФУТЕР — ҚҰҚЫҚТЫҚ ЕСКЕРТПЕ, ҚАЗАҚША section).
      disclaimer: "Осы сайтта көрсетілген барлық бағалар мен шарттар жария оферта болып табылмайды.",
      links: {
        privacyPolicy: "Құпиялылық саясаты",
        oferta: "Жария оферта",
        delivery: "Жеткізу",
        returns: "Қайтару және айырбастау",
        cookiePolicy: "Cookie",
        cookieSettings: "Cookie баптаулары",
      },
      copyrightHolder: "SHARMASTER",
      copyrightRights: "Барлық құқықтар қорғалған.",
    },
    // Cookie-banner UI copy — a working translation, not yet reviewed by a
    // native speaker (unlike the footer strings above, which come straight
    // from the source legal package).
    cookieBanner: {
      title: "Біз cookie файлдарын пайдаланамыз",
      description:
        "Қатаң қажетті cookie файлдары сайттың негізгі жұмысын — себетті, аккаунтқа кіруді, қауіпсіздікті — қамтамасыз етеді және әрқашан жүктеледі. Басқа санаттар тек сіздің келісіміңізбен қолданылады. Толығырақ — ",
      policyLinkLabel: "Cookie файлдарын пайдалану саясатында",
      acceptAll: "Барлығын қабылдау",
      rejectOptional: "Міндетті емес cookie-ды қабылдамау",
      openSettings: "Баптаулар",
      settingsTitle: "Cookie баптаулары",
      settingsDescription: "Қай cookie санаттарын пайдалануға болатынын таңдаңыз. Шешіміңізді кез келген уақытта футердегі «Cookie баптаулары» сілтемесі арқылы өзгерте аласыз.",
      save: "Таңдауды сақтау",
      back: "Артқа",
      categories: {
        necessary: {
          title: "Қатаң қажетті",
          description: "Себеттің жұмысы, аутентификация, сессия қауіпсіздігі. Әрқашан қосулы және өшірілмейді.",
        },
        functional: {
          title: "Функционалдық",
          description: "Тіл баптаулары, авторизацияланбаған пайдаланушылар үшін таңдаулылар тізімі, пайдаланушы параметрлері.",
        },
        analytics: {
          title: "Аналитикалық",
          description: "Google Analytics, Google Tag Manager, Яндекс.Метрика — сайтқа кіру статистикасы мен әрекеттер.",
        },
        marketing: {
          title: "Маркетингтік",
          description: "Meta Pixel, Google Ads — жарнаманың тиімділігін бағалау және ремаркетинг.",
        },
      },
    },
  },
} as const;

export function getDictionary(locale: Locale = DEFAULT_LOCALE) {
  return dictionaries[locale];
}
