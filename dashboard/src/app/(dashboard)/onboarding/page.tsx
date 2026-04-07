"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, Circle, Rocket, Sparkles, Target, Truck, Wand2, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth.store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STEP_LINKS = ["/settings", "/products/new", "/settings", "/settings/payments", "/settings/shipping"];

type MerchantType = "beginner" | "migrating" | "expert";
type LanguageMode = "AR" | "EN" | "BOTH";

type Questionnaire = {
  merchantType: MerchantType;
  businessType: string;
  catalogSource: "scratch" | "existing-store" | "spreadsheet";
  primaryGoal: string;
  targetCountries: string[];
  brandTone: string;
  monthlyOrdersRange: "0-50" | "51-200" | "201-500" | "500+";
  wantsCashOnDelivery: boolean;
  wantsArabicContent: boolean;
  freeShippingThreshold: number | "";
};

type WorkspaceResponse = {
  store: {
    id: string;
    name: string;
    nameAr: string | null;
    currency: string;
    language: LanguageMode;
    timezone: string;
    descriptionAr: string | null;
  };
  progress: {
    steps: { id: number; titleAr: string; desc: string; done: boolean }[];
    completedCount: number;
    isComplete: boolean;
  };
  currentStats: { products: number; orders: number; customers: number };
  latestDraft: {
    createdAt: string;
    message: string;
    payload: OnboardingDraft | null;
    questionnaire: Questionnaire | null;
  } | null;
  capability: {
    overallStatus: "enabled" | "degraded" | "unavailable";
    reason?: string;
  };
};

type OnboardingDraft = {
  store: {
    description: string;
    descriptionAr: string;
    currency: string;
    language: LanguageMode;
    timezone: string;
  };
  settings: {
    freeShippingMin: number | null;
    allowReviews: boolean;
    showOutOfStock: boolean;
    tapEnabled: boolean;
    moyasarEnabled: boolean;
    benefitEnabled: boolean;
  };
  recommendations: {
    catalog: { mode: string };
    shipping: { model: string };
  };
  checklist: string[];
  summary: string;
  aiSummary?: string | null;
};

const MERCHANT_TYPES = [
  {
    id: "beginner" as MerchantType,
    icon: Sparkles,
    label: "أبدأ لأول مرة",
    desc: "سأولد لك خطة إعداد جاهزة بدلاً من checklist فقط.",
    className: "border-indigo-200 bg-indigo-50/80",
    iconClassName: "bg-indigo-100 text-indigo-600",
  },
  {
    id: "migrating" as MerchantType,
    icon: Truck,
    label: "أنقل متجري من منصة أخرى",
    desc: "سأحولك مباشرة إلى استيراد الكتالوج مع preview واعتماد قبل التنفيذ.",
    className: "border-amber-200 bg-amber-50/80",
    iconClassName: "bg-amber-100 text-amber-600",
  },
  {
    id: "expert" as MerchantType,
    icon: Zap,
    label: "خبير وأريد الدخول مباشرة",
    desc: "سأترك checklist وأذهب للوحة التحكم فوراً.",
    className: "border-emerald-200 bg-emerald-50/80",
    iconClassName: "bg-emerald-100 text-emerald-600",
  },
] as const;

const DEFAULT_QUESTIONNAIRE: Questionnaire = {
  merchantType: "beginner",
  businessType: "أزياء",
  catalogSource: "scratch",
  primaryGoal: "رفع أول 50 طلباً بأسرع وقت",
  targetCountries: ["BH"],
  brandTone: "عصري وواضح",
  monthlyOrdersRange: "0-50",
  wantsCashOnDelivery: true,
  wantsArabicContent: true,
  freeShippingThreshold: 25,
};

const COUNTRIES = [
  { code: "BH", label: "البحرين" },
  { code: "SA", label: "السعودية" },
  { code: "AE", label: "الإمارات" },
  { code: "KW", label: "الكويت" },
];

function capabilityVariant(status: WorkspaceResponse["capability"]["overallStatus"]) {
  if (status === "enabled") return "success" as const;
  if (status === "degraded") return "warning" as const;
  return "error" as const;
}

function readSavedType(): MerchantType | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem("bazar_merchant_type");
  if (value === "beginner" || value === "migrating" || value === "expert") return value;
  return null;
}

