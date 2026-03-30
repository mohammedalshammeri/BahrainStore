"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, setAuth } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Metadata } from "next";

const schema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setMerchant, setStore } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      const res = await api.post("/auth/login", data);
      setAuth(res.data.accessToken, res.data.refreshToken);
      setMerchant(res.data.merchant);

      // Fetch merchant's store
      try {
        const storeRes = await api.get("/stores");
        if (storeRes.data?.[0]) setStore(storeRes.data[0]);
      } catch {
        // No store yet, will redirect to onboarding
      }

      router.push("/");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? "حدث خطأ، حاول مرة أخرى");
    }
  };

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

      <p className="mt-6 text-center text-sm text-slate-600">
        ليس لديك حساب؟{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          إنشاء متجر جديد
        </Link>
      </p>
    </>
  );
}
