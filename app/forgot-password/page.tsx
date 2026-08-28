"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { requestPasswordReset } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await requestPasswordReset(email);
    setLoading(false);
    if (err) { setError(err); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-3">Проверьте почту</h1>
          <p className="text-sm text-gray-500">
            Если аккаунт с адресом <span className="font-medium text-gray-700">{email}</span> существует,
            мы отправили на него письмо со ссылкой для сброса пароля. Ссылка действительна 1 час.
          </p>
          <a href="/login" className="inline-block mt-6 text-sky-500 hover:text-sky-600 font-medium text-sm">Вернуться ко входу</a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Забыли пароль?</h1>
        <p className="text-sm text-gray-400 mb-7">
          Укажите email, и мы пришлём ссылку для сброса пароля.
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
            {loading ? "Отправляем..." : "Отправить ссылку"}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-6 text-center">
          Вспомнили пароль?{" "}
          <a href="/login" className="text-sky-500 hover:text-sky-600 font-medium">Войти</a>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-[88px] bg-gradient-to-br from-sky-50 via-pink-50 to-green-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <ForgotPasswordForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
