// Natural-language query understanding for the catalog/header search box.
// Pure functions, no DB access — turns free text like "50 розовых шаров 12
// дюймов на день рождения девочки" into structured filters (color, shade,
// brand, size, price, occasion, quantity) plus a cleaned list of leftover
// words for the traditional name/brand/article text match in lib/onecStock.ts.
//
// Every dictionary below is grounded in the *actual* distinct column values
// in OnecStockItem (checked against the live DB on 2026-09-13) — colorGroup,
// shade and brand are exact-match filters, so mapping to a value that never
// occurs in the data would silently zero out results instead of helping.

// ─── Normalization ──────────────────────────────────────────────────────────

export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Typo tolerance ─────────────────────────────────────────────────────────
//
// Generic edit-distance against a short dictionary is a false-positive trap —
// tried it, and it "corrected" the unrelated word "такого" to the shade
// "Лаковый" on a pure gibberish query. A word only gets typo-corrected here
// if it's on this explicit, human-reviewed list; anything else that isn't an
// exact (stemmed) dictionary hit falls through to the free-text search below,
// where the *real* natural-language handling — the pgvector embedding search
// in getVectorItemIds — takes over instead of a guess.
const TYPO_ALIASES: Record<string, string> = {
  'розавые': 'розовый', 'розавый': 'розовый', 'розовыи': 'розовый',
  'фолга': 'фольга',
  'квалотекс': 'квалатекс', 'куалатэкс': 'квалатекс',
  'симпертекс': 'семпертекс', 'семпертэкс': 'семпертекс',
  'серебрянный': 'серебряный', 'сериневый': 'сиреневый',
}

// Crude Russian suffix stripper — bridges inflection gaps ("шаров" -> "шар",
// "розовые" -> "розов") for both dictionary lookups and the leftover-word
// `contains` search. Not a real stemmer, just enough to raise recall.
const RU_SUFFIXES = [
  'иями', 'ями', 'ами', 'ыми', 'его', 'ому', 'ему', 'ими',
  'ов', 'ев', 'ей', 'ах', 'ях', 'ию', 'ие', 'ые', 'ой', 'ый', 'ая', 'яя', 'ое', 'ее', 'их', 'ых', 'ям', 'ам', 'ем', 'им', 'ым',
  'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'й',
].sort((a, b) => b.length - a.length)

export function stemRu(word: string): string {
  if (word.length <= 4 || /[a-z]/i.test(word)) return word
  for (const suf of RU_SUFFIXES) {
    if (word.endsWith(suf) && word.length - suf.length >= 3) return word.slice(0, -suf.length)
  }
  return word
}

function buildStemmedIndex<T>(base: Record<string, T>): { map: Map<string, T> } {
  const map = new Map<string, T>()
  for (const [k, v] of Object.entries(base)) map.set(stemRu(k), v)
  return { map }
}

function resolveFromDict<T>(word: string, index: { map: Map<string, T> }): { value: T; corrected: boolean } | null {
  const direct = index.map.get(stemRu(word))
  if (direct !== undefined) return { value: direct, corrected: false }

  const alias = TYPO_ALIASES[word]
  if (alias) {
    const aliased = index.map.get(stemRu(alias))
    if (aliased !== undefined) return { value: aliased, corrected: true }
  }
  return null
}

// ─── Dictionaries (grounded in live OnecStockItem.colorGroup/shade/brand) ──

