import { NextRequest, NextResponse } from "next/server";

// The new self-hosted Supabase instance has no HTTPS in front of Storage yet
// (see project_domain_serverhold_migration memory) — modern browsers
// auto-upgrade an <img src="http://..."> on this https:// site to https and
// fail outright, since nothing answers TLS on that port. Proxying the fetch
// through our own server sidesteps that entirely: the browser only ever talks
// to sharmaster.kz over HTTPS, and this route fetches the real bytes
// server-side (Node has no mixed-content concept). The old cloud Supabase
// project already serves HTTPS directly and doesn't need this — only
// next-config-allowed hosts may be requested, to prevent this becoming an
// open SSRF proxy.
const ALLOWED_HOSTS = ["85.198.91.200:8000"];

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return NextResponse.json({ error: "missing src" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return NextResponse.json({ error: "invalid src" }, { status: 400 });
  }

  if (url.protocol !== "http:" || !ALLOWED_HOSTS.includes(url.host)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(url.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      // These are immutable product photos (a re-uploaded file gets a new
      // path) — safe to cache for a long time, same TTL as next.config.ts's
      // images.minimumCacheTTL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
