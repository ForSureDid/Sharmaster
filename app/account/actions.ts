'use server'

import { db } from '@/lib/db'

export async function getOrdersByPhone(phone: string) {
  if (!phone?.trim()) return []
  return db.order.findMany({
    where: { phone },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
}
