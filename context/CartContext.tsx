"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ProductCard } from "@/lib/products";
import type { KitDetail } from "@/lib/kits";
import { getOneTimeDiscountPercent } from "@/lib/discounts";
import { getMinQty } from "@/lib/pack";
import { useAuth } from "@/context/AuthContext";
import { saveCart, loadCart, saveCartKits, loadCartKits } from "@/app/cart/actions";

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
  // See ProductCard.discountEligible — same as isBalloon, static and set at add time.
  discountEligible?: boolean;
  // Floor for qty — see lib/pack.ts's getMinQty(). Undefined/1 means no floor
  // beyond the normal "0 removes the item" rule.
  minQty?: number;
};

// A starter-kit bundle sitting in the cart (see lib/kits.ts's Kit/KitItem).
// Deliberately NOT part of `items` — its composition is frozen at add time and
// can't be edited or removed line-by-line, only declined as a whole (removeKit),
// which is much simpler to guarantee when it's a separate structure than if kit
// lines lived inside the freely-editable `items` array.
export type CartKitItem = {
  onecStockItemId: number;
  name: string;
  article: string | null;
  brand: string | null;
  imageUrl: string | null;
  qty: number;
  displayPrice: number;
};

export type CartKit = {
  kitId: number;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  items: CartKitItem[];
};