const COLOR_BASE: Record<string, string> = {
  'розовый': 'Розовый', 'pink': 'Розовый', 'пинк': 'Розовый',
  'голубой': 'Голубой', 'baby blue': 'Голубой', 'бебиблю': 'Голубой',
  'синий': 'Синий', 'blue': 'Синий',
  'красный': 'Красный', 'red': 'Красный', 'алый': 'Красный',
  'белый': 'Белый', 'white': 'Белый',
  'черный': 'Черный', 'black': 'Черный',
  'золотой': 'Золото', 'золото': 'Золото', 'gold': 'Золото', 'золотистый': 'Золото',
  'серебряный': 'Серебро', 'серебро': 'Серебро', 'silver': 'Серебро', 'серебристый': 'Серебро',
  'зеленый': 'Зеленый', 'green': 'Зеленый',
  'желтый': 'Желтый', 'yellow': 'Желтый',
  'оранжевый': 'Оранжевый', 'orange': 'Оранжевый',
  'фиолетовый': 'Фиолетовый', 'purple': 'Фиолетовый', 'violet': 'Фиолетовый',
  'сиреневый': 'Сиреневый', 'lilac': 'Сиреневый', 'лиловый': 'Сиреневый',
  'бежевый': 'Бежевый', 'beige': 'Бежевый',
  'персиковый': 'Персиковый', 'peach': 'Персиковый',
  'прозрачный': 'Прозрачный', 'clear': 'Прозрачный', 'transparent': 'Прозрачный',
  'бирюзовый': 'Бирюзовый', 'turquoise': 'Бирюзовый', 'тиффани': 'Бирюзовый',
  'бордовый': 'Бордовый', 'burgundy': 'Бордовый', 'марсала': 'Бордовый',
  'фуше': 'Фуше', 'фуксия': 'Фуше', 'fuchsia': 'Фуше', 'фуксиевый': 'Фуше',
  'шоколадный': 'Шоколадный', 'chocolate': 'Шоколадный', 'коричневый': 'Шоколадный',
  'ассорти': 'Ассорти', 'разноцветный': 'Ассорти', 'микс': 'Ассорти', 'mix': 'Ассорти', 'разные цвета': 'Ассорти',
}

const SHADE_BASE: Record<string, string> = {
  'хром': 'Хром', 'хромированный': 'Хром', 'chrome': 'Хром', 'хромовый': 'Хром',
  'пастель': 'Пастель', 'пастельный': 'Пастель', 'pastel': 'Пастель',
  'металлик': 'Металлик', 'metallic': 'Металлик', 'металлический': 'Металлик',
  'матовый': 'Матовый', 'matte': 'Матовый', 'matt': 'Матовый',
  'глиттер': 'Глиттер', 'glitter': 'Глиттер', 'блестки': 'Глиттер',
  'неон': 'Неон', 'неоновый': 'Неон', 'neon': 'Неон',
  'перламутр': 'Перламутр', 'перламутровый': 'Перламутр', 'pearl': 'Перламутр',
  'сатин': 'Сатин', 'сатиновый': 'Сатин', 'satin': 'Сатин',
  'голография': 'Голография', 'голографический': 'Голография', 'holographic': 'Голография', 'голограмма': 'Голография',
  'кристалл': 'Кристалл', 'crystal': 'Кристалл', 'кристальный': 'Кристалл',
  'агат': 'Агат', 'agate': 'Агат',
  'хамелеон': 'Хамелеон', 'chameleon': 'Хамелеон',
  'флуор': 'Флуор', 'флуоресцентный': 'Флуор', 'fluo': 'Флуор',
  'лаковый': 'Лаковый', 'глянцевый': 'Лаковый',
  'бохо': 'Бохо', 'boho': 'Бохо',
  'макарунс': 'Макарунс', 'macaron': 'Макарунс', 'macarons': 'Макарунс',
}

