const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function chunk(n: number, feminine = false): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(hundreds[h])
  if (rest < 20) {
    const w = feminine ? onesF[rest] : ones[rest]
    if (w) parts.push(w)
  } else {
    const t = Math.floor(rest / 10), o = rest % 10
    if (t) parts.push(tens[t])
    const w = feminine ? onesF[o] : ones[o]
    if (w) parts.push(w)
  }
  return parts.join(' ')
}

export function amountInWords(amount: number): string {
  const intPart = Math.floor(amount)
  const parts: string[] = []

  const billions = Math.floor(intPart / 1_000_000_000)
  const millions = Math.floor((intPart % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((intPart % 1_000_000) / 1_000)
  const remainder = intPart % 1_000

  if (billions) {
    parts.push(chunk(billions))
    parts.push(plural(billions, 'миллиард', 'миллиарда', 'миллиардов'))
  }
  if (millions) {
    parts.push(chunk(millions))
    parts.push(plural(millions, 'миллион', 'миллиона', 'миллионов'))
  }
  if (thousands) {
    parts.push(chunk(thousands, true))
    parts.push(plural(thousands, 'тысяча', 'тысячи', 'тысяч'))
  }
  if (remainder || intPart === 0) {
    parts.push(chunk(remainder))
  }

  const tenge = plural(intPart, 'тенге', 'тенге', 'тенге')
  return `${parts.filter(Boolean).join(' ')} ${tenge} 00 тиын`.trim()
}
