"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">نسيت كلمة المرور؟</h1>
          <p className="mt-2 text-sm text-slate-500">
            أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mb-3 text-3xl">📬</div>
            <p className="text-sm font-medium text-emerald-800">
              إذا كان الحساب موجوداً، ستصلك رسالة بريد إلكتروني قريباً
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
            >
              العودة لتسجيل الدخول
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "جارٍ الإرسال..." : "إرسال رابط إعادة التعيين"}
            </button>

            <p className="text-center text-xs text-slate-500">
              <Link href="/login" className="text-indigo-600 hover:underline">
                العودة لتسجيل الدخول
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
