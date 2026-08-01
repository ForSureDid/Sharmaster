"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ProductCard } from "@/lib/products";
import { getOneTimeDiscountPercent } from "@/lib/discounts";

export type CartItem = {
  id: number;
  name: string;
  price: number;
  salePrice: number | null;
  imageUrl: string | null;
  qty: number;
  packSize: number | null;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (product: ProductCard, packSize?: number | null, initialQty?: number) => void;
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  totalCount: number;
  totalPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalTotal: number;
  syncNotices: string[];
  dismissSyncNotices: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

type FreshCard = { id: number; stock: number; pricePerPc: number; salePercent: number | null; imageUrl: string | null };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncNotices, setSyncNotices] = useState<string[]>([]);
  const syncedKeyRef = useRef<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("sharmaster_cart");
    if (stored) setItems(JSON.parse(stored));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("sharmaster_cart", JSON.stringify(items));
  }, [items, loaded]);

  // Ghost-item guard: a localStorage snapshot goes stale the moment a product is
  // deleted/hidden or sells out — without this, the stale row sits in the cart
  // forever and can silently block checkout via placeOrder's server-side stock
  // check (it names the item in the error, but nothing here ever surfaces or
  // clears it). Reconcile against live stock once per distinct id set so a
  // removed/out-of-stock item drops out (or its qty gets clamped) automatically,
  // with a visible notice instead of a dead-end "не хватает товара" error.
  useEffect(() => {
    if (!loaded || items.length === 0) return;
    const ids = [...new Set(items.map((i) => i.id))].sort((a, b) => a - b);
    const key = ids.join(",");
    if (key === syncedKeyRef.current) return;
    syncedKeyRef.current = key;

    fetch(`/api/stock/cards?ids=${ids.join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items: FreshCard[] } | null) => {
        if (!data || !Array.isArray(data.items)) return;
        const freshById = new Map(data.items.map((c) => [c.id, c]));
        const notices: string[] = [];
        let changed = false;

        const next = items.reduce<CartItem[]>((acc, item) => {
          const fresh = freshById.get(item.id);
          if (!fresh) {
            notices.push(`«${item.name}» больше недоступен и был убран из корзины`);
            changed = true;
            return acc;
          }
          const maxQty = item.packSize ? Math.floor(fresh.stock / item.packSize) : fresh.stock;
          if (maxQty <= 0) {
            notices.push(`«${item.name}» закончился на складе и был убран из корзины`);
            changed = true;
            return acc;
          }
          const qty = Math.min(item.qty, maxQty);
          const salePrice = fresh.salePercent ? Math.round(fresh.pricePerPc * (1 - fresh.salePercent / 100)) : null;
          if (qty < item.qty) {
            notices.push(`Количество «${item.name}» уменьшено до ${qty}${item.packSize ? " уп" : ""} — столько осталось на складе`);
          }
          if (qty !== item.qty || fresh.pricePerPc !== item.price || salePrice !== item.salePrice || fresh.imageUrl !== item.imageUrl) {
            changed = true;
          }
          acc.push({ ...item, qty, price: fresh.pricePerPc, salePrice, imageUrl: fresh.imageUrl });
          return acc;
        }, []);

        if (changed) setItems(next);
        if (notices.length > 0) setSyncNotices(notices);
      })
      .catch(() => {});
  }, [items, loaded]);

  const addToCart = useCallback((product: ProductCard, packSize: number | null = null, initialQty?: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        salePrice: product.salePrice,
        imageUrl: product.imageUrl,
        qty: initialQty ?? 1,
        packSize,
      }];
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQty = useCallback((id: number, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const dismissSyncNotices = useCallback(() => setSyncNotices([]), []);

  const totalCount = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + (i.salePrice ?? i.price) * i.qty, 0);
  // "Прогрессивная скидка (разовая)" — see /discounts. Tier is picked off the
  // cart subtotal, server re-verifies the same calc from stock prices at checkout.
  const discountPercent = getOneTimeDiscountPercent(totalPrice);
  const discountAmount = Math.round(totalPrice * discountPercent / 100);
  const finalTotal = totalPrice - discountAmount;

  return (
    <CartContext.Provider value={{
      items,
      addToCart, removeFromCart, updateQty, clearCart,
      totalCount, totalPrice, discountPercent, discountAmount, finalTotal,
      syncNotices, dismissSyncNotices,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
