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
  if (src.includes(SUPABASE_HOST)) {
    const url = new URL(src)
    url.pathname = url.pathname.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    )
    url.searchParams.set('width', String(width))
    url.searchParams.set('quality', String(quality ?? 75))
    url.searchParams.set('format', 'webp')
    return url.toString()
  }
  // Non-Supabase images (e.g. donballon.ru) — serve directly without Vercel optimization
  return src
}
