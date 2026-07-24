import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// GET → список ID избранного текущего пользователя (гость → ids: null)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ids: null });
  const rows = await db.like.findMany({
    where: { userId: session.userId, onecStockItemId: { not: null } },
    select: { onecStockItemId: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ids: rows.map((r) => r.onecStockItemId) });
}

// POST { id, liked } → поставить/снять лайк
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.liked) {
    // Существование проверяем заранее — товар мог быть удалён (FK)
    const exists = await db.onecStockItem.findUnique({ where: { id }, select: { id: true } });
    if (exists) {
      await db.like.createMany({
        data: [{ userId: session.userId, onecStockItemId: id }],
        skipDuplicates: true,
      });
    }
  } else {
    await db.like.deleteMany({ where: { userId: session.userId, onecStockItemId: id } });
  }
  return NextResponse.json({ ok: true });
}

// PUT { ids } → слить локальные (гостевые) лайки в аккаунт, вернуть полный список
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ids: null }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids: number[] = Array.isArray(body?.ids)
    ? body.ids.filter((n: unknown) => Number.isInteger(n)).slice(0, 500)
    : [];

  if (ids.length > 0) {
    const existing = await db.onecStockItem.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length > 0) {
      await db.like.createMany({
        data: existing.map((e) => ({ userId: session.userId, onecStockItemId: e.id })),
        skipDuplicates: true,
      });
    }
  }

  const rows = await db.like.findMany({
    where: { userId: session.userId, onecStockItemId: { not: null } },
    select: { onecStockItemId: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ids: rows.map((r) => r.onecStockItemId) });
}
