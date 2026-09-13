import { NextRequest, NextResponse } from "next/server";
import { logSearchClick } from "@/lib/searchAnalytics";

// Fire-and-forget beacon: a click on a product while a search query was
// active (autocomplete suggestion or a card in /catalog?q=... results).
// Always returns 200 on anything short of a malformed body — this must never
// surface as an error to the click handler that fired it.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { query, itemId, source } = (body ?? {}) as { query?: unknown; itemId?: unknown; source?: unknown };
  if (typeof query !== "string" || typeof itemId !== "number") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await logSearchClick(query.slice(0, 200), itemId, source === "suggest" ? "suggest" : "catalog");
  return NextResponse.json({ ok: true });
}