// Real distinct OnecStockItem.brand values, keyed by the cyrillic/latin/typo'd
// forms a shopper is likely to type. Some brands have two spellings live in
// the DB at once (Grabo / "Grabo S.r.l.", Flex Metal / Flexmetal) — map to
// both so the `brand: { in: [...] }` filter catches every row.
const BRAND_BASE: Record<string, string[]> = {
  'sempertex': ['Sempertex S.A.'], 'семпертекс': ['Sempertex S.A.'],
  'qualatex': ['Qualatex'], 'квалатекс': ['Qualatex'], 'куалатекс': ['Qualatex'],
  'grabo': ['Grabo', 'Grabo S.r.l.'], 'грабо': ['Grabo', 'Grabo S.r.l.'],
  'flexmetal': ['Flex Metal', 'Flexmetal'], 'flex metal': ['Flex Metal', 'Flexmetal'], 'флексметал': ['Flex Metal', 'Flexmetal'],
  'anagram': ['Anagram'], 'анаграм': ['Anagram'], 'анаграмм': ['Anagram'],
  'partydeco': ['PartyDeco'], 'party deco': ['PartyDeco'], 'партидеко': ['PartyDeco'],
  'betallic': ['Betallic'], 'беталлик': ['Betallic'],
  'agura': ['Agura'], 'агура': ['Agura'],
  'koda': ['Koda'], 'кода': ['Koda'],
  'oracal': ['Oracal'], 'оракал': ['Oracal'],
  'falali': ['Falali'], 'фалали': ['Falali'],
  'донбаллон': ['Дон Баллон'], 'дон баллон': ['Дон Баллон'], 'donballon': ['Дон Баллон'], 'don ballon': ['Дон Баллон'],
}

// Multi-word phrases matched against the whole normalized string (longest
// first) before per-word tokenization, since occasions are rarely one word.
// Target values are substrings of the real (inconsistently cased, sometimes
// semicolon-joined) OnecStockItem.occasion column — `contains insensitive`
// handles the casing, so only one canonical spelling per occasion is needed.
const OCCASION_PHRASES: Array<[string, string]> = [
  ['день рождения', 'День Рождения'], ['с днем рождения', 'День Рождения'], ['birthday', 'День Рождения'],
  ['гендер пати', 'Гендер Пати'], ['гендерпати', 'Гендер Пати'], ['гендер вечеринка', 'Гендер Пати'], ['gender party', 'Гендер Пати'], ['gender reveal', 'Гендер Пати'],
  ['новый год', 'Новый Год'], ['новогодний', 'Новый Год'], ['new year', 'Новый Год'],
  ['8 марта', '8 Марта'],
  ['14 февраля', '14 Февраля'], ['день влюбленных', '14 Февраля'], ['valentine', '14 Февраля'],
  ['23 февраля', '23 Февраля'],
  ['9 мая', '9 Мая'], ['день победы', 'День Победы'],
  ['свадьба', 'Свадьба'], ['свадебный', 'Свадьба'], ['wedding', 'Свадьба'],
  ['выпускной', 'Выпускной'], ['graduation', 'Выпускной'],
  ['1 сентября', '1 Сентября'], ['первое сентября', '1 Сентября'], ['школа', 'Школа'],
  ['юбилей', 'Юбилей'], ['anniversary', 'Юбилей'],
  ['хэллоуин', 'Хэллоуин'], ['хеллоуин', 'Хэллоуин'], ['halloween', 'Хэллоуин'],
  ['девичник', 'Девичник'], ['hen party', 'Девичник'], ['bachelorette', 'Девичник'],
  ['baby shower', 'Новорожденный'], ['беби шауэр', 'Новорожденный'], ['выписка из роддома', 'Новорожденный'], ['выписка', 'Новорожденный'], ['новорожденный', 'Новорожденный'],
  ['пасха', 'Пасха'], ['easter', 'Пасха'],
  ['масленица', 'Масленица'],
]

const BOY_WORDS = ['мальчик', 'мужчин', 'парен', 'boy']
const GIRL_WORDS = ['девочк', 'девушк', 'женщин', 'girl']

