"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Пароли не совпадают"); return; }
    if (form.password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const err = register(form.name, form.email, form.phone, form.password);
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
        <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Создать аккаунт</h1>
        <p className="text-sm text-gray-400 mb-7">
          Уже есть аккаунт?{" "}
          <a href="/login" className="text-sky-500 hover:text-sky-600 font-medium">Войти</a>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Имя</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Иван Иванов"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="example@mail.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+7 777 000 0000"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Повторите пароль</label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
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
            {loading ? "Создаём..." : "Зарегистрироваться"}
          </button>
        </form>
      </div>

      <a href="/" className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        ← На главную
      </a>
    </div>
  );
}
