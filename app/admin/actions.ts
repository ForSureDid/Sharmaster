'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getSession()
  if (!session || session.role !== 'admin') throw new Error('Unauthorized')
  return session
}

export async function getAdminStats() {
  await requireAdmin()
  const [totalOrders, pendingOrders, totalUsers, revenueResult] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: 'Принят' } }),
    db.user.count(),
    db.order.aggregate({ _sum: { total: true } }),
  ])
  return {
    totalOrders,
    pendingOrders,
    totalUsers,
    totalRevenue: Number(revenueResult._sum.total ?? 0),
  }
}

export async function getAllOrders() {
  await requireAdmin()
  return db.order.findMany({
    include: {
      items: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateOrderStatus(orderId: number, status: string) {
  await requireAdmin()
  const VALID_STATUSES = ['Принят', 'Обрабатывается', 'В пути', 'Доставлен', 'Отменён']
  if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status')
  await db.order.update({ where: { id: orderId }, data: { status } })
  revalidatePath('/admin')
}
