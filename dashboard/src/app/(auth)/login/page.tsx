"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, setAuth } from "@/lib/api";
import { getPublicApiOrigin } from "@/lib/env";
import { useAuthStore } from "@/store/auth.store";

const schema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});

type FormData = z.infer<typeof schema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("error");
  const { setMerchant, setStore } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(
    googleError === "google_auth_failed" || googleError === "google_token_failed" || googleError === "google_user_failed"
      ? "فشل تسجيل الدخول بجوجل، حاول مجدداً"
      : googleError === "account_disabled"
      ? "الحساب موقوف، تواصل مع الدعم"
      : ""
  );
  const [twoFAState, setTwoFAState] = useState<{ tempToken: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);

  const BACKEND = getPublicApiOrigin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      const res = await api.post("/auth/login", data);
      if (res.data.requires2FA) {
        setTwoFAState({ tempToken: res.data.tempToken });
        return;
      }
      await finishLogin(res.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setServerError(error?.response?.data?.error ?? "حدث خطأ، حاول مرة أخرى");
    }
  };

  const onVerify2FA = async () => {
    if (!twoFAState || !twoFACode.trim()) return;
    setTwoFALoading(true);
    setServerError("");
    try {
      const res = await api.post("/auth/2fa/verify", {
        tempToken: twoFAState.tempToken,
        code: twoFACode.trim(),
      });
      await finishLogin(res.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setServerError(error?.response?.data?.error ?? "رمز التحقق غير صحيح");
    } finally {
      setTwoFALoading(false);
    }
  };

  const finishLogin = async (data: { accessToken: string; refreshToken: string; merchant: object }) => {
    setAuth(data.accessToken, data.refreshToken);
    setMerchant(data.merchant as Parameters<typeof setMerchant>[0]);
    try {
      const storeRes = await api.get("/stores");
      const stores = storeRes.data?.stores ?? storeRes.data;
      if (Array.isArray(stores) && stores[0]) setStore(stores[0]);
    } catch {
      // No store yet
    }
    router.push("/");
  };

  // 2FA challenge step
  if (twoFAState) {
    return (
      <>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">التحقق بخطوتين</h2>
          <p className="mt-1 text-sm text-slate-500">أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة</p>
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">رمز التحقق</label>
            <input
              autoFocus
              maxLength={6}
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && onVerify2FA()}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-widest font-mono rounded-lg border border-slate-300 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button className="w-full" size="lg" loading={twoFALoading} onClick={onVerify2FA} disabled={twoFACode.length !== 6}>
            تحقق
          </Button>
          <button
            type="button"
            onClick={() => { setTwoFAState(null); setServerError(""); setTwoFACode(""); }}
            className="w-full text-sm text-slate-500 hover:text-slate-700"
          >
            رجوع لتسجيل الدخول
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-6 text-xl font-bold text-slate-900">تسجيل الدخول</h2>

      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="البريد الإلكتروني"
          type="email"
          placeholder="you@example.com"
          required
          error={errors.email?.message}
          startIcon={<Mail className="h-4 w-4" />}
          {...register("email")}
        />

        <Input
          label="كلمة المرور"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          required
          error={errors.password?.message}
          startIcon={<Lock className="h-4 w-4" />}
          endIcon={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("password")}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300" />
            تذكّرني
          </label>
          <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          دخول
        </Button>
      </form>

      {/* Google OAuth divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">أو</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <a
        href={`${BACKEND}/api/v1/auth/google`}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        تسجيل الدخول بـ Google
      </a>

      <p className="mt-6 text-center text-sm text-slate-600">
        ليس لديك حساب؟{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          إنشاء متجر جديد
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