function readSavedQuestionnaire(): Questionnaire {
  if (typeof window === "undefined") return DEFAULT_QUESTIONNAIRE;
  const value = localStorage.getItem("bazar_onboarding_questionnaire");
  if (!value) return DEFAULT_QUESTIONNAIRE;
  try {
    return JSON.parse(value) as Questionnaire;
  } catch {
    localStorage.removeItem("bazar_onboarding_questionnaire");
    return DEFAULT_QUESTIONNAIRE;
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: unknown } }).response?.data &&
    typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === "string"
  ) {
    return (error as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { store } = useAuthStore();
  const [merchantType, setMerchantType] = useState<MerchantType | null>(() => readSavedType());
  const [typeChosen, setTypeChosen] = useState(() => readSavedType() !== null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>(() => {
    const savedType = readSavedType();
    const savedQuestionnaire = readSavedQuestionnaire();
    return savedType ? { ...savedQuestionnaire, merchantType: savedType } : savedQuestionnaire;
  });

  const workspaceQuery = useQuery({
    queryKey: ["onboarding-workspace", store?.id],
    queryFn: async () => {
      const res = await api.get(`/onboarding/workspace?storeId=${store?.id}`);
      return res.data as WorkspaceResponse;
    },
    enabled: !!store?.id && typeChosen && merchantType === "beginner",
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...questionnaire,
        storeId: store?.id,
        freeShippingThreshold:
          questionnaire.freeShippingThreshold === "" ? undefined : Number(questionnaire.freeShippingThreshold),
      };
      const res = await api.post("/onboarding/workspace/draft", payload);
      return res.data as { draft: OnboardingDraft; usedAI: boolean };
    },
    onSuccess: () => {
      localStorage.setItem("bazar_onboarding_questionnaire", JSON.stringify(questionnaire));
      queryClient.invalidateQueries({ queryKey: ["onboarding-workspace", store?.id] });
      showToast("تم توليد مسودة إعداد ذكية قابلة للتطبيق", "success");
    },
    onError: (error: unknown) => {
      showToast(getApiErrorMessage(error, "تعذر توليد مسودة الإعداد"), "error");
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const latestDraft = workspaceQuery.data?.latestDraft?.payload;
      if (!latestDraft) {
        throw new Error("لا توجد مسودة جاهزة للتطبيق");
      }
      const res = await api.post("/onboarding/workspace/apply", {
        storeId: store?.id,
        draft: latestDraft,
      });
      return res.data as { warnings: string[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-workspace", store?.id] });
      showToast(
        data.warnings.length > 0
          ? `تم التطبيق مع ${data.warnings.length} تنبيه متعلق باعتمادات الدفع.`
          : "تم تطبيق الإعداد الذكي على المتجر",
        data.warnings.length > 0 ? "warning" : "success"
      );
    },
    onError: (error: unknown) => {
      showToast(getApiErrorMessage(error, "تعذر تطبيق المسودة"), "error");
    },
  });

  const handleTypeSelect = (type: MerchantType) => {
    localStorage.setItem("bazar_merchant_type", type);
    setMerchantType(type);
    setTypeChosen(true);
    setQuestionnaire((current) => ({ ...current, merchantType: type }));
    if (type === "expert") router.push("/");
    if (type === "migrating") router.push("/import");
  };

  const toggleCountry = (countryCode: string) => {
    setQuestionnaire((current) => {
      const nextCountries = current.targetCountries.includes(countryCode)
        ? current.targetCountries.filter((item) => item !== countryCode)
        : [...current.targetCountries, countryCode];
      return {
        ...current,
        targetCountries: nextCountries.length > 0 ? nextCountries : [countryCode],
      };
    });
  };

  if (!store) {
    return <div className="p-8 text-slate-500">جاري تحميل بيانات المتجر...</div>;
  }

  if (!typeChosen) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-6" dir="rtl">
        <div className="mx-auto max-w-4xl pt-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Rocket className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">كيف تريد أن تبدأ في بازار؟</h1>
            <p className="mt-2 text-sm text-slate-500">أحدد لك المسار المناسب ثم أوصلك مباشرة إلى التنفيذ الفعلي.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {MERCHANT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className={`rounded-3xl border p-5 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${type.className}`}
                >
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${type.iconClassName}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{type.label}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{type.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (merchantType !== "beginner") {
    return <div className="p-8 text-slate-500">جاري تحويلك إلى المسار الأنسب...</div>;
  }

  if (workspaceQuery.isLoading) {
    return <div className="p-8 text-slate-500">جاري تحميل مساحة الإعداد...</div>;
  }

  const workspace = workspaceQuery.data;
  const latestDraft = workspace?.latestDraft?.payload;
  const steps = workspace?.progress.steps ?? [];
  const progressPercent = Math.round((((workspace?.progress.completedCount ?? 0) / 5) || 0) * 100);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_45%,_#fefce8_100%)]" dir="rtl">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={capabilityVariant(workspace?.capability.overallStatus || "unavailable")} dot>
                {workspace?.capability.overallStatus === "enabled"
                  ? "AI متاح"
                  : workspace?.capability.overallStatus === "degraded"
                    ? "AI متدهور مؤقتاً"
                    : "AI غير مهيأ"}
              </Badge>
              <Badge variant="info">{workspace?.progress.completedCount ?? 0} / 5</Badge>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">مساحة الإعداد الذكي للمتجر</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              بدلاً من checklist فقط، هذه الصفحة تولد إعداداً مناسباً لنوع نشاطك، وجهتك، وخطة الكتالوج ثم تطبقه مباشرة على المتجر.
            </p>
            {workspace?.capability.reason && (
              <p className="mt-2 text-xs text-amber-700">{workspace.capability.reason}</p>
            )}
          </div>
          <div className="min-w-[260px] rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>نسبة الجاهزية</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-gradient-to-l from-amber-500 to-indigo-600" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
              <div className="rounded-xl bg-white p-3">{workspace?.currentStats.products ?? 0} منتج</div>
              <div className="rounded-xl bg-white p-3">{workspace?.currentStats.orders ?? 0} طلب</div>
              <div className="rounded-xl bg-white p-3">{workspace?.currentStats.customers ?? 0} عميل</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">الاستبيان السريع</h2>
                  <p className="mt-1 text-sm text-slate-500">كلما كانت الإجابات أدق، كانت التوصيات والتطبيقات أوضح.</p>
                </div>
                <Button size="sm" loading={draftMutation.isPending} onClick={() => draftMutation.mutate()} icon={<Wand2 />}>
                  توليد المسودة
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="نوع النشاط"
                  value={questionnaire.businessType}
                  onChange={(event) => setQuestionnaire((current) => ({ ...current, businessType: event.target.value }))}
                />
                <Input
                  label="الهدف الرئيسي"
                  value={questionnaire.primaryGoal}
                  onChange={(event) => setQuestionnaire((current) => ({ ...current, primaryGoal: event.target.value }))}
                />
                <Input
                  label="هوية العلامة"
                  value={questionnaire.brandTone}
                  onChange={(event) => setQuestionnaire((current) => ({ ...current, brandTone: event.target.value }))}
                />
                <Input
                  type="number"
                  label="حد الشحن المجاني"
                  value={questionnaire.freeShippingThreshold}
                  onChange={(event) => setQuestionnaire((current) => ({
                    ...current,
                    freeShippingThreshold: event.target.value === "" ? "" : Number(event.target.value),
                  }))}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">مصدر الكتالوج</label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={questionnaire.catalogSource}
                    onChange={(event) => setQuestionnaire((current) => ({ ...current, catalogSource: event.target.value as Questionnaire["catalogSource"] }))}
                  >
                    <option value="scratch">أبدأ من الصفر</option>
                    <option value="existing-store">أنقل من منصة أخرى</option>
                    <option value="spreadsheet">لدي ملف CSV أو Excel</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">الحجم المتوقع شهرياً</label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={questionnaire.monthlyOrdersRange}
                    onChange={(event) => setQuestionnaire((current) => ({ ...current, monthlyOrdersRange: event.target.value as Questionnaire["monthlyOrdersRange"] }))}
                  >
                    <option value="0-50">0 - 50 طلب</option>
                    <option value="51-200">51 - 200 طلب</option>
                    <option value="201-500">201 - 500 طلب</option>
                    <option value="500+">500+ طلب</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">لغة المتجر</label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={questionnaire.wantsArabicContent ? "BOTH" : "EN"}
                    onChange={(event) => setQuestionnaire((current) => ({ ...current, wantsArabicContent: event.target.value !== "EN" }))}
                  >
                    <option value="BOTH">عربي + إنجليزي</option>
                    <option value="EN">إنجليزي فقط</option>
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold text-slate-600">الدول المستهدفة</div>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((country) => {
                    const selected = questionnaire.targetCountries.includes(country.code);
                    return (
                      <button
                        key={country.code}
                        onClick={() => toggleCountry(country.code)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {country.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                  <span>أريد الدفع عند الاستلام</span>
                  <input
                    type="checkbox"
                    checked={questionnaire.wantsCashOnDelivery}
                    onChange={(event) => setQuestionnaire((current) => ({ ...current, wantsCashOnDelivery: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                  <span>أريد محتوى عربي افتراضياً</span>
                  <input
                    type="checkbox"
                    checked={questionnaire.wantsArabicContent}
                    onChange={(event) => setQuestionnaire((current) => ({ ...current, wantsArabicContent: event.target.checked }))}
                  />
                </label>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">تقدم الإعداد الأساسي</h2>
                  <p className="text-sm text-slate-500">يبقى هذا التتبع مرتبطاً بحالة المتجر الفعلية.</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem("bazar_merchant_type");
                    setTypeChosen(false);
                    setMerchantType(null);
                  }}
                >
                  تغيير المسار
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${
                      step.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-300" />}
                    <div className="flex-1">
                      <div className={`font-medium ${step.done ? "text-emerald-800" : "text-slate-900"}`}>{step.titleAr}</div>
                      <div className="text-xs text-slate-500">{step.desc}</div>
                    </div>
                    {!step.done && (
                      <Link href={STEP_LINKS[index] ?? "/settings"} className="text-indigo-600 hover:text-indigo-800">
                        <ChevronLeft className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">آخر مسودة ذكية</h2>
                  <p className="text-sm text-slate-500">تُحفظ آخر نسخة لتتمكن من مراجعتها قبل التطبيق.</p>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  disabled={!latestDraft}
                  loading={applyMutation.isPending}
                  onClick={() => applyMutation.mutate()}
                  icon={<Target />}
                >
                  تطبيق على المتجر
                </Button>
              </div>

              {!latestDraft ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  لم يتم توليد أي مسودة بعد. أكمل الاستبيان ثم اضغط &quot;توليد المسودة&quot;.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="brand">{latestDraft.store.currency}</Badge>
                      <Badge variant="info">{latestDraft.store.timezone}</Badge>
                      <Badge variant="success">{latestDraft.store.language}</Badge>
                    </div>
                    <p className="text-sm leading-7 text-slate-700">{latestDraft.aiSummary || latestDraft.summary}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-2 font-medium text-slate-900">الدفع والشحن</div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div>الحد المجاني: {latestDraft.settings.freeShippingMin ?? "غير محدد"}</div>
                        <div>Tap: {latestDraft.settings.tapEnabled ? "مقترح" : "غير مقترح"}</div>
                        <div>Moyasar: {latestDraft.settings.moyasarEnabled ? "مقترح" : "غير مقترح"}</div>
                        <div>Benefit Pay: {latestDraft.settings.benefitEnabled ? "مقترح" : "غير مقترح"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-2 font-medium text-slate-900">الوصف والتجربة</div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div>{latestDraft.store.descriptionAr}</div>
                        <div>نمط الكتالوج: {latestDraft.recommendations.catalog.mode}</div>
                        <div>نمط الشحن: {latestDraft.recommendations.shipping.model}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 font-medium text-slate-900">قائمة التنفيذ المقترحة</div>
                    <div className="space-y-2">
                      {latestDraft.checklist.map((item: string) => (
                        <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-500" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="mb-3 text-lg font-semibold text-slate-900">ماذا يحدث عند التطبيق؟</div>
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <div>سيتم تحديث وصف المتجر، اللغة، العملة، والمنطقة الزمنية.</div>
                <div>سيتم ضبط حد الشحن المجاني وخيارات المراجعات وإظهار نفاد المخزون.</div>
                <div>لن يتم تفعيل أي بوابة دفع إذا كانت الاعتمادات الفعلية ناقصة، وسيظهر تنبيه واضح بدلاً من التفعيل الوهمي.</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
