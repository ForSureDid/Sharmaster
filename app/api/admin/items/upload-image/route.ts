import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'admin-items'

async function ensureBucket() {
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  // Intentionally ignore errors — bucket already exists is fine
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!VALID_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP images are supported' }, { status: 400 })
  }

  const ext = file.name.match(/\.(jpe?g|png|webp|gif)$/i)?.[1]?.toLowerCase() ?? 'jpg'
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  await ensureBucket()

  const buffer = await file.arrayBuffer()
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: buffer,
  })

  if (!uploadRes.ok) {
    const msg = await uploadRes.text()
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 })
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
  return NextResponse.json({ url })
}
