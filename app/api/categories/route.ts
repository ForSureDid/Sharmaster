import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 3600;

export async function GET() {
  const categories = await db.category.findMany({
    where: { level: 1 },
    orderBy: { id: "asc" },
    include: {
      children: {
        where: { level: 2 },
        orderBy: { id: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });
  return NextResponse.json(categories);
}
