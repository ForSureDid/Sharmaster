// Temporary storage for files uploaded during a 1C CommerceML exchange session.
// Needed because the "file" and "import" steps are separate HTTP requests that may
// land on different serverless instances — there's no shared local disk/memory to
// hold the uploaded bytes in between, so we round-trip them through Supabase Storage.

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = '1c-exchange'

async function ensureBucket() {
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  })
  // Intentionally ignore errors — bucket already exists is fine
}

export async function uploadOnecFile(filename: string, bytes: Uint8Array): Promise<void> {
  await ensureBucket()

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/xml',
      'x-upsert': 'true',
    },
    body: Buffer.from(bytes),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`1C file upload failed: ${msg}`)
  }
}

export async function downloadOnecFile(filename: string): Promise<Uint8Array> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
  })

  if (!res.ok) {
    throw new Error(`1C file not found in storage: ${filename}`)
  }

  return new Uint8Array(await res.arrayBuffer())
}
