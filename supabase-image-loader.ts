'use client'

// Old cloud project — already serves HTTPS directly, no proxying needed.
const SUPABASE_HOST_OLD = 'tjoreojidkjhfksspbwe.supabase.co'
// New self-hosted instance (see project_domain_serverhold_migration memory) —
// Storage has no HTTPS in front of it yet, so a browser on this https:// site
// auto-upgrades http://85.198.91.200:8000/... to https, finds nothing
// listening, and the image just fails. Route it through our own
// same-origin /api/img-proxy instead (server-side fetch, no mixed-content
// concept) until a real TLS-terminated storage domain exists.
const SUPABASE_HOST_NEW = '85.198.91.200:8000'

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}) {
  if (src.includes(SUPABASE_HOST_NEW)) {
    return `/api/img-proxy?src=${encodeURIComponent(src.split('?')[0])}`
  }

  // Supabase render endpoint (/storage/v1/render/image/public/...) produces broken output
  // at small widths (e.g. 445×445 source → 64×500 at width=128). Always serve originals
  // via /storage/v1/object/public/ — sources are ≤445px, browser handles the downscale.
  if (!src.includes(SUPABASE_HOST_OLD)) return src

  // Convert render URL → object URL and strip any ?width/quality query params
  return src
    .replace('/storage/v1/render/image/', '/storage/v1/object/')
    .split('?')[0]
}