type CartContextType = {
  items: CartItem[];
  kits: CartKit[];
  addToCart: (product: ProductCard, packSize?: number | null, initialQty?: number) => void;
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  // Adds a kit bundle to the cart (no-op if already present) and, for any
  // composition item the shopper bumped above its locked quantity on the kit
  // page, merges that surplus into `items` as an ordinary, freely-removable
  // line — see app/kits/[slug]/page.tsx. extraQtyByItemId is keyed by
  // onecStockItemId.
  addKit: (kit: KitDetail, extraQtyByItemId?: Record<number, number>) => void;
  removeKit: (kitId: number) => void;
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
  const [kits, setKits] = useState<CartKit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncNotices, setSyncNotices] = useState<string[]>([]);
  const syncedKeyRef = useRef<string>("");
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem("sharmaster_cart");
    if (stored) setItems(JSON.parse(stored));
    const storedKits = localStorage.getItem("sharmaster_cart_kits");
    if (storedKits) setKits(JSON.parse(storedKits));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("sharmaster_cart", JSON.stringify(items));
  }, [items, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("sharmaster_cart_kits", JSON.stringify(kits));
  }, [kits, loaded]);

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

  // Same server-mirror dance as `items` above, but for kit bundles — kept on its
  // own gate/ref pair since the two loads are independent server calls.
  const [kitsServerLoadDone, setKitsServerLoadDone] = useState(false);
  const kitsLoadedForEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded || authLoading) return;
    if (!user) { setKitsServerLoadDone(true); return; }
    if (kitsLoadedForEmailRef.current === user.email) return;
    kitsLoadedForEmailRef.current = user.email;
    setKitsServerLoadDone(false);
    loadCartKits()
      .then((serverKits) => {
        if (serverKits && serverKits.length > 0) {
          setKits((prev) => (prev.length === 0 ? serverKits : prev));
        }
      })
      .catch(() => {})
      .finally(() => setKitsServerLoadDone(true));
  }, [loaded, authLoading, user]);

  useEffect(() => {
    if (!loaded || authLoading || !user || !kitsServerLoadDone) return;
    const timer = setTimeout(() => {
      saveCartKits(kits).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [kits, loaded, authLoading, user, kitsServerLoadDone]);

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
          if (maxQty <= 0 || (item.minQty && maxQty < item.minQty)) {
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
      const minQty = getMinQty({ brand: product.manufacturer, name: product.name });
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        salePrice: product.salePrice,
        imageUrl: product.imageUrl,
        qty: initialQty ?? minQty,
        packSize,
        isBalloon: product.isBalloon,
        discountEligible: product.discountEligible,
        minQty: minQty > 1 ? minQty : undefined,
      }];
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Below minQty (default 1) drops the item entirely — same "decrement past
  // the floor removes it" behavior the plain qty<=0 case already had.
  const updateQty = useCallback((id: number, qty: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      const floor = item?.minQty ?? 1;
      if (qty < floor) return prev.filter((i) => i.id !== id);
      return prev.map((i) => i.id === id ? { ...i, qty } : i);
    });
  }, []);

  const clearCart = useCallback(() => { setItems([]); setKits([]); }, []);
  const dismissSyncNotices = useCallback(() => setSyncNotices([]), []);

  const addKit = useCallback((kit: KitDetail, extraQtyByItemId: Record<number, number> = {}) => {
    setKits((prev) => {
      if (prev.some((k) => k.kitId === kit.id)) return prev; // already in the cart — decline first to re-add
      return [...prev, {
        kitId: kit.id,
        slug: kit.slug,
        name: kit.name,
        price: kit.price,
        imageUrl: kit.images[0] ?? null,
        items: kit.items.map((i) => ({
          onecStockItemId: i.onecStockItemId,
          name: i.name,
          article: i.article,
          brand: i.brand,
          imageUrl: i.imageUrl,
          qty: i.qty,
          displayPrice: i.displayPrice,
        })),
      }];
    });

    // Anything the shopper bumped above the kit's locked quantity is an ordinary,
    // freely-removable cart line from the start — never part of the frozen bundle.
    const extras = kit.items.filter((i) => (extraQtyByItemId[i.onecStockItemId] ?? 0) > 0);
    if (extras.length === 0) return;
    setItems((prev) => {
      let next = prev;
      for (const i of extras) {
        const extraQty = extraQtyByItemId[i.onecStockItemId];
        const existingIdx = next.findIndex((x) => x.id === i.onecStockItemId);
        if (existingIdx >= 0) {
          next = next.map((x, idx) => idx === existingIdx ? { ...x, qty: x.qty + extraQty } : x);
        } else {
          const minQty = getMinQty({ brand: i.brand, name: i.name });
          next = [...next, {
            id: i.onecStockItemId,
            name: i.name,
            price: i.displayPrice,
            salePrice: i.salePrice,
            imageUrl: i.imageUrl,
            qty: extraQty,
            packSize: i.packSize,
            isBalloon: i.isBalloon,
            discountEligible: i.discountEligible,
            minQty: minQty > 1 ? minQty : undefined,
          }];
        }
      }
      return next;
    });
  }, []);

  const removeKit = useCallback((kitId: number) => {
    setKits((prev) => prev.filter((k) => k.kitId !== kitId));
  }, []);

  const kitsTotal = kits.reduce((s, k) => s + k.price, 0);
  const totalCount = items.reduce((s, i) => s + i.qty, 0) + kits.length;
  const totalPrice = items.reduce((s, i) => s + (i.salePrice ?? i.price) * i.qty, 0) + kitsTotal;
  // "Прогрессивная скидка (разовая)" — see /discounts. Tier is picked off (and the
  // discount only ever applied to) the discount-eligible subtotal — gas equipment,
  // helium, balloon-treatment gel, ORACAL film and electric pumps (discountEligible
  // === false) never get discounted and don't help reach a tier either. A kit
  // bundle's flat price is excluded the same way — see Kit.price in
  // prisma/schema.prisma — it's always exactly its listed price, never discounted.
  // Server re-verifies the same calc from stock prices/categories at checkout.
  const discountEligiblePrice = items.reduce(
    (s, i) => s + (i.discountEligible === false ? 0 : (i.salePrice ?? i.price) * i.qty),
    0
  );
  const discountPercent = getOneTimeDiscountPercent(discountEligiblePrice);
  const discountAmount = Math.round(discountEligiblePrice * discountPercent / 100);
  const finalTotal = totalPrice - discountAmount;

  return (
    <CartContext.Provider value={{
      items, kits,
      addToCart, removeFromCart, updateQty, clearCart, addKit, removeKit,
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
