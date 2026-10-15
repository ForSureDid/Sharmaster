// Downloads the tile illustrations from donballon.ru/collections (their SVG/PNG icons) into
// public/collections/db/{slug}.{ext} and writes lib/collection-icons.json ({slug: ext}).
// Input: donballon.ru/collections HTML saved locally (arg 1) — tiles are
// `data-src="/upload/..."` + `categories-tiles__tile-name`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { baseSlug } from '../lib/slug'

async function main() {
  const h = readFileSync(process.argv[2], 'utf8')
  const out = join(process.cwd(), 'public/collections/db'); mkdirSync(out, { recursive: true })
  const re = /data-src="(\/upload\/[^"]+)"[^>]*alt="">\s*<\/div>\s*<div class="categories-tiles__tile-name">([^<]+)<\/div>/g
  const icons: Record<string, string> = {}
  for (const m of h.matchAll(re)) {
    const name = m[2].trim(), ext = extname(m[1]).slice(1).toLowerCase(), slug = baseSlug(name)
    const r = await fetch('https://www.donballon.ru' + m[1], { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) { console.log('FAIL', name, r.status); continue }
    writeFileSync(join(out, `${slug}.${ext}`), Buffer.from(await r.arrayBuffer()))
    icons[slug] = ext
  }
  writeFileSync(join(process.cwd(), 'lib/collection-icons.json'), JSON.stringify(icons, null, 1) + '\n')
  console.log(Object.keys(icons).length, 'icons')
}
main()
