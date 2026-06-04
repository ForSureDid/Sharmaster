import sharp from "sharp";
import { readdir } from "fs/promises";
import { join } from "path";

const ICONS_DIR = new URL("../public/icons", import.meta.url).pathname;
const TOLERANCE = 30; // how close to white counts as background

function isNearWhite(r, g, b) {
  return r >= 255 - TOLERANCE && g >= 255 - TOLERANCE && b >= 255 - TOLERANCE;
}

async function removeBg(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const { width, height } = await image.metadata();
  const raw = await image.raw().toBuffer();

  const channels = 4; // RGBA
  const visited = new Uint8Array(width * height);
  const queue = [];

  const idx = (x, y) => (y * width + x) * channels;
  const mark = (x, y) => {
    const i = y * width + x;
    if (visited[i]) return;
    const p = idx(x, y);
    const r = raw[p], g = raw[p + 1], b = raw[p + 2];
    if (!isNearWhite(r, g, b)) return;
    visited[i] = 1;
    queue.push(x, y);
  };

  // Seed from all four edges
  for (let x = 0; x < width; x++) { mark(x, 0); mark(x, height - 1); }
  for (let y = 0; y < height; y++) { mark(0, y); mark(width - 1, y); }

  // BFS flood fill
  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++];
    const p = idx(x, y);
    raw[p + 3] = 0; // make transparent
    const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) mark(nx, ny);
    }
  }

  await sharp(raw, { raw: { width, height, channels } })
    .png()
    .toFile(filePath + ".tmp");

  const { rename } = await import("fs/promises");
  await rename(filePath + ".tmp", filePath);
  console.log("✓", filePath.split("/").pop());
}

const files = (await readdir(ICONS_DIR)).filter(f => f.endsWith(".png"));
for (const f of files) {
  await removeBg(join(ICONS_DIR, f));
}
console.log("All done.");
