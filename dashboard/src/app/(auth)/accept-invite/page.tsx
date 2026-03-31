"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Eye, EyeOff } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await api.post("/staff/accept-invite", { token, password: data.password });
      setDone(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setServerError(e.response?.data?.error ?? "حدث خطأ");
    }
  };

  if (!token) {
    return (
      <div className="text-center py-16 text-slate-500">رابط الدعوة غير صحيح</div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">تم قبول الدعوة!</h2>
        <p className="text-slate-500 mb-6 text-sm">يمكنك الآن تسجيل الدخول كموظف</p>
        <Button onClick={() => router.push("/login")}>تسجيل الدخول</Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">قبول الدعوة</h1>
      <p className="text-slate-500 text-sm mb-8">أنشئ كلمة مرور للوصول إلى لوحة التحكم</p>

      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="relative">
          <Input
            label="كلمة المرور"
            type={showPass ? "text" : "password"}
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute left-3 top-8 text-slate-400"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Input
          label="تأكيد كلمة المرور"
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          تعيين كلمة المرور والانضمام
        </Button>
      </form>
    </div>
  );
}
