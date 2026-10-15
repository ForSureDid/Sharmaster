// Resumable: generates a themed cover image per public collection (see
// lib/collections.ts) with OpenAI gpt-image-1 -> public/collections/{slug}.webp,
// then rewrites lib/collection-covers.json (slugs that have a file).
//
//   npx tsx scripts/generate-collection-covers.ts            # all missing
//   npx tsx scripts/generate-collection-covers.ts 4          # first N missing (style test)
//   npx tsx scripts/generate-collection-covers.ts promo      # only the hero card
//
// The promo hero is generated via images/edits from public/occasions/promo-card.webp (style reference).
// Prompts deliberately describe the THEME generically (no brand/character names) so the
// model doesn't reproduce licensed characters — see THEME_HINTS for per-collection wording.
import 'dotenv/config'
import { Client } from 'pg'
import sharp from 'sharp'
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { baseSlug } from '../lib/slug'
import { MIN_ITEMS, SHOWN_COLLECTIONS } from '../lib/collectionsConfig'

const OUT = join(process.cwd(), 'public/collections')
const STYLE =
  'Square product-category cover for a party-balloon online store. Glossy 3D-rendered style, soft studio lighting, ' +
  'a tidy cluster of shiny helium balloons (latex and foil) as the hero, with a few small thematic 3D props, ' +
  'smooth pastel gradient background in colors that fit the theme, gentle shadows, lots of depth. ' +
  'Cheerful and premium, not photorealistic. No text, no letters, no logos, no watermarks, no real brand characters.'

// Collections whose name is a licensed franchise / ambiguous -> neutral wording.
const THEME_HINTS: Record<string, string> = {
  'Человек Паук': 'a red-and-blue superhero with web motifs (generic, not a specific character)',
  'Бэтмен': 'dark-knight superhero theme: black, yellow, bat-wing shapes (generic)',
  'Щенячий Патруль': 'cute rescue puppies in colorful uniforms (generic cartoon dogs)',
  'Холодное Сердце': 'icy winter-queen fairytale: snowflakes, ice-blue and silver',
  'Гарри Поттер': 'young wizard school theme: owls, lightning-shaped wand, castle towers',
  'Барби': 'glamorous pink doll-fashion theme',
  'Герои в масках PJ Masks': 'three small night-time hero kids with animal masks (generic)',
  'Покемон Пикачу': 'cute yellow electric mouse-like monster with lightning bolts (generic)',
  'Level Up! Джойстик': 'video-game theme with joysticks and pixel stars',
  'Оскорбления': 'cheeky adult humor',
  'Happy Birthday': 'classic birthday party: cake, candles, confetti',
  'TNT Party': 'bold neon party with explosive confetti',
  'Цифры и числа': 'giant foil number balloons 0-9 with confetti',
  'Текстовые дизайны': 'balloons with decorative script-like patterns (no readable words)',
  'Я родился': 'newborn baby celebration: soft baby-blue and pink, pacifier, stork',
}

function prompt(name: string) {
  const hint = THEME_HINTS[name] ?? `the theme "${name}"`
  return `${STYLE}\nTheme: ${hint}.`
}

async function gen(p: string): Promise<Buffer> {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: p, size: '1024x1024', quality: 'medium', n: 1 }),
  })
  const j: any = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300))
  return Buffer.from(j.data[0].b64_json, 'base64')
}

async function save(slug: string, png: Buffer, size = 720) {
  await sharp(png).resize(size, size).webp({ quality: 82 }).toFile(join(OUT, `${slug}.webp`))
}

function writeIndex() {
  const slugs = readdirSync(OUT).filter((f) => f.endsWith('.webp') && f !== 'promo-card.webp').map((f) => f.replace('.webp', ''))
  writeFileSync(join(process.cwd(), 'lib/collection-covers.json'), JSON.stringify(slugs.sort(), null, 1) + '\n')
  console.log('index:', slugs.length, 'covers')
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const arg = process.argv[2]
  if (arg === 'promo') {
    // Hero in the style of public/occasions/promo-card.webp ("Товары к праздникам"): that image is sent as the
    // style reference to the images/edits endpoint, content swapped to collection themes (animal/unicorn/dino foil figures).
    const ref = await sharp(join(process.cwd(), 'public/occasions/promo-card.webp')).png().toBuffer()
    const form = new FormData()
    form.append('model', 'gpt-image-1')
    form.append('image', new Blob([new Uint8Array(ref)], { type: 'image/png' }), 'ref.png')
    form.append('size', '1024x1536'); form.append('quality', 'medium')
    form.append('prompt',
      'Create a NEW illustration in exactly the same art style, palette, glossy cartoon rendering, sky-blue to soft-pink gradient background and composition as the reference image, ' +
      'but with different content: a bouquet of themed foil figure balloons — a cute unicorn, a green dinosaur, a tiger, a butterfly, a cat, a rainbow, a little race car — ' +
      'plus a few pastel round balloons, a bit of confetti and small stars. Same portrait layout with a bouquet in the middle and cute props at the bottom. ' +
      'No text, no letters, no numbers, no logos, no real brand characters.')
    const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form })
    const j: any = await r.json()
    if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300))
    await sharp(Buffer.from(j.data[0].b64_json, 'base64')).resize(800, 1200).webp({ quality: 82 }).toFile(join(OUT, 'promo-card.webp'))
    console.log('promo done'); return
  }
  const limit = arg ? parseInt(arg, 10) : Infinity
  const c = new Client({ connectionString: process.env.DIRECT_URL }); await c.connect()
  const { rows } = await c.query(
    `select c as collection, count(*)::int n from "OnecStockItem", unnest(collections) c where "isHidden"=false group by 1 order by n desc`)
  await c.end()
  // Same slug rule + ordering as lib/collections.ts
  const used = new Set<string>(); const todo: { name: string; slug: string }[] = []
  let i = 0
  for (const r of rows) {
    if (r.n < MIN_ITEMS || !SHOWN_COLLECTIONS.has(r.collection)) continue
    let slug = baseSlug(r.collection); if (used.has(slug)) slug = `${slug}-${i}`; used.add(slug); i++
    if (!existsSync(join(OUT, `${slug}.webp`))) todo.push({ name: r.collection, slug })
  }
  console.log(todo.length, 'missing')
  let done = 0
  for (const t of todo.slice(0, limit)) {
    try { await save(t.slug, await gen(prompt(t.name))); done++; console.log('ok', t.slug) }
    catch (e: any) { console.log('FAIL', t.slug, e.message) }
  }
  writeIndex(); console.log('generated', done)
}
main()
