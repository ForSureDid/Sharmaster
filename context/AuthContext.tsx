"use client";

import { createContext, useContext, useState, useEffect } from "react";

type User = {
  name: string;
  email: string;
  phone: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => string | null;
  register: (name: string, email: string, phone: string, password: string) => string | null;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sharmaster_user");
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  function login(email: string, password: string): string | null {
    const usersRaw = localStorage.getItem("sharmaster_users");
    const users: (User & { password: string })[] = usersRaw ? JSON.parse(usersRaw) : [];
    const found = users.find((u) => u.email === email && u.password === password);
    if (!found) return "Неверный email или пароль";
    const { password: _, ...userData } = found;
    setUser(userData);
    localStorage.setItem("sharmaster_user", JSON.stringify(userData));
    return null;
  }

  function register(name: string, email: string, phone: string, password: string): string | null {
    const usersRaw = localStorage.getItem("sharmaster_users");
    const users: (User & { password: string })[] = usersRaw ? JSON.parse(usersRaw) : [];
    if (users.find((u) => u.email === email)) return "Пользователь с таким email уже существует";
    const newUser = { name, email, phone, password };
    users.push(newUser);
    localStorage.setItem("sharmaster_users", JSON.stringify(users));
    const { password: _, ...userData } = newUser;
    setUser(userData);
    localStorage.setItem("sharmaster_user", JSON.stringify(userData));
    return null;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("sharmaster_user");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
