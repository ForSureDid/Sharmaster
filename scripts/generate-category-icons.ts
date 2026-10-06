// Generates mini colour icons for the catalog mega-menu (L1 + L2 categories) via
// the OpenAI image API, in the glossy pastel-3D style of /public/icons/*.png and
// the Sharmaster logo (blue / pink / yellow / green). Output: public/category-icons/{slug}.webp
// Resumable: skips slugs whose file already exists. Usage:
//   npx tsx scripts/generate-category-icons.ts [--only slug1,slug2] [--limit N] [--force]
import "dotenv/config";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ICON_SUBJECTS } from "./lib/category-icon-subjects";

const MODEL = "gpt-image-1.5";
const OUT_DIR = path.join(process.cwd(), "public", "category-icons");
// Image API is capped at ~5 requests/min on this org; 429s are retried below.
const CONCURRENCY = 3;

const STYLE =
  "A single minimalist 3D icon of: {SUBJECT}. Glossy soft-plastic candy look with rounded chunky shapes, " +
  "pastel palette of sky blue, bubblegum pink, sunny yellow and mint green (same style as the Sharmaster.kz logo), " +
  "soft highlights, gentle shading, ONE simple object centered with generous margin, " +
  "transparent background, no text, no letters, no shadow on the ground, no extra decorations.";

const args = process.argv.slice(2);
const flag = (n: string) => args.indexOf(n);
const only = flag("--only") >= 0 ? new Set(args[flag("--only") + 1].split(",")) : null;
const limit = flag("--limit") >= 0 ? Number(args[flag("--limit") + 1]) : Infinity;
const force = args.includes("--force");

async function exists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

async function generate(slug: string, subject: string) {
  let res: Response | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    res = await request(subject);
    if (res.status !== 429) break;
    const hint = /try again in (\d+(?:\.\d+)?)s/.exec(await res.clone().text());
    await new Promise((r) => setTimeout(r, ((hint ? Number(hint[1]) : 12) + 1 + Math.random() * 3) * 1000));
  }
  if (!res) throw new Error(`${slug}: no response`);
  return finish(slug, res);
}

function request(subject: string) {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      prompt: STYLE.replace("{SUBJECT}", subject),
      size: "1024x1024",
      quality: "medium",
      background: "transparent",
      output_format: "png",
      n: 1,
    }),
  });
}

async function finish(slug: string, res: Response) {
  if (!res.ok) throw new Error(`${slug}: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { b64_json: string }[] };
  const png = Buffer.from(json.data[0].b64_json, "base64");
  // The model leaves faint low-alpha noise in the "transparent" background, which
  // defeats trim() — zero out near-transparent pixels first.
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] < 40) data[i] = 0;
  const clean = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const webp = await sharp(clean)
    .trim()
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toBuffer();
  await writeFile(path.join(OUT_DIR, `${slug}.webp`), webp);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let todo = Object.entries(ICON_SUBJECTS).filter(([slug]) => !only || only.has(slug));
  if (!force) {
    const keep: typeof todo = [];
    for (const t of todo) if (!(await exists(path.join(OUT_DIR, `${t[0]}.webp`)))) keep.push(t);
    todo = keep;
  }
  todo = todo.slice(0, limit);
  console.log(`generating ${todo.length} icons`);
  let done = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const [slug, subject] = queue.shift()!;
        try {
          await generate(slug, subject);
          console.log(`ok ${++done}/${todo.length} ${slug}`);
        } catch (e) {
          console.error("FAIL", (e as Error).message.slice(0, 300));
        }
      }
    }),
  );
}
main();
