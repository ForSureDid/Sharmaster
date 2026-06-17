'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function getMyOrders() {
  const session = await getSession()
  if (!session) return []

  // New orders are linked by userId. Old orders (pre-migration, no userId) are
  // matched by phone so existing users don't lose their history. Phone-matched
  // rows are restricted to those with no userId to prevent cross-user leakage.
  return db.order.findMany({
    where: {
      OR: [
        { userId: session.userId },
        ...(session.phone
          ? [{ userId: null, phone: session.phone }]
          : []),
      ],
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
}
