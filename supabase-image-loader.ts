'use client'

// Old cloud project and new self-hosted instance, mid-transition (see
// project_domain_serverhold_migration memory) — both can appear in
// OnecStockItem.imageUrl/images until the DB backfill to the new host finishes.
const SUPABASE_HOSTS = ['tjoreojidkjhfksspbwe.supabase.co', '85.198.91.200:8000']

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}) {
  // Supabase render endpoint (/storage/v1/render/image/public/...) produces broken output
  // at small widths (e.g. 445×445 source → 64×500 at width=128). Always serve originals
  // via /storage/v1/object/public/ — sources are ≤445px, browser handles the downscale.
  if (!SUPABASE_HOSTS.some((h) => src.includes(h))) return src

  // Convert render URL → object URL and strip any ?width/quality query params
  return src
    .replace('/storage/v1/render/image/', '/storage/v1/object/')
    .split('?')[0]
}
