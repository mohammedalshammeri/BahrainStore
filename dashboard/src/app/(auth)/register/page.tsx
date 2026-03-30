"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, Lock, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, setAuth } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const schema = z.object({
  name: z.string().min(2, "الاسم 2 أحرف على الأقل"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, "رقم هاتف غير صالح").optional().or(z.literal("")),
  password: z
    .string()
    .min(8, "كلمة المرور 8 أحرف على الأقل")
    .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setMerchant } = useAuthStore();
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
      const payload = { ...data, phone: data.phone || undefined };
      const res = await api.post("/auth/register", payload);
      setAuth(res.data.accessToken, res.data.refreshToken);
      setMerchant(res.data.merchant);
      router.push("/");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? "حدث خطأ، حاول مرة أخرى");
    }
  };

  return (
    <>
      <h2 className="mb-2 text-xl font-bold text-slate-900">إنشاء متجر جديد</h2>
      <p className="mb-6 text-sm text-slate-500">ابدأ رحلتك مع بزار مجاناً</p>

      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="الاسم الكامل"
          placeholder="محمد أحمد"
          required
          error={errors.name?.message}
          startIcon={<User className="h-4 w-4" />}
          {...register("name")}
        />

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
          label="رقم الهاتف (اختياري)"
          type="tel"
          placeholder="+97333XXXXXX"
          error={errors.phone?.message}
          startIcon={<Phone className="h-4 w-4" />}
          {...register("phone")}
        />

        <Input
          label="كلمة المرور"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          required
          error={errors.password?.message}
          hint="8 أحرف على الأقل، حرف كبير ورقم"
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

        <p className="text-xs text-slate-500">
          بإنشاء حساب، أنت توافق على{" "}
          <Link href="/terms" className="text-indigo-600 hover:underline">
            شروط الاستخدام
          </Link>{" "}
          و{" "}
          <Link href="/privacy" className="text-indigo-600 hover:underline">
            سياسة الخصوصية
          </Link>
        </p>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          إنشاء الحساب
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        لديك حساب؟{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </>
  );
}
