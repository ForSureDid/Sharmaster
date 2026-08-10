'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import type { CartItem } from '@/context/CartContext'

// Server-side mirror of the localStorage cart — logged-in users only (see
// User.cart in schema.prisma). Guests keep localStorage-only carts.

export async function saveCart(items: CartItem[]): Promise<void> {
  const session = await getSession()
  if (!session) return
  await db.user.update({
    where: { id: session.userId },
    data: { cart: items, cartUpdatedAt: new Date() },
  })
}

export async function loadCart(): Promise<CartItem[] | null> {
  const session = await getSession()
  if (!session) return null
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { cart: true } })
  const cart = user?.cart
  return Array.isArray(cart) ? (cart as unknown as CartItem[]) : null
}
