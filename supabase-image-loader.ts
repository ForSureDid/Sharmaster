'use client'

const SUPABASE_HOST = 'tjoreojidkjhfksspbwe.supabase.co'

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
  if (!src.includes(SUPABASE_HOST)) return src

  // Convert render URL → object URL and strip any ?width/quality query params
  return src
    .replace('/storage/v1/render/image/', '/storage/v1/object/')
    .split('?')[0]
}
