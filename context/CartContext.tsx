"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ProductCard } from "@/lib/products";

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
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: ProductCard, packSize?: number | null, initialQty?: number) => void;
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  totalCount: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sharmaster_cart");
    if (stored) setItems(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("sharmaster_cart", JSON.stringify(items));
  }, [items]);

  const addToCart = useCallback((product: ProductCard, packSize: number | null = null, initialQty?: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        const step = existing.packSize ?? 1;
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + step } : i);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        salePrice: product.salePrice,
        imageUrl: product.imageUrl,
        qty: initialQty ?? packSize ?? 1,
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

  const totalCount = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + (i.salePrice ?? i.price) * i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addToCart, removeFromCart, updateQty, clearCart,
      totalCount, totalPrice,
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
