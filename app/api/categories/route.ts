import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 3600;

export async function GET() {
  const categories = await db.onecCategory.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true,
      children: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });
  return NextResponse.json(categories);
}
