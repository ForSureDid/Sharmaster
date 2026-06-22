"use client";

import { createContext, useContext, useState, useEffect, useTransition } from "react";
import { login as loginAction, register as registerAction, logout as logoutAction, getCurrentUser } from "@/app/auth/actions";

export type User = {
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, phone: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    // Pre-migration auth stored plaintext passwords here; purge any leftovers.
    localStorage.removeItem("sharmaster_user");
    localStorage.removeItem("sharmaster_users");
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((session) => {
        if (session) setUser({ name: session.name, email: session.email, phone: session.phone, role: session.role });
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    const err = await loginAction(email, password);
    if (!err) {
      const session = await getCurrentUser();
      if (session) setUser({ name: session.name, email: session.email, phone: session.phone, role: session.role });
    }
    return err;
  }

  async function register(name: string, email: string, phone: string, password: string): Promise<string | null> {
    const err = await registerAction(name, email, phone, password);
    if (!err) {
      const session = await getCurrentUser();
      if (session) setUser({ name: session.name, email: session.email, phone: session.phone, role: session.role });
    }
    return err;
  }

  async function logout(): Promise<void> {
    await logoutAction();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
