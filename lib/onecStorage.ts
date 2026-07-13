// Temporary storage for files uploaded during a 1C CommerceML exchange session.
// On Docker/Hetzner all requests hit the same container, so we use the local
// filesystem (/tmp) instead of Supabase Storage.

import fs from 'fs'
import path from 'path'

const TMP_DIR = path.join('/tmp', '1c-exchange')

function filePath(filename: string): string {
  // Sanitise: strip any directory traversal
  const safe = path.basename(filename)
  return path.join(TMP_DIR, safe)
}

function ensureDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })
}

export async function appendOnecFile(filename: string, bytes: Uint8Array): Promise<void> {
  ensureDir()
  const fp = filePath(filename)
  const existing = fs.existsSync(fp) ? fs.readFileSync(fp) : Buffer.alloc(0)
  fs.writeFileSync(fp, Buffer.concat([existing, Buffer.from(bytes)]))
}

export async function clearOnecFiles(): Promise<void> {
  ensureDir()
  for (const f of fs.readdirSync(TMP_DIR)) {
    fs.rmSync(path.join(TMP_DIR, f), { force: true })
  }
}

export async function downloadOnecFile(filename: string): Promise<Uint8Array> {
  ensureDir()
  const fp = filePath(filename)
  if (!fs.existsSync(fp)) throw new Error(`1C file not found: ${filename}`)
  return new Uint8Array(fs.readFileSync(fp))
}
