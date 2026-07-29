/**
 * Shared file-grouping logic for "Оборудование и аксессуары" import.
 * Used by both upload-oborudovanie-to-storage.ts and (transitively) the bucket scan
 * in link-onec-images.ts, which reads storage keys directly — this only needs to
 * agree with the upload script on what key each local file gets.
 */
import { readdirSync, statSync } from 'fs'
import { resolve, join, extname } from 'path'

export const SOURCE_DIR = resolve(process.cwd(), 'All the Files with material here/Оборудование и аксессуары')
export const BUCKET = 'Oborudovanie-i-aksessuary'
export const PREFIX = 'images/'

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

const CYR: Record<string, string> = {
  А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'Yo',Ж:'Zh',З:'Z',И:'I',Й:'Y',
  К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',
  Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Shch',Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya',
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}
export function sanitize(s: string): string {
  return s.split('').map(c => CYR[c] ?? c).join('').replace(/[^a-zA-Z0-9_-]/g, '')
}

export type Group = { code: string; head: string; extras: string[] }

/**
 * code -> { head: local path, extras: local paths[] }, deterministic (sorted) ordering.
 * Original codes are grouped as-is (e.g. "3000041-B" and "3000041-Б" stay separate
 * groups — they are genuinely different products, see module comment on collisions).
 */
export function groupFiles(): Map<string, Group> {
  const files = walk(SOURCE_DIR)
  const byCode = new Map<string, string[]>()
  for (const f of files) {
    const code = f.split('/').pop()!.split('_')[0]
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(f)
  }
  const groups = new Map<string, Group>()
  for (const [code, paths] of byCode) {
    paths.sort()
    groups.set(code, { code, head: paths[0], extras: paths.slice(1) })
  }
  return groups
}

/**
 * Storage key base (no extension/ordinal) for each original code, collision-safe:
 * if two different original codes sanitize to the same ASCII string (e.g. Latin "B"
 * vs Cyrillic "Б" look-alike suffixes), the lexicographically-first original code
 * keeps the plain sanitized form and the rest get a "-2", "-3"... suffix so neither
 * upload silently overwrites the other.
 */
export function buildStorageBases(groups: Map<string, Group>): Map<string, string> {
  const bySanitized = new Map<string, string[]>()
  for (const code of groups.keys()) {
    const s = sanitize(code)
    if (!bySanitized.has(s)) bySanitized.set(s, [])
    bySanitized.get(s)!.push(code)
  }
  const bases = new Map<string, string>()
  for (const [s, codes] of bySanitized) {
    codes.sort()
    codes.forEach((code, i) => bases.set(code, i === 0 ? s : `${s}-${i + 1}`))
  }
  return bases
}

/** Storage key for a local file within a group: head -> {base}.ext, extras -> {base}_{n}.ext */
export function keyFor(group: Group, localPath: string, base: string): string {
  const ext = extname(localPath).toLowerCase()
  if (localPath === group.head) return `${PREFIX}${base}${ext}`
  const n = group.extras.indexOf(localPath) + 1
  return `${PREFIX}${base}_${n}${ext}`
}

export function publicUrl(supabaseUrl: string, key: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${key}`
}
