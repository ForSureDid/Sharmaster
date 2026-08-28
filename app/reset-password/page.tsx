"use client";

import { Suspense, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    setLoading(true);
    const err = await resetPassword(token, password);
    setLoading(false);
    if (err) { setError(err); return; }
    router.push("/account");
  }

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-3">Ссылка недействительна</h1>
          <p className="text-sm text-gray-500">
            В ссылке отсутствует токен сброса пароля. Запросите новую ссылку.
          </p>
          <a href="/forgot-password" className="inline-block mt-6 text-sky-500 hover:text-sky-600 font-medium text-sm">Запросить ссылку заново</a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Новый пароль</h1>
        <p className="text-sm text-gray-400 mb-7">Придумайте новый пароль для входа в аккаунт.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Новый пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Повторите пароль</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? "Сохраняем..." : "Сохранить пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-[88px] bg-gradient-to-br from-sky-50 via-pink-50 to-green-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <Suspense fallback={<div className="w-8 h-8 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
