// OpenAI embeddings for the vector-search fallback (see getVectorItemIds in lib/onecStock.ts)
// and the backfill script (scripts/backfill-embeddings.ts). Server-only.

import OpenAI from 'openai'

export const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dims, $0.02 / 1M tokens

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

// Search queries repeat a lot (same term retyped, near-identical phrasing while a user
// pauses mid-keystroke) — a short in-memory cache avoids paying for an embedding call
// on every debounce tick without needing a DB-backed cache.
const queryCache = new Map<string, { vector: number[]; expires: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

export async function embedQuery(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase()
  const hit = queryCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.vector

  const res = await getClient().embeddings.create({ model: EMBEDDING_MODEL, input: key })
  const vector = res.data[0].embedding
  queryCache.set(key, { vector, expires: Date.now() + CACHE_TTL_MS })
  return vector
}

// Batch embedding for the backfill script — no caching, callers own chunking.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await getClient().embeddings.create({ model: EMBEDDING_MODEL, input: texts })
  return res.data.map((d) => d.embedding)
}
