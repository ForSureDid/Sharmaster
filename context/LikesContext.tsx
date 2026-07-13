"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

// Только ID товаров. Гость: localStorage. Залогиненный: таблица Like в БД,
// при входе локальные лайки сливаются в аккаунт (PUT /api/likes).
// Свежие данные товаров страница избранного тянет по этим ID из /api/stock/cards.

const STORAGE_KEY = "sharmaster_liked_ids";
const LEGACY_KEY = "sharmaster_likes"; // старый формат: массив объектов со снапшотом цены

type LikesContextType = {
  likedIds: number[];
  ready: boolean;
  isLiked: (id: number) => boolean;
  toggleLike: (id: number) => void;
  removeLike: (id: number) => void;
  likedCount: number;
};

const LikesContext = createContext<LikesContextType | null>(null);

function readLocal(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids = JSON.parse(stored);
      return Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)) : [];
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const ids = (JSON.parse(legacy) as Array<{ id: number }>)
        .map((i) => i?.id)
        .filter((n) => Number.isInteger(n));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      localStorage.removeItem(LEGACY_KEY);
      return ids;
    }
  } catch {}
  return [];
}

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [likedIds, setLikedIds] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    setLikedIds(readLocal());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(likedIds));
  }, [likedIds, ready]);

  // При входе: слить локальные лайки в аккаунт и принять серверный список
  useEffect(() => {
    if (!user || !ready) {
      if (!user) mergedFor.current = null;
      return;
    }
    if (mergedFor.current === user.email) return;
    mergedFor.current = user.email;
    fetch("/api/likes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: readLocal() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.ids)) setLikedIds(data.ids);
      })
      .catch(() => {});
  }, [user, ready]);

  const isLiked = useCallback((id: number) => likedIds.includes(id), [likedIds]);

  const toggleLike = useCallback((id: number) => {
    const liked = !likedIds.includes(id);
    setLikedIds((prev) => (liked ? [id, ...prev.filter((i) => i !== id)] : prev.filter((i) => i !== id)));
    if (user) {
      fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, liked }),
      }).catch(() => {});
    }
  }, [likedIds, user]);

  const removeLike = useCallback((id: number) => {
    setLikedIds((prev) => prev.filter((i) => i !== id));
    if (user) {
      fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, liked: false }),
      }).catch(() => {});
    }
  }, [user]);

  return (
    <LikesContext.Provider value={{ likedIds, ready, isLiked, toggleLike, removeLike, likedCount: likedIds.length }}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error("useLikes must be used inside LikesProvider");
  return ctx;
}
