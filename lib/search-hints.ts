// Semantic search layer — synonyms and category quick-jump hints.
// Pure data: no DB imports, safe to use in both server and client code.

// When a query word matches a key, its value words are added to the OR clause.
// E.g. "фольга" → also matches products containing "фольгированный".
export const WORD_SYNONYMS: Record<string, string[]> = {
  'фольга':         ['фольгированный', 'металлик'],
  'металлик':       ['фольгированный', 'металлический'],
  'хром':           ['хромированный'],
  'пастель':        ['пастельный'],
  'латекс':         ['латексный'],
  'сердечко':       ['сердце'],
  'колбаска':       ['шдм'],
  'др':             ['день рождения'],
  'birthday':       ['день рождения'],
  'нг':             ['новый год'],
  'шарик':          ['шар'],
  'шарики':         ['шары', 'шар'],
  'воздушный':      ['шар', 'латексный'],
}

// Category quick-jump cards shown at top of the search dropdown.
// First match wins (slice 1 in Header).
export type CategoryHint = {
  label: string
  subtitle: string
  url: string
  keywords: string[]
}

export const CATEGORY_HINTS: CategoryHint[] = [
  {
    label: 'Фольгированные цифры',
    subtitle: 'цифры на день рождения и юбилей',
    url: '/catalog?q=цифра',
    keywords: ['цифра', 'цифры', 'цифру', 'число', 'числа'],
  },
  {
    label: 'Шары-сердца',
    subtitle: 'латексные и фольгированные',
    url: '/catalog?q=сердце',
    keywords: ['сердце', 'сердечко', 'сердца', 'сердечки'],
  },
  {
    label: 'ШДМ (моделирование)',
    subtitle: 'длинные шарики-колбаски',
    url: '/catalog?q=шдм',
    keywords: ['шдм', 'колбаска', 'колбаски', 'моделирование', 'скручивание'],
  },
  {
    label: 'Буквы и надписи',
    subtitle: 'фольгированные буквы алфавита',
    url: '/catalog?q=буква',
    keywords: ['буква', 'буквы', 'надпись', 'надписи', 'алфавит'],
  },
  {
    label: 'Фольгированные фигуры',
    subtitle: 'звёзды, сердца, фигуры животных',
    url: '/catalog?q=фигура',
    keywords: ['фигура', 'фигуры', 'фигурный', 'звезда', 'звезды'],
  },
  {
    label: 'Фольгированные шары',
    subtitle: 'цифры, звёзды, сердца, фигуры',
    url: '/catalog?cat=275',
    keywords: ['фольга', 'фольгированный', 'фольгированные', 'металлик'],
  },
  {
    label: 'Латексные шары',
    subtitle: 'пастель, хром, металлик, без рисунка',
    url: '/catalog?cat=268',
    keywords: ['латекс', 'латексный', 'латексные', 'пастель', 'пастельный'],
  },
  {
    label: 'День рождения',
    subtitle: 'шары, цифры, украшения, свечи',
    url: '/catalog?q=день рождения',
    keywords: ['день рождения', 'др', 'birthday', 'именины'],
  },
  {
    label: 'Новый год',
    subtitle: 'новогодние шары и украшения',
    url: '/catalog?q=новый год',
    keywords: ['новый год', 'нг', 'новогодний', 'новогодние'],
  },
  {
    label: 'Свадьба',
    subtitle: 'свадебные украшения и шары',
    url: '/catalog?q=свадьба',
    keywords: ['свадьба', 'свадебный', 'свадебные'],
  },
  {
    label: 'Гелий и оборудование',
    subtitle: 'баллоны, насосы, редукторы',
    url: '/catalog?q=гелий',
    keywords: ['гелий', 'газ', 'насос', 'компрессор', 'редуктор', 'баллон'],
  },
  {
    label: 'Конфетти',
    subtitle: 'всех видов и размеров',
    url: '/catalog?q=конфетти',
    keywords: ['конфетти'],
  },
]

// Returns the best matching category hint for a query string (or null).
export function getMatchingHint(query: string): CategoryHint | null {
  const q = query.toLowerCase()
  return (
    CATEGORY_HINTS.find((hint) =>
      hint.keywords.some((kw) => q.includes(kw.toLowerCase()))
    ) ?? null
  )
}
