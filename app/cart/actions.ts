'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import type { CartItem, CartKit } from '@/context/CartContext'

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

// Same mirror, for kit bundles — kept in a separate column (User.cartKits) so
// every existing reader of `cart` (admin Carts tab, etc.) is unaffected.
export async function saveCartKits(kits: CartKit[]): Promise<void> {
  const session = await getSession()
  if (!session) return
  await db.user.update({
    where: { id: session.userId },
    data: { cartKits: kits, cartKitsUpdatedAt: new Date() },
  })
}

export async function loadCartKits(): Promise<CartKit[] | null> {
  const session = await getSession()
  if (!session) return null
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { cartKits: true } })
  const cartKits = user?.cartKits
  return Array.isArray(cartKits) ? (cartKits as unknown as CartKit[]) : null
}