// Words that carry no product-field meaning — politeness, filler verbs,
// pronouns, generic nouns. Dropping them matters a lot more than it looks:
// the leftover words are AND-ed together in lib/onecStock.ts, so a single
// stray word like "до" or "мне" that matches nothing zeroes out every result.
const STOPWORDS = new Set([
  'мне', 'нам', 'вам', 'нужно', 'нужны', 'нужен', 'нужна', 'надо', 'хочу', 'хотим', 'хотелось', 'хотела', 'хотел',
  'купить', 'заказать', 'найти', 'ищу', 'искать', 'подскажите', 'посоветуйте', 'покажите', 'покажи', 'дайте', 'можно',
  'пожалуйста', 'для', 'на', 'во', 'в', 'с', 'со', 'из', 'от', 'до', 'по', 'к', 'ко', 'у', 'о', 'об', 'и', 'или', 'а', 'но',
  'что', 'чтобы', 'который', 'которые', 'которая', 'какой', 'какая', 'какие', 'это', 'эти', 'этот', 'эта',
  'товар', 'товары', 'штука', 'вещь', 'вещи', 'цена', 'цены', 'стоимость', 'мой', 'моя', 'мои', 'ваш', 'ваша',
  'ребенок', 'ребёнок', 'детский', 'взрослый', 'универсальный', 'подойдет', 'подойдут', 'оформить', 'оформление',
  'красивый', 'красивые', 'красивая', 'крутой', 'крутые', 'лучший', 'лучшие', 'хороший', 'хорошие', 'стильный', 'стильные', 'яркий', 'яркие', 'нежный', 'нежные',
])

// ─── Article-candidate detection ────────────────────────────────────────────

// Real article samples: "612149", "230337", "G72110", "27487P" — mostly
// digits, sometimes a short letter prefix/suffix, sometimes a dash. A bare
// 1-3 digit number ("12", "5") is never treated as an article — that's a
// balloon size or a digit-balloon number, both far more common queries.
function looksLikeArticle(rawWord: string): boolean {
  const compact = rawWord.replace(/[-_\s]/g, '')
  if (compact.length < 4 || compact.length > 12) return false
  if (!/^[a-zа-я]{0,3}\d{3,9}[a-zа-я]{0,3}$/i.test(compact)) return false
  return /\d/.test(compact)
}

// ─── Price / size / quantity extraction (regex, run on the whole string) ───

function extractPrice(text: string): { text: string; minPrice?: number; maxPrice?: number } {
  let minPrice: number | undefined
  let maxPrice: number | undefined

  text = text.replace(/от\s+(\d+)\s*(тысяч\w*|тыс\.?)?\s+до\s+(\d+)\s*(тысяч\w*|тыс\.?)?/g, (_m, lo, loK, hi, hiK) => {
    minPrice = Number(lo) * (loK ? 1000 : 1)
    maxPrice = Number(hi) * (hiK ? 1000 : 1)
    return ' '
  })

  text = text.replace(/(?:до|не\s+дороже|дешевле|максимум)\s+(\d+)\s*(тысяч\w*|тыс\.?|к\b|тенге|тг|₸)?/g, (_m, num, unit) => {
    const isThousands = !!unit && /тыс|к\b/.test(unit)
    const value = Number(num) * (isThousands ? 1000 : 1)
    if (maxPrice === undefined) maxPrice = value
    return ' '
  })

  return { text, minPrice, maxPrice }
}

function extractSize(text: string): { text: string; sizeInches?: string } {
  let sizeInches: string | undefined

  text = text.replace(/(\d{1,3})\s*(?:"|''|дюйм\w*|inch\w*|in\b)/g, (_m, num) => {
    if (sizeInches === undefined) sizeInches = String(Number(num))
    return ' '
  })

  if (sizeInches === undefined) {
    text = text.replace(/(\d{2,3})\s*см\b/g, (_m, num) => {
      sizeInches = String(Math.round(Number(num) / 2.54))
      return ' '
    })
  }

  return { text, sizeInches }
}

function extractQuantity(text: string): { text: string; quantity?: number } {
  let quantity: number | undefined

  text = text.replace(/\b(\d{2,4})((?:\s+[^\s\d]+){0,2}?)\s+(шар\w*|шт\.?|штук\w*|уп\.?|упаковк\w*)\b/gi, (_m, num, filler) => {
    if (quantity === undefined) quantity = Number(num)
    return filler
  })

  text = text.replace(/\b(нужно|надо|хочу|куплю|заказать|минимум)\s+(\d{2,4})\b/gi, (_m, verb, num) => {
    if (quantity === undefined) quantity = Number(num)
    return verb
  })

  return { text, quantity }
}

