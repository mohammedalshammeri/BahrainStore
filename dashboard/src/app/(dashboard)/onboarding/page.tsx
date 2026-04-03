"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Rocket, CheckCircle2, Circle, ChevronRight, Sparkles, Truck, Zap } from "lucide-react";
import Link from "next/link";

const STEP_LINKS = ["/settings", "/products/new", "/settings", "/settings", "/settings"];

type MerchantType = "beginner" | "migrating" | "expert";

const MERCHANT_TYPES = [
  {
    id: "beginner" as MerchantType,
    icon: Sparkles,
    label: "أبدأ لأول مرة",
    desc: "سأرشدك خطوة بخطوة حتى يصبح متجرك جاهزاً",
    color: "indigo",
  },
  {
    id: "migrating" as MerchantType,
    icon: Truck,
    label: "أنقل متجري من منصة أخرى",
    desc: "استورد منتجاتك من سلة أو زد أو Shopify في دقائق",
    color: "amber",
  },
  {
    id: "expert" as MerchantType,
    icon: Zap,
    label: "خبير، أريد الوصول المباشر",
    desc: "تخطّ الإعداد وادخل للوحة التحكم مباشرة",
    color: "emerald",
  },
] as const;

const TYPE_COLORS: Record<string, string> = {
  indigo: "border-indigo-500 bg-indigo-50",
  amber: "border-amber-500 bg-amber-50",
  emerald: "border-emerald-500 bg-emerald-50",
};
const ICON_BG: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-600",
  amber: "bg-amber-100 text-amber-600",
  emerald: "bg-emerald-100 text-emerald-600",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { store } = useAuthStore();
  const [merchantType, setMerchantType] = useState<MerchantType | null>(null);
  const [typeChosen, setTypeChosen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("bazar_merchant_type") as MerchantType | null;
    if (saved) {
      setMerchantType(saved);
      setTypeChosen(true);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding", store?.id],
    queryFn: async () => {
      const res = await api.get(`/onboarding?storeId=${store?.id}`);
      return res.data as { steps: { id: number; titleAr: string; desc: string; done: boolean }[]; completedCount: number; isComplete: boolean };
    },
    enabled: !!store?.id && typeChosen && merchantType === "beginner",
  });

  const handleTypeSelect = (type: MerchantType) => {
    localStorage.setItem("bazar_merchant_type", type);
    setMerchantType(type);
    setTypeChosen(true);
    if (type === "expert") router.push("/");
    if (type === "migrating") router.push("/import");
  };

  if (!store) return <div className="p-8 text-slate-500">جاري تحميل بيانات المتجر...</div>;

  // Type selection screen
  if (!typeChosen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-6" dir="rtl">
        <div className="w-full max-w-lg">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-600 text-white mb-4">
              <Rocket className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">مرحباً بك في بازار</h1>
            <p className="text-slate-500 mt-2">كيف تصف نفسك؟ سنخصص تجربتك بناءً على إجابتك</p>
          </div>

          <div className="space-y-3">
            {MERCHANT_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTypeSelect(t.id)}
                  className={`w-full flex items-center gap-4 rounded-2xl border-2 p-5 text-right transition-all hover:shadow-md border-slate-200 bg-white hover:${TYPE_COLORS[t.color]}`}
                >
                  <div className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${ICON_BG[t.color]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{t.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{t.desc}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            يمكنك تغيير هذا لاحقاً من الإعدادات
          </p>
        </div>
      </div>
    );
  }

  // Beginner: show 5-step checklist
  if (isLoading) return <div className="p-8 text-slate-500">جاري التحميل...</div>;

  const steps = data?.steps ?? [];
  const pct = Math.round(((data?.completedCount ?? 0) / 5) * 100);

  return (
    <div className="max-w-2xl mx-auto p-8" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Rocket className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إعداد متجرك</h1>
            <p className="text-sm text-gray-500">{data?.completedCount ?? 0} من 5 خطوات مكتملة</p>
          </div>
        </div>
        <button
          onClick={() => { localStorage.removeItem("bazar_merchant_type"); setTypeChosen(false); setMerchantType(null); }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          تغيير النوع
        </button>
      </div>

      <div className="w-full h-2.5 bg-gray-100 rounded-full mb-8">
        <div
          className="h-2.5 bg-indigo-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {data?.isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-800">أحسنت! متجرك جاهز للإطلاق</p>
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
