"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^8/, "7").replace(/^7/, "");
  let out = "+7-(";
  if (digits.length === 0) return out;
  out += digits.slice(0, 3);
  if (digits.length < 3) return out;
  out += ")-";
  out += digits.slice(3, 6);
  if (digits.length < 6) return out;
  out += "-";
  out += digits.slice(6, 8);
  if (digits.length < 8) return out;
  out += "-";
  out += digits.slice(8, 10);
  return out;
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "+7-(",
    password: "",
    confirm: "",
  });
  const [policy, setPolicy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    set("phone", formatPhone(e.target.value));
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && form.phone.length <= 4) e.preventDefault();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!policy) { setError("Примите условия политики конфиденциальности"); return; }
    if (form.password !== form.confirm) { setError("Пароли не совпадают"); return; }
    if (form.password.length < 8) { setError("Пароль должен быть не менее 8 символов"); return; }
    if (form.phone.replace(/\D/g, "").length < 11) { setError("Введите полный номер телефона"); return; }
    setLoading(true);
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const err = await register(fullName, form.email, form.phone, form.password);
    setLoading(false);
    if (err) { setError(err); return; }
    router.push("/account");
  }

  return (
    <>
      <Header />
      <main className="flex-1 pt-[88px] bg-gradient-to-br from-sky-50 via-pink-50 to-green-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Создать аккаунт</h1>
            <p className="text-sm text-gray-400 mb-7">
              Уже есть аккаунт?{" "}
              <a href="/login" className="text-sky-500 hover:text-sky-600 font-medium">Войти</a>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Имя</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    placeholder="Имя"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Фамилия</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    placeholder="Фамилия"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors"
                  />
                </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Номер телефона</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={handlePhoneChange}
                  onKeyDown={handlePhoneKeyDown}
                  onFocus={(e) => { if (!form.phone) set("phone", "+7-("); e.target.setSelectionRange(e.target.value.length, e.target.value.length); }}
                  placeholder="+7-(000)-000-0000"
                  maxLength={18}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-300 focus:outline-none text-sm transition-colors tracking-wide"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Минимум 8 символов"
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

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)} className="sr-only" />
                  <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${policy ? "bg-sky-400 border-sky-400" : "border-gray-300 group-hover:border-sky-300"}`}>
                    {policy && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-500 leading-relaxed">
                  Я принимаю условия{" "}
                  <a href="/policy" target="_blank" className="text-sky-500 hover:text-sky-600 font-medium underline underline-offset-2">
                    политики конфиденциальности
                  </a>
                </span>
              </label>

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
        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
