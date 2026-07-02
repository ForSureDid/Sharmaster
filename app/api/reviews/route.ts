import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { name, text, rating } = await req.json();

  if (!name?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "Укажите оценку от 1 до 5" }, { status: 400 });
  }

  await db.review.create({
    data: { name: name.trim(), text: text.trim(), rating: ratingNum },
  });

  return NextResponse.json({ ok: true });
}
