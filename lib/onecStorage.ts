// Temporary storage for files uploaded during a 1C CommerceML exchange session.
// Needed because the "file" and "import" steps are separate HTTP requests that may
// land on different serverless instances — there's no shared local disk/memory to
// hold the uploaded bytes in between, so we round-trip them through Supabase Storage.
//
// Vercel enforces a hard ~4.5MB request body limit at the platform level (rejected
// before the request even reaches our function — a 413 from the edge, not from us).
// A real 1C catalog export is bigger than that, so 1C splits it into several POSTs
// that all target the *same* filename — each chunk must be appended, not overwritten.

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

async function readIfExists(filename: string): Promise<Uint8Array | null> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

async function writeFile(filename: string, bytes: Uint8Array): Promise<void> {
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

// Appends this chunk to whatever's already stored under `filename` — 1C re-POSTs the
// same filename multiple times when a file is split, and each call carries the next
// chunk, not a replacement.
export async function appendOnecFile(filename: string, bytes: Uint8Array): Promise<void> {
  await ensureBucket()
  const existing = await readIfExists(filename)
  const combined = existing ? Buffer.concat([Buffer.from(existing), Buffer.from(bytes)]) : Buffer.from(bytes)
  await writeFile(filename, combined)
}

// Wipes any leftover partial uploads from a previous (possibly aborted) exchange
// session — called on "init" so a fresh session always starts from empty files.
export async function clearOnecFiles(): Promise<void> {
  await ensureBucket()
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit: 100, prefix: '' }),
  })
  if (!listRes.ok) return
  const files: { name: string }[] = await listRes.json()
  if (files.length === 0) return

  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: files.map((f) => f.name) }),
  })
}

export async function downloadOnecFile(filename: string): Promise<Uint8Array> {
  const bytes = await readIfExists(filename)
  if (!bytes) throw new Error(`1C file not found in storage: ${filename}`)
  return bytes
}
