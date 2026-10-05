// Keyboard-layout and phonetic bridges for a Russian search query typed in
// Latin letters. Two distinct real-world cases:
//
//  1. Layout mismatch — the shopper's keyboard is stuck on EN while muscle
//     memory types a Cyrillic word, so each keystroke lands on the Latin
//     letter at the SAME PHYSICAL KEY as the intended Cyrillic letter in the
//     standard ЙЦУКЕН layout (e.g. "шар" -> "ifh", since Ш/А/Р sit on the
//     I/F/H keys). Produces unreadable-looking Latin gibberish.
//  2. Phonetic transliteration — the shopper intentionally spells the
//     Russian word out in Latin letters ("shar", "rozovye") — the same
//     scheme lib/slug.ts uses for URLs, just reversed.
//
// Both candidates are generated for every pure-Latin query word and OR'd
// into the search alongside the literal word and WORD_SYNONYMS (see
// lib/onecStock.ts's buildStockWhere) — never replacing it, so an actual
// Latin brand name (Sempertex, Grabo) keeps matching too. A wrong guess here
// is harmless: it's just one more OR branch that happens not to match
// anything real.

const LAYOUT_EN_TO_RU: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з',
  a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д',
  z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь',
  // Punctuation row of the standard ЙЦУКЕН layout — a shopper typing "смайлберри"
  // with the keyboard stuck on EN hits the comma key for "б" (it's that key's
  // RU output), producing e.g. "cvfqk,thhb". Without these the layout bridge
  // silently drops that letter instead of reconstructing the word.
  ',': 'б', '.': 'ю', ';': 'ж', "'": 'э', '[': 'х', ']': 'ъ',
}

export function layoutToCyrillic(word: string): string {
  return word.toLowerCase().split('').map((c) => LAYOUT_EN_TO_RU[c] ?? c).join('')
}

// Reverse of lib/slug.ts's CYR table — longest sequence first so "sh"/"ch"/
// "zh"/"kh"/"ts"/"yo"/"yu"/"ya"/"shch" aren't split into single-letter parts.
// Ambiguous reverse mappings (ы and й both transliterate to "y" going
// forward, so bare "y" is guessed as "ы" here) are an accepted imprecision —
// it's an OR'd extra candidate (see module comment above), and the
// ambiguity usually lands on a word's final letter, which
// lib/searchQuery.ts's stemRu suffix-stripping trims off before comparison.
const PHONETIC_MULTI: Array<[string, string]> = [
  ['shch', 'щ'], ['yo', 'ё'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'],
  ['ch', 'ч'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'],
]
const PHONETIC_SINGLE: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', y: 'ы',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т',
  u: 'у', f: 'ф', h: 'х', c: 'ц',
}

export function phoneticToCyrillic(word: string): string {
  const lower = word.toLowerCase()
  let out = ''
  let i = 0
  outer: while (i < lower.length) {
    for (const [latin, cyr] of PHONETIC_MULTI) {
      if (lower.startsWith(latin, i)) { out += cyr; i += latin.length; continue outer }
    }
    out += PHONETIC_SINGLE[lower[i]] ?? lower[i]
    i += 1
  }
  return out
}

// Layout mismatches can carry the RU-punctuation-row characters (see
// LAYOUT_EN_TO_RU above); the phonetic scheme has no use for punctuation, so
// its candidate is computed from the letters alone.
const LAYOUT_CANDIDATE_RE = /^[a-z,.;'[\]]+$/i

/** Both Cyrillic candidates for a Latin(+RU-layout-punctuation) query word, deduped. Returns [] for anything else (Cyrillic, digits, …). */
export function latinToCyrillicCandidates(word: string): string[] {
  if (!LAYOUT_CANDIDATE_RE.test(word) || !/[a-z]/i.test(word)) return []
  const lettersOnly = word.replace(/[^a-z]/gi, '')
  return [...new Set([layoutToCyrillic(word), phoneticToCyrillic(lettersOnly)])]
}
