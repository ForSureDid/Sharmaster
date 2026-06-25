import * as dotenv from 'dotenv'
dotenv.config()

const BUCKET = 'lenyu-bantyu'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: '' }),
    })
    if (!res.ok) break
    const files = await res.json() as Array<{ name: string; id: string | null }>
    for (const f of files) { if (f.id !== null) keys.push(f.name) }
    if (files.length < 1000) break
    offset += files.length
  }
  return keys
}

async function main() {
  const keys = await listAllKeys()
  
  // Show keys that contain "atlas" or "Lenta" or start with non-digit
  const noArticle = keys.filter(k => !/^\d+_/.test(k))
  const withArticle = keys.filter(k => /^\d+_/.test(k))
  
  console.log(`Total keys: ${keys.length}`)
  console.log(`With article prefix (digit_): ${withArticle.length}`)
  console.log(`WITHOUT article prefix: ${noArticle.length}`)
  
  if (noArticle.length > 0) {
    console.log('\nSample keys WITHOUT article:')
    noArticle.slice(0, 20).forEach(k => console.log(' ', k))
    if (noArticle.length > 20) console.log(`  ...and ${noArticle.length - 20} more`)
  }
  
  console.log('\nSample keys WITH article:')
  withArticle.slice(0, 10).forEach(k => console.log(' ', k))
}

main().catch(console.error)
