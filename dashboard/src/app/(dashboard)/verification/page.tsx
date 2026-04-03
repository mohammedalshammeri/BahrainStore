"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  Upload,
  Shield,
  CreditCard,
  FileText,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

type Level = "basic" | "verified" | "commercial";

const LEVELS = [
  {
    id: "basic" as Level,
    num: 1,
    label: "أساسي",
    doc: "صورة الهوية الوطنية أو جواز السفر",
    unlocks: ["فتح المتجر", "الدفع عند الاستلام (COD)"],
    color: "indigo",
    icon: Shield,
  },
  {
    id: "verified" as Level,
    num: 2,
    label: "موثق",
    doc: "وثيقة عمل حر أو شهادة تسجيل",
    unlocks: ["بوابات الدفع الأونلاين", "BenefitPay / MyFatoorah / Tap"],
    color: "amber",
    icon: CreditCard,
  },
  {
    id: "commercial" as Level,
    num: 3,
    label: "تجاري",
    doc: "سجل تجاري ساري المفعول",
    unlocks: ["كل الميزات", "الفاتورة الإلكترونية ZATCA", "حدود معاملات مرتفعة"],
    color: "emerald",
    icon: FileText,
  },
] as const;

const LEVEL_COLORS: Record<string, string> = {
  indigo: "border-indigo-200 bg-indigo-50",
  amber:  "border-amber-200 bg-amber-50",
  emerald: "border-emerald-200 bg-emerald-50",
};
const ICON_BG: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-600",
  amber:  "bg-amber-100 text-amber-600",
  emerald: "bg-emerald-100 text-emerald-600",
};
const STATUS_BADGE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function VerificationPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Level | null>("basic");
  const [files, setFiles] = useState<Record<Level, File | null>>({ basic: null, verified: null, commercial: null });
  const [submitting, setSubmitting] = useState<Level | null>(null);
  const [success, setSuccess] = useState("");

  const { data } = useQuery({
    queryKey: ["verification", store?.id],
    queryFn: async () => {
      const res = await api.get(`/verification?storeId=${store!.id}`);
      return res.data as {
        currentLevel: Level;
        submissions: Array<{ level: Level; status: string; rejectionReason?: string; createdAt: string }>;
      };
    },
    enabled: !!store?.id,
  });

  const currentLevel = data?.currentLevel ?? "basic";
  const submissions = data?.submissions ?? [];

  const getSubmission = (level: Level) => submissions.find(s => s.level === level);

  const handleSubmit = async (level: Level) => {
    const file = files[level];
    if (!file || !store) return;
    setSubmitting(level);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("storeId", store.id);
      formData.append("level", level);
      await api.post("/verification/submit", formData, { headers: { "Content-Type": "multipart/form-data" } });
      queryClient.invalidateQueries({ queryKey: ["verification", store.id] });
      setFiles(prev => ({ ...prev, [level]: null }));
      setSuccess("تم إرسال الوثيقة بنجاح، ستتم المراجعة خلال 24 ساعة");
      setTimeout(() => setSuccess(""), 5000);
    } catch (e: any) {
      // error handled by showing rejection reasons from API
    } finally {
      setSubmitting(null);
    }
  };

  const levelOrder: Level[] = ["basic", "verified", "commercial"];
  const currentIdx = levelOrder.indexOf(currentLevel);

  return (
    <div className="flex flex-col">
      <Header title="التوثيق والحماية" subtitle="وثّق متجرك لفتح المزيد من الميزات" />

      <div className="p-6 max-w-2xl mx-auto w-full space-y-4">

        {/* Current level banner */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-indigo-200">مستوى التوثيق الحالي</p>
            <p className="text-xl font-bold">
              {LEVELS.find(l => l.id === currentLevel)?.label ?? "أساسي"}
            </p>
          </div>
          <div className="mr-auto flex gap-1">
            {LEVELS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-all ${i <= currentIdx ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Levels */}
        {LEVELS.map((level, i) => {
          const isDone = levelOrder.indexOf(currentLevel) >= i;
          const sub = getSubmission(level.id);
          const isPending = sub?.status === "pending";
          const isRejected = sub?.status === "rejected";
          const isOpen = expanded === level.id;
          const Icon = level.icon;
          const isLocked = i > currentIdx + 1;

          return (
            <Card key={level.id} className={`overflow-hidden transition-all ${isDone ? "border-emerald-200" : ""}`}>
              <button
                className="w-full flex items-center gap-4 p-4 text-right"
                onClick={() => !isLocked && setExpanded(isOpen ? null : level.id)}
              >
                <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${isDone ? "bg-emerald-100 text-emerald-600" : ICON_BG[level.color]}`}>
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : isLocked ? <Lock className="h-5 w-5 text-slate-400" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">المستوى {level.num} — {level.label}</p>
                    {isDone && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">مكتمل</span>}
                    {isPending && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE.pending}`}>قيد المراجعة</span>}
                    {isRejected && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE.rejected}`}>مرفوض</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{level.doc}</p>
                </div>
                {!isLocked && (
                  isOpen ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                )}
              </button>

              {isOpen && !isLocked && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                  {/* What it unlocks */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">ما يفتح بعد التوثيق:</p>
                    <div className="flex flex-wrap gap-2">
                      {level.unlocks.map(u => (
                        <span key={u} className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${LEVEL_COLORS[level.color]}`}>
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isRejected && sub?.rejectionReason && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">
                        <span className="font-medium">سبب الرفض: </span>{sub.rejectionReason}
                      </p>
                    </div>
                  )}

                  {!isDone && !isPending && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-700">ارفع الوثيقة المطلوبة:</p>
                      <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 cursor-pointer transition ${files[level.id] ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"}`}>
                        <Upload className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {files[level.id] ? files[level.id]!.name : "اضغط لرفع الصورة أو PDF"}
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0] ?? null;
                            setFiles(prev => ({ ...prev, [level.id]: f }));
                          }}
                        />
                      </label>
                      <Button
                        className="w-full"
                        disabled={!files[level.id] || submitting === level.id}
                        loading={submitting === level.id}
                        onClick={() => handleSubmit(level.id)}
                      >
                        إرسال للمراجعة
                      </Button>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex items-center gap-2 rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      الوثيقة قيد المراجعة — ستستلم إشعاراً خلال 24 ساعة
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        <p className="text-center text-xs text-slate-400">
          جميع الوثائق مشفّرة ومحمية — بازار لن يشارك بياناتك مع أي طرف ثالث
        </p>
      </div>
    </div>
  );
}
