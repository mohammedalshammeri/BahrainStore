"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError("رابط إعادة التعيين غير صحيح");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "الرابط غير صحيح أو منتهي الصلاحية");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">كلمة مرور جديدة</h1>
          <p className="mt-2 text-sm text-slate-500">اختر كلمة مرور قوية لحسابك</p>
        </div>

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mb-3 text-3xl">✅</div>
            <p className="text-sm font-medium text-emerald-800">
              تم تغيير كلمة المرور بنجاح! سيتم تحويلك لتسجيل الدخول...
            </p>
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
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="8 أحرف على الأقل"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="أعد كتابة كلمة المرور"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
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
