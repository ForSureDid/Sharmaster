// Local-only search history — last 4 queries, stored in the browser's localStorage.
// No server round-trip, no DB table: purely a per-device convenience.

const STORAGE_KEY = 'sharmaster_search_history'
const MAX_ENTRIES = 4

export function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_ENTRIES) : []
  } catch {
    return []
  }
}

export function addSearchHistory(query: string): string[] {
  const trimmed = query.trim()
  if (typeof window === 'undefined' || !trimmed) return getSearchHistory()
  const current = getSearchHistory()
  const deduped = current.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())
  const next = [trimmed, ...deduped].slice(0, MAX_ENTRIES)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable (private mode, quota) — history just won't persist
  }
  return next
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
