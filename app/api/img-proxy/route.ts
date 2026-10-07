import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// The new self-hosted Supabase instance has no HTTPS in front of Storage yet
// (see project_domain_serverhold_migration memory) — modern browsers
// auto-upgrade an <img src="http://..."> on this https:// site to https and
// fail outright, since nothing answers TLS on that port. Proxying the fetch
// through our own server sidesteps that entirely: the browser only ever talks
// to sharmaster.kz over HTTPS, and this route fetches the real bytes
// server-side (Node has no mixed-content concept).
//
// supabase-image-loader.ts bypasses Next's built-in optimizer, so this route is
// also the only place photos get resized/re-encoded: sources are up to ~1000px
// jpg/png, while a catalog card needs ~300px. Serving webp at the requested
// width cuts card payload by roughly an order of magnitude.
//
// Only next-config-allowed hosts may be requested, to prevent this becoming an
// open SSRF proxy.
const ALLOWED_HOSTS = new Set(["85.198.91.200:8000", "tjoreojidkjhfksspbwe.supabase.co"]);

// Widths are snapped to this ladder so the disk cache stays small and a
// hostile ?w= can't make us encode arbitrary sizes.
const WIDTHS = [96, 128, 256, 384, 640, 828, 1080];
const CACHE_DIR = path.join(tmpdir(), "sharmaster-img-cache");
const CACHE_HEADERS = {
  // Immutable product photos (a re-uploaded file gets a new path) — same TTL
  // as next.config.ts's images.minimumCacheTTL.
  "Cache-Control": "public, max-age=31536000, immutable",
};

// Sharp encoding is CPU-bound; cap how many one client can run at once so a
// parallel downloader can't monopolise the process. Browsers open ~6 per host.
const MAX_INFLIGHT_PER_IP = 10;
const inflight = new Map<string, number>();

function snapWidth(w: number) {
  return WIDTHS.find((x) => x >= w) ?? WIDTHS[WIDTHS.length - 1];
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const n = inflight.get(ip) ?? 0;
  if (n >= MAX_INFLIGHT_PER_IP) {
    return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "5" } });
  }
  inflight.set(ip, n + 1);
  try {
    return await handle(req);
  } finally {
    const left = (inflight.get(ip) ?? 1) - 1;
    if (left <= 0) inflight.delete(ip);
    else inflight.set(ip, left);
  }
}

async function handle(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return NextResponse.json({ error: "missing src" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return NextResponse.json({ error: "invalid src" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(url.host)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }
  // Storage URLs only — never an arbitrary path on an allowed host.
  if (!url.pathname.startsWith("/storage/v1/object/public/")) {
    return NextResponse.json({ error: "path not allowed" }, { status: 400 });
  }
  // Old-host links are https; the new host is plain http (see above).
  url.protocol = url.host === "85.198.91.200:8000" ? "http:" : "https:";
  url.search = "";

  // Always re-encoded: a missing/bad ?w= falls back to the largest rung, never
  // the untouched original (full-resolution files are not for bulk download).
  const wParam = Number(req.nextUrl.searchParams.get("w"));
  const width = snapWidth(Number.isFinite(wParam) && wParam > 0 ? wParam : WIDTHS[WIDTHS.length - 1]);

  const cacheFile = path.join(
    CACHE_DIR,
    createHash("sha1").update(`${url.toString()}|${width}`).digest("hex") + ".webp",
  );
  const headers = { "Content-Type": "image/webp", ...CACHE_HEADERS };

  try {
    return new NextResponse(new Uint8Array(await readFile(cacheFile)), { status: 200, headers });
  } catch {
    // cache miss
  }

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }
  const input = Buffer.from(await upstream.arrayBuffer());

  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    // Not decodable by sharp — serve the original rather than a broken square.
    return new NextResponse(new Uint8Array(input), {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        ...CACHE_HEADERS,
      },
    });
  }

  // Best-effort cache write; a failure just means we re-encode next time.
  mkdir(CACHE_DIR, { recursive: true })
    .then(() => writeFile(cacheFile, output))
    .catch(() => {});

  return new NextResponse(new Uint8Array(output), { status: 200, headers });
}
