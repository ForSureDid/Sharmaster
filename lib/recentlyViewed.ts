// Local-only "recently viewed" history — last 12 products, stored in the
// browser's localStorage. Same pattern as lib/searchHistory.ts: no server
// round-trip, no DB table, purely a per-device convenience for the
// photo-only strip shown under a product page (components/RecentlyViewed.tsx).

export type RecentlyViewedItem = {
  id: number
  slug: string | null
  imageUrl: string | null
}

const STORAGE_KEY = 'sharmaster_recently_viewed'
const MAX_ENTRIES = 12

function isValidEntry(x: unknown): x is RecentlyViewedItem {
  return !!x && typeof x === 'object' && typeof (x as RecentlyViewedItem).id === 'number'
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidEntry).slice(0, MAX_ENTRIES) : []
  } catch {
    return []
  }
}

export function addRecentlyViewed(item: RecentlyViewedItem): void {
  if (typeof window === 'undefined') return
  try {
    const current = getRecentlyViewed().filter((i) => i.id !== item.id)
    const next = [item, ...current].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable (private mode, quota) — history just won't persist
  }
}
