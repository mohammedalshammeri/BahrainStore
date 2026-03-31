"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Rocket, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import Link from "next/link";

const STEP_LINKS = ["/settings", "/products/new", "/settings", "/settings", "/settings"];

export default function OnboardingPage() {
  const { store } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding", store?.id],
    queryFn: async () => {
      const res = await api.get(`/onboarding?storeId=${store?.id}`);
      return res.data as { steps: { id: number; titleAr: string; desc: string; done: boolean }[]; completedCount: number; isComplete: boolean };
    },
    enabled: !!store?.id,
  });

  if (isLoading) return <div className="p-8 text-gray-500">جاري التحميل...</div>;

  const steps = data?.steps ?? [];
  const pct = Math.round(((data?.completedCount ?? 0) / 5) * 100);

  return (
    <div className="max-w-2xl mx-auto p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-8">
        <Rocket className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعداد متجرك</h1>
          <p className="text-sm text-gray-500">{data?.completedCount ?? 0} من 5 خطوات مكتملة</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-gray-100 rounded-full mb-8">
        <div
          className="h-2.5 bg-indigo-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {data?.isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-800">أحسنت! متجرك جاهز للإطلاق 🎉</p>
          <Link href="/" className="mt-3 inline-block text-sm text-green-700 underline">العودة للوحة التحكم</Link>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`rounded-xl border p-4 flex items-center gap-4 transition ${
              step.done ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:border-indigo-300"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="h-6 w-6 text-gray-300 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${step.done ? "text-green-800 line-through" : "text-gray-800"}`}>
                {step.id}. {step.titleAr}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
            </div>
            {!step.done && (
              <Link href={STEP_LINKS[i] ?? "/settings"} className="text-indigo-600 hover:text-indigo-800 flex-shrink-0">
                <ChevronRight className="h-5 w-5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
