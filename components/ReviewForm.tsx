"use client";

import { useState } from "react";

export default function ReviewForm() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !text.trim() || rating < 1) {
      setErrorMsg("Заполните имя, отзыв и выберите оценку");
      setStatus("error");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text, rating }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Не удалось отправить. Попробуйте ещё раз.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Не удалось отправить. Попробуйте ещё раз.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="bg-white rounded-2xl border border-green-100 p-8 text-center shadow-sm h-full flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-800 font-semibold text-lg">Спасибо за отзыв!</p>
        <p className="text-gray-500 text-sm mt-1">Мы обязательно его прочитаем.</p>
        <button
          onClick={() => { setStatus("idle"); setName(""); setText(""); setRating(0); }}
          className="mt-5 text-sky-500 text-sm hover:text-sky-600 underline underline-offset-2"
        >
          Отправить ещё один
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Оценка</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
              aria-label={`Оценка ${star} из 5`}
            >
              <svg
                className={`w-7 h-7 transition-colors ${
                  star <= (hoverRating || rating) ? "fill-yellow-400 stroke-yellow-400" : "fill-none stroke-gray-300"
                }`}
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.9-6.1-3.6-6.1 3.6 1.5-6.9-5.2-4.7 6.9-.7L12 2.5z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Отзыв</label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите ваш отзыв или пожелание..."
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent resize-none"
        />
      </div>

      {status === "error" && <p className="text-red-500 text-sm">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-3 bg-sky-400 hover:bg-sky-500 disabled:bg-sky-200 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {status === "sending" ? "Отправляем..." : "Отправить отзыв"}
      </button>
    </form>
  );
}
