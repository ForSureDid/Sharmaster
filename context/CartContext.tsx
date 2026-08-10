"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ProductCard } from "@/lib/products";
import { getOneTimeDiscountPercent } from "@/lib/discounts";
import { useAuth } from "@/context/AuthContext";
import { saveCart, loadCart } from "@/app/cart/actions";

export type CartItem = {
  id: number;
  name: string;
  price: number;
  salePrice: number | null;
  imageUrl: string | null;
  qty: number;
  packSize: number | null;
  // See ProductCard.isBalloon — carried over as-is from add time since it's a
  // static category property, not something that needs re-fetching on sync.
  isBalloon?: boolean;
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
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem("sharmaster_cart");
    if (stored) setItems(JSON.parse(stored));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("sharmaster_cart", JSON.stringify(items));
  }, [items, loaded]);

  // Server-side cart mirror (logged-in users only, see app/cart/actions.ts) —
  // survives a cleared browser or a new device, and gives admin visibility
  // into what's in a customer's cart. On login, the server cart only wins if
  // the local one is empty (simple last-write-wins, not a true merge).
  // `serverLoadDone` gates the save effect below so it can't fire — and
  // overwrite the just-fetched server cart with a stale empty array — before
  // the load for this login has actually resolved.
  const [serverLoadDone, setServerLoadDone] = useState(false);
  const loadedForEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded || authLoading) return;
    if (!user) { setServerLoadDone(true); return; }
    if (loadedForEmailRef.current === user.email) return;
    loadedForEmailRef.current = user.email;
    setServerLoadDone(false);
    loadCart()
      .then((serverItems) => {
        if (serverItems && serverItems.length > 0) {
          setItems((prev) => (prev.length === 0 ? serverItems : prev));
        }
      })
      .catch(() => {})
      .finally(() => setServerLoadDone(true));
  }, [loaded, authLoading, user]);

  useEffect(() => {
    if (!loaded || authLoading || !user || !serverLoadDone) return;
    const timer = setTimeout(() => {
      saveCart(items).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [items, loaded, authLoading, user, serverLoadDone]);

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
          // Mirrors app/order/page.tsx's checkout mapping and lib/pack.ts's
          // getDisplayPrice(): only for actual balloons is `stock` tracked in raw
          // pieces (divide by packSize to get sellable packs). For every other
          // packQty category (перья, шпажки, свечи, топперы, etc.) 1C's stock
          // number already IS the pack/set count — dividing again undercounts it
          // to zero for any realistic on-hand quantity.
          const maxQty = item.packSize && item.isBalloon !== false
            ? Math.floor(fresh.stock / item.packSize)
            : fresh.stock;
          if (maxQty <= 0) {
            notices.push(`«${item.name}» закончился на складе и был убран из корзины`);
            changed = true;
            return acc;
          }
          const qty = Math.min(item.qty, maxQty);
          // Mirrors lib/pack.ts's getDisplayPrice(): a pack line's price is the
          // per-piece price times the pack size, unless isBalloon is explicitly
          // false (packQty there is descriptive only — 1C's price already IS the
          // whole pack/set). Re-deriving pricePerPc alone here (as this used to)
          // silently dropped the pack multiplier on every background refresh.
          const unitPrice = item.packSize && item.isBalloon !== false
            ? fresh.pricePerPc * item.packSize
            : fresh.pricePerPc;
          const salePrice = fresh.salePercent ? Math.round(unitPrice * (1 - fresh.salePercent / 100)) : null;
          if (qty < item.qty) {
            notices.push(`Количество «${item.name}» уменьшено до ${qty}${item.packSize ? " уп" : ""} — столько осталось на складе`);
          }
          if (qty !== item.qty || unitPrice !== item.price || salePrice !== item.salePrice || fresh.imageUrl !== item.imageUrl) {
            changed = true;
          }
          acc.push({ ...item, qty, price: unitPrice, salePrice, imageUrl: fresh.imageUrl });
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
        isBalloon: product.isBalloon,
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
