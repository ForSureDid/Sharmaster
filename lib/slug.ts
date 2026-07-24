// URL-slug generation for OnecStockItem/OnecCategory. Same Cyrillic→Latin
// transliteration table already used by the Storage upload scripts
// (scripts/upload-belbal-to-storage.ts and friends) for consistency.

const CYR: Record<string, string> = {
  А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'Yo',Ж:'Zh',З:'Z',И:'I',Й:'Y',
  К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',
  Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Shch',Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya',
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}
function translit(s: string): string { return s.split('').map((c) => CYR[c] ?? c).join('') }

/** Base slug from a product/category name — no uniqueness handling (see below). */
export function baseSlug(name: string): string {
  const s = translit(name)
    .toLowerCase()
    .replace(/['"«»()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return s || 'item'
}

/**
 * Assigns unique slugs to a batch of {id, name} rows: computes the base slug for
 * each, and for any base slug shared by more than one row, keeps it clean on the
 * lowest id and appends "-{id}" to the rest (sorted ascending so the result is
 * deterministic across re-runs).
 */
export function assignUniqueSlugs<T extends { id: number; name: string }>(
  rows: T[]
): Map<number, string> {
  const byBase = new Map<string, T[]>()
  for (const row of rows) {
    const base = baseSlug(row.name)
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base)!.push(row)
  }

  const result = new Map<number, string>()
  for (const [base, group] of byBase) {
    if (group.length === 1) {
      result.set(group[0].id, base)
      continue
    }
    const sorted = [...group].sort((a, b) => a.id - b.id)
    sorted.forEach((row, i) => {
      result.set(row.id, i === 0 ? base : `${base}-${row.id}`)
    })
  }
  return result
}