// ─── Public API ──────────────────────────────────────────────────────────

export type ParsedSearchQuery = {
  colorGroups: string[]
  shades: string[]
  brands: string[]
  occasions: string[]
  sizeInches: string | null
  minPrice: number | null
  maxPrice: number | null
  quantity: number | null
  articleCandidates: string[]
  audience: 'boy' | 'girl' | null
  /** Leftover free-text words (lightly stemmed) for the name/brand/article/barcode/colorGroup/shade/occasion OR-per-word match. */
  words: string[]
  /** Typo corrections applied while resolving color/shade/brand — not surfaced in the UI yet, kept for future "did you mean" / analytics use. */
  corrected: { from: string; to: string }[]
}

const colorIndex = buildStemmedIndex(COLOR_BASE)
const shadeIndex = buildStemmedIndex(SHADE_BASE)
const brandIndex = buildStemmedIndex(BRAND_BASE)

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  let text = normalizeQuery(raw)

  const occasions: string[] = []
  for (const [phrase, canonical] of OCCASION_PHRASES) {
    if (text.includes(phrase)) {
      text = text.split(phrase).join(' ')
      if (!occasions.includes(canonical)) occasions.push(canonical)
    }
  }

  const priceResult = extractPrice(text)
  text = priceResult.text
  const sizeResult = extractSize(text)
  text = sizeResult.text
  const qtyResult = extractQuantity(text)
  text = qtyResult.text

  const colorGroups: string[] = []
  const shades: string[] = []
  const brands: string[] = []
  const articleCandidates: string[] = []
  const corrected: { from: string; to: string }[] = []
  const words: string[] = []
  let audience: 'boy' | 'girl' | null = null

  for (const rawWord of text.split(' ')) {
    const word = rawWord.replace(/[^\wа-яё-]/gi, '')
    if (!word) continue
    if (STOPWORDS.has(word)) continue
    if (/^\d+$/.test(word)) { words.push(word); continue }

    if (looksLikeArticle(word)) {
      articleCandidates.push(word.replace(/-/g, ''))
      words.push(word)
      continue
    }

    if (BOY_WORDS.some((w) => word.startsWith(w))) { audience = audience ?? 'boy'; continue }
    if (GIRL_WORDS.some((w) => word.startsWith(w))) { audience = audience ?? 'girl'; continue }

    const color = resolveFromDict(word, colorIndex)
    if (color) {
      if (!colorGroups.includes(color.value)) colorGroups.push(color.value)
      if (color.corrected) corrected.push({ from: word, to: color.value })
      continue
    }

    const shade = resolveFromDict(word, shadeIndex)
    if (shade) {
      if (!shades.includes(shade.value)) shades.push(shade.value)
      if (shade.corrected) corrected.push({ from: word, to: shade.value })
      continue
    }

    const brand = resolveFromDict(word, brandIndex)
    if (brand) {
      for (const b of brand.value) if (!brands.includes(b)) brands.push(b)
      if (brand.corrected) corrected.push({ from: word, to: brand.value.join('/') })
      continue
    }

    words.push(stemRu(word))
  }

  return {
    colorGroups, shades, brands, occasions,
    sizeInches: sizeResult.sizeInches ?? null,
    minPrice: priceResult.minPrice ?? null,
    maxPrice: priceResult.maxPrice ?? null,
    quantity: qtyResult.quantity ?? null,
    articleCandidates: [...new Set(articleCandidates)],
    audience,
    words: [...new Set(words)],
    corrected,
  }
}

// Soft ranking bias only — never a hard filter, since gender is a guess and
// hard-filtering on it could zero out an otherwise-good result set.
export const AUDIENCE_COLOR_BOOST: Record<'boy' | 'girl', string[]> = {
  girl: ['Розовый', 'Сиреневый', 'Фиолетовый', 'Персиковый', 'Фуше', 'Золото'],
  boy: ['Голубой', 'Синий', 'Зеленый', 'Серебро'],
}
