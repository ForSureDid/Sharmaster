"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type LikedItem = {
  id: number;
  name: string;
  price: number;
  salePrice: number | null;
  imageUrl: string | null;
  manufacturer: string | null;
};

type LikesContextType = {
  likedItems: LikedItem[];
  isLiked: (id: number) => boolean;
  toggleLike: (item: LikedItem) => void;
  removeLike: (id: number) => void;
  likedCount: number;
};

const LikesContext = createContext<LikesContextType | null>(null);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("sharmaster_likes");
    if (stored) {
      try { setLikedItems(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sharmaster_likes", JSON.stringify(likedItems));
  }, [likedItems]);

  const isLiked = useCallback((id: number) => likedItems.some((i) => i.id === id), [likedItems]);

  const toggleLike = useCallback((item: LikedItem) => {
    setLikedItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  }, []);

  const removeLike = useCallback((id: number) => {
    setLikedItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return (
    <LikesContext.Provider value={{ likedItems, isLiked, toggleLike, removeLike, likedCount: likedItems.length }}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error("useLikes must be used inside LikesProvider");
  return ctx;
}
