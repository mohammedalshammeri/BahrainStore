"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Store, Globe, FileText, CheckCircle,
  ArrowLeft, ArrowRight, Sparkles,
} from "lucide-react";

// ── Schemas per step ───────────────────────────
const step1Schema = z.object({
  nameAr: z.string().min(2, "اسم المتجر بالعربي مطلوب"),
  name: z.string().min(2, "Store name in English is required"),
  subdomain: z
    .string()
    .min(3, "3 أحرف على الأقل")
    .max(30)
    .regex(/^[a-z0-9-]+$/, "أحرف إنجليزية صغيرة وأرقام وشرطة فقط"),
});

const step2Schema = z.object({
  descriptionAr: z.string().optional(),
  description: z.string().optional(),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

function slugify(val: string) {
  return val
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);
}

// ── Step indicator ─────────────────────────────
const STEPS = [
  { label: "معلومات المتجر", icon: <Store className="w-4 h-4" /> },
  { label: "التفاصيل", icon: <FileText className="w-4 h-4" /> },
  { label: "تم!", icon: <CheckCircle className="w-4 h-4" /> },
];

export default function NewStorePage() {
  const router = useRouter();
  const { setStore } = useAuthStore();
  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [serverError, setServerError] = useState("");
  const [creating, setCreating] = useState(false);
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [subdomainTaken, setSubdomainTaken] = useState(false);

  // ─── Step 1 form ────────────────────────────
  const {
    register: reg1,
    handleSubmit: hs1,
    watch: watch1,
    setValue: sv1,
    formState: { errors: e1 },
  } = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });

  // ─── Step 2 form ────────────────────────────
  const {
    register: reg2,
    handleSubmit: hs2,
    formState: { errors: e2 },
  } = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  // Auto-fill subdomain from nameAr
  const nameArVal = watch1("nameAr");

  async function checkSubdomain(sub: string) {
    if (!sub || sub.length < 3) return;
    setSubdomainChecking(true);
    try {
      await api.get(`/stores/s/${sub}`);
      setSubdomainTaken(true); // store exists → taken
    } catch {
      setSubdomainTaken(false); // 404 → available
    } finally {
      setSubdomainChecking(false);
    }
  }

  function onStep1(data: Step1Data) {
    if (subdomainTaken) return;
    setStep1Data(data);
    setStep(1);
  }

  async function onStep2(data: Step2Data) {
    if (!step1Data) return;
    setCreating(true);
    setServerError("");
    try {
      const res = await api.post("/stores", {
        ...step1Data,
        ...data,
      });
      setStore(res.data.store);
      setStep(2);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setServerError(e.response?.data?.error ?? "حدث خطأ، حاول مرة أخرى");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="w-7 h-7 text-indigo-600" />
        <span className="text-2xl font-bold text-indigo-700">بزار</span>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition
              ${i < step ? "bg-green-100 text-green-700" : i === step ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"}`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : s.icon}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 ${i < step ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-7">
        {/* ── Step 0: Store identity ─────────── */}
        {step === 0 && (
          <form onSubmit={hs1(onStep1)} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">أنشئ متجرك الأول 🏪</h1>
              <p className="text-sm text-gray-500">هذه المعلومات ستظهر للزبائن</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">اسم المتجر بالعربي *</label>
              <input
                {...reg1("nameAr", {
                  onChange: (e) => {
                    const slug = slugify(e.target.value);
                    sv1("subdomain", slug);
                    checkSubdomain(slug);
                  },
                })}
                placeholder="مثال: متجر الرفاعي"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {e1.nameAr && <p className="text-red-500 text-xs mt-1">{e1.nameAr.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">اسم المتجر بالإنجليزي *</label>
              <input
                {...reg1("name")}
                placeholder="e.g. Rifai Store"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {e1.name && <p className="text-red-500 text-xs mt-1">{e1.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                رابط المتجر *
                <span className="text-gray-400 font-normal mr-1 text-xs">(لا يمكن تغييره لاحقاً)</span>
              </label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                <input
                  {...reg1("subdomain", {
                    onChange: (e) => checkSubdomain(e.target.value),
                  })}
                  placeholder="rifai-store"
                  className="flex-1 px-4 py-2.5 text-sm outline-none"
                />
                <span className="bg-gray-50 px-3 py-2.5 text-xs text-gray-400 border-r border-gray-200">
                  .bazar.bh
                </span>
              </div>
              {e1.subdomain && <p className="text-red-500 text-xs mt-1">{e1.subdomain.message}</p>}
              {subdomainChecking && <p className="text-gray-400 text-xs mt-1">جاري التحقق...</p>}
              {subdomainTaken && !subdomainChecking && (
                <p className="text-red-500 text-xs mt-1">هذا الرابط محجوز، اختر رابطاً آخر</p>
              )}
              {!subdomainTaken && !subdomainChecking && watch1("subdomain")?.length >= 3 && (
                <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> الرابط متاح
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={subdomainTaken || subdomainChecking}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              التالي <ArrowLeft className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ── Step 1: Details ───────────────── */}
        {step === 1 && (
          <form onSubmit={hs2(onStep2)} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">تفاصيل إضافية</h1>
              <p className="text-sm text-gray-500">اختياري — يمكنك تعديلها لاحقاً</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">وصف المتجر بالعربي</label>
              <textarea
                {...reg2("descriptionAr")}
                rows={2}
                placeholder="اكتب وصفاً مختصراً عن متجرك..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">وصف المتجر بالإنجليزي</label>
              <textarea
                {...reg2("description")}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">رقم السجل التجاري</label>
                <input
                  {...reg2("crNumber")}
                  placeholder="12345-1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">رقم الضريبة (VAT)</label>
                <input
                  {...reg2("vatNumber")}
                  placeholder="BH000000000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                <ArrowRight className="w-4 h-4" /> رجوع
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    جاري الإنشاء...
                  </span>
                ) : (
                  <>إنشاء المتجر <Sparkles className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Success ───────────────── */}
        {step === 2 && (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">تم إنشاء متجرك! 🎉</h1>
            <p className="text-gray-500 text-sm mb-6">
              متجرك الآن جاهز على{" "}
              <span className="font-mono text-indigo-600">{step1Data?.subdomain}.bazar.bh</span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition"
              >
                الذهاب للوحة التحكم
              </button>
              <button
                onClick={() => router.push("/products/new")}
                className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition"
              >
                أضف منتجك الأول
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">© {new Date().getFullYear()} بزار — جميع الحقوق محفوظة</p>
    </div>
  );
}
