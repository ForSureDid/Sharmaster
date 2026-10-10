import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ipFromHeaders } from "@/lib/rate-limit";

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

// Sharp encoding is CPU-bound, so uncached photos are encoded through a small
// global queue: a fresh catalog page (dozens of uncached cards at once) waits its
// turn instead of getting a 429 and showing broken images. Serving an already
// cached file is cheap and never counts. Only a client piling up an absurd number
// of pending encodes (a bulk downloader) is rejected.
const MAX_CONCURRENT_ENCODES = 6;
const MAX_PENDING_PER_IP = 80;
const pendingByIp = new Map<string, number>();
const waiters: (() => void)[] = [];
let activeEncodes = 0;

async function acquireEncodeSlot() {
  if (activeEncodes < MAX_CONCURRENT_ENCODES) {
    activeEncodes++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function releaseEncodeSlot() {
  const next = waiters.shift();
  if (next) next(); // hand the slot straight to the next waiter
  else activeEncodes--;
}

function snapWidth(w: number) {
  return WIDTHS.find((x) => x >= w) ?? WIDTHS[WIDTHS.length - 1];
}

const STORAGE_PREFIX = "/storage/v1/object/public/";
const NEW_HOST_BASE = "http://85.198.91.200:8000";
const OLD_HOST_BASE = "https://tjoreojidkjhfksspbwe.supabase.co";

// Public image URLs carry only an opaque bucket path (?p= new storage, ?q= old
// cloud project) — the storage host/IP never appears in a link a visitor can open
// or copy. The legacy ?src=<full url> form is still accepted so cached pages and
// old links keep working.
function resolveUpstream(params: URLSearchParams): URL | null {
  const opaque = params.get("p") ?? params.get("q");
  if (opaque !== null) {
    const segs = opaque.split("/");
    if (segs.some((seg) => !seg || seg === "." || seg === "..")) return null;
    const base = params.get("p") !== null ? NEW_HOST_BASE : OLD_HOST_BASE;
    return new URL(base + STORAGE_PREFIX + segs.map(encodeURIComponent).join("/"));
  }

  const src = params.get("src");
  if (!src) return null;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.host)) return null;
  // Storage URLs only — never an arbitrary path on an allowed host.
  if (!url.pathname.startsWith(STORAGE_PREFIX)) return null;
  // Old-host links are https; the new host is plain http (see above).
  url.protocol = url.host === "85.198.91.200:8000" ? "http:" : "https:";
  url.search = "";
  return url;
}

export async function GET(req: NextRequest) {
  return handle(req, ipFromHeaders(req.headers));
}

async function handle(req: NextRequest, ip: string) {
  const url = resolveUpstream(req.nextUrl.searchParams);
  if (!url) return NextResponse.json({ error: "bad image reference" }, { status: 400 });

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

  const pending = pendingByIp.get(ip) ?? 0;
  if (pending >= MAX_PENDING_PER_IP) {
    return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "5" } });
  }
  pendingByIp.set(ip, pending + 1);
  try {
    await acquireEncodeSlot();
    try {
      return await fetchAndEncode(url, width, cacheFile, headers);
    } finally {
      releaseEncodeSlot();
    }
  } finally {
    const left = (pendingByIp.get(ip) ?? 1) - 1;
    if (left <= 0) pendingByIp.delete(ip);
    else pendingByIp.set(ip, left);
  }
}

async function fetchAndEncode(
  url: URL,
  width: number,
  cacheFile: string,
  headers: Record<string, string>,
) {
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
