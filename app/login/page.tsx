"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) { setError(err); return; }
    router.push("/account");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-pink-50 to-green-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <a href="/" className="mb-8">
        <Image src="/logo-nobg.png" alt="Sharmaster" width={200} height={60} className="h-14 w-auto" />
      </a>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Войти в аккаунт</h1>
        <p className="text-sm text-gray-400 mb-7">
          Нет аккаунта?{" "}
          <a href="/register" className="text-sky-500 hover:text-sky-600 font-medium">Зарегистрироваться</a>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sky-400 hover:bg-sky-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors mt-2"
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>

      <a href="/" className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        ← На главную
      </a>
    </div>
  );
}
