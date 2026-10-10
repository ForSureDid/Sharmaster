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
}: {
  src: string
  width: number
  quality?: number
}) {
  const isNew = src.includes(SUPABASE_HOST_NEW)
  const isOld = src.includes(SUPABASE_HOST_OLD)
  if (!isNew && !isOld) return src

  // Both hosts go through /api/img-proxy, which resizes to the requested width
  // and re-encodes to webp (see the route for why). The old host's own
  // /render/image endpoint is not used — it produced broken output at small
  // widths (445×445 source → 64×500 at width=128). Convert any render URL back
  // to the plain object URL first.
  const clean = src.replace('/storage/v1/render/image/', '/storage/v1/object/').split('?')[0]
  // Opaque bucket path only (?p= new storage, ?q= old project) so the storage
  // host/IP never shows up in an image link — see app/api/img-proxy/route.ts.
  const mark = '/storage/v1/object/public/'
  const at = clean.indexOf(mark)
  if (at === -1) return `/api/img-proxy?src=${encodeURIComponent(clean)}&w=${width}`
  const path = clean.slice(at + mark.length).split('/').map(decodeURIComponent).join('/')
  return `/api/img-proxy?${isNew ? 'p' : 'q'}=${encodeURIComponent(path)}&w=${width}`
}
