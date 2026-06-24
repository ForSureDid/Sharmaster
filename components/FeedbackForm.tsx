"use client";

import { useState } from "react";

export default function FeedbackForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="feedback" className="py-14 bg-sky-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Оставьте отзыв</h2>
          <p className="text-gray-500 text-sm">
            Ваше мнение помогает нам стать лучше
          </p>
        </div>

        {status === "done" ? (
          <div className="bg-white rounded-2xl border border-green-100 p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-800 font-semibold text-lg">Спасибо за отзыв!</p>
            <p className="text-gray-500 text-sm mt-1">Мы обязательно его прочитаем.</p>
            <button
              onClick={() => { setStatus("idle"); setForm({ name: "", email: "", message: "" }); }}
              className="mt-5 text-sky-500 text-sm hover:text-sky-600 underline underline-offset-2"
            >
              Отправить ещё один
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ваше имя"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="example@mail.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Отзыв</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Напишите ваш отзыв или пожелание..."
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent resize-none"
              />
            </div>

            {status === "error" && (
              <p className="text-red-500 text-sm">Не удалось отправить. Попробуйте ещё раз.</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full py-3 bg-sky-400 hover:bg-sky-500 disabled:bg-sky-200 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {status === "sending" ? "Отправляем..." : "Отправить отзыв"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
