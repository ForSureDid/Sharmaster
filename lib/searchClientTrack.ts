// Client-side beacon for /api/search/track-click — call from a click handler
// on a product that was reached via a search query. Fire-and-forget: never
// awaited, never blocks navigation, swallows its own failures.
export function trackSearchClick(query: string | null | undefined, itemId: number, source: "suggest" | "catalog"): void {
  const trimmed = query?.trim();
  if (!trimmed) return;
  fetch("/api/search/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: trimmed, itemId, source }),
    keepalive: true,
  }).catch(() => {});
}
