"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBHD } from "@/lib/utils";
import {
  CreditCard, Users, ShoppingBag, UserCheck, Package2, TrendingUp,
  RefreshCw, Save, Edit3, CheckCircle2, X, Plus, Trash2,
} from "lucide-react";

interface PlanData {
  plan: string;
  priceBD: number;
  maxProducts: number;
  maxOrders: number;
  maxStaff: number;
  maxApps: number;
  features: string[];
  storeCount: number;
  revenue: number;
}

const PLAN_META: Record<string, { nameAr: string; color: string; bg: string; border: string; glow: string }> = {
  STARTER:    { nameAr: "مجاني",     color: "#94a3b8", bg: "rgba(100,116,139,.1)", border: "rgba(100,116,139,.2)", glow: "rgba(100,116,139,.15)" },
  GROWTH:     { nameAr: "نمو",       color: "#60a5fa", bg: "rgba(59,130,246,.1)",  border: "rgba(59,130,246,.25)",  glow: "rgba(59,130,246,.12)" },
  PRO:        { nameAr: "احترافي",   color: "#a78bfa", bg: "rgba(139,92,246,.1)",  border: "rgba(139,92,246,.25)",  glow: "rgba(139,92,246,.12)" },
  ENTERPRISE: { nameAr: "مؤسسي",     color: "#fbbf24", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.25)",  glow: "rgba(245,158,11,.12)" },
};

function limitLabel(v: number) {
  return v === -1 ? "∞ غير محدود" : v.toLocaleString("ar");
}

export default function PlansPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<PlanData>>>({});
  const [newFeature, setNewFeature] = useState<Record<string, string>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { data, isLoading } = useQuery<{ plans: PlanData[] }>({
    queryKey: ["admin-plans"],
    queryFn: () => api.get("/admin/plans").then((r) => r.data),
  });

  const savePlan = useMutation({
    mutationFn: ({ plan, body }: { plan: string; body: Partial<PlanData> }) =>
      api.put(`/admin/plans/${plan}`, body),
    onSuccess: (_, { plan }) => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditing(null);
      setDrafts((d) => { const c = { ...d }; delete c[plan]; return c; });
      showToast("تم حفظ إعدادات الباقة ✅");
    },
    onError: () => showToast("حدث خطأ أثناء الحفظ", "error"),
  });

  const startEdit = (p: PlanData) => {
    setEditing(p.plan);
    setDrafts((d) => ({ ...d, [p.plan]: { ...p } }));
  };

  const cancelEdit = (plan: string) => {
    setEditing(null);
    setDrafts((d) => { const c = { ...d }; delete c[plan]; return c; });
  };

  const updateDraft = (plan: string, key: keyof PlanData, value: any) => {
    setDrafts((d) => ({ ...d, [plan]: { ...d[plan], [key]: value } }));
  };

  const addFeature = (plan: string) => {
    const val = (newFeature[plan] ?? "").trim();
    if (!val) return;
    const cur = [...(drafts[plan]?.features ?? []), val];
    updateDraft(plan, "features", cur);
    setNewFeature((n) => ({ ...n, [plan]: "" }));
  };

  const removeFeature = (plan: string, idx: number) => {
    const cur = [...(drafts[plan]?.features ?? [])];
    cur.splice(idx, 1);
    updateDraft(plan, "features", cur);
  };

  if (isLoading) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-screen" style={{ background: "#060b18" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#3b82f6" }} />
      </div>
    );
  }

  const plans = data?.plans ?? [];
  const totalStores = plans.reduce((s, p) => s + p.storeCount, 0);
  const totalRevenue = plans.reduce((s, p) => s + p.revenue, 0);

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .card-hover:hover { border-color: rgba(59,130,246,.3) !important; }
        .num-input::-webkit-inner-spin-button { opacity:.4; }
      `}</style>

      {toast && (
        <div className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}>
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>إدارة الباقات</h1>
            <p className="text-sm mt-1" style={{ color: "#3d5470" }}>تعديل الأسعار والحدود ومميزات كل باقة</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <p className="text-lg font-black" style={{ color: "#60a5fa" }}>{totalStores.toLocaleString("ar")}</p>
              <p className="text-[10px]" style={{ color: "#2d4560" }}>إجمالي المتاجر</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <p className="text-lg font-black" style={{ color: "#34d399" }}>{totalRevenue.toFixed(3)} BD</p>
              <p className="text-[10px]" style={{ color: "#2d4560" }}>إجمالي الإيراد</p>
            </div>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((plan) => {
            const meta = PLAN_META[plan.plan] ?? PLAN_META.STARTER;
            const isEdit = editing === plan.plan;
            const draft = drafts[plan.plan] ?? plan;

            return (
              <div key={plan.plan}
                className="card-hover rounded-2xl p-5 space-y-4 relative overflow-hidden transition"
                style={{ background: "#0c1526", border: `1px solid ${isEdit ? meta.border : "#1a2840"}` }}
              >
                {/* Glow */}
                <div className="absolute top-0 left-0 w-48 h-24 rounded-full blur-3xl pointer-events-none opacity-60"
                  style={{ background: meta.glow }} />

                {/* Head */}
                <div className="flex items-start justify-between relative">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: meta.bg }}>
                      <CreditCard className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                        {meta.nameAr}
                      </span>
                      <p className="font-mono text-[10px] mt-0.5" style={{ color: "#2d4560" }}>{plan.plan}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEdit ? (
                      <>
                        <button onClick={() => cancelEdit(plan.plan)}
                          className="p-1.5 rounded-lg" style={{ color: "#3d5470" }}>
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => savePlan.mutate({ plan: plan.plan, body: draft })}
                          disabled={savePlan.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                          style={{ background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)", color: "#34d399" }}
                        >
                          {savePlan.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          حفظ
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(plan)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> تعديل
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "#060b18" }}>
                    <Users className="w-4 h-4 flex-shrink-0" style={{ color: "#3b82f6" }} />
                    <div>
                      <p className="text-sm font-black" style={{ color: "#c8ddf0" }}>{plan.storeCount.toLocaleString("ar")}</p>
                      <p className="text-[10px]" style={{ color: "#2d4560" }}>متجر نشط</p>
                    </div>
                  </div>
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "#060b18" }}>
                    <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "#34d399" }} />
                    <div>
                      <p className="text-sm font-black" style={{ color: "#c8ddf0" }}>{plan.revenue.toFixed(3)} BD</p>
                      <p className="text-[10px]" style={{ color: "#2d4560" }}>إجمالي الإيراد</p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold" style={{ color: "#2d4560" }}>السعر الشهري (BD)</p>
                  {isEdit ? (
                    <input
                      type="number"
                      min={0}
                      step={0.001}
                      value={draft.priceBD ?? 0}
                      onChange={(e) => updateDraft(plan.plan, "priceBD", parseFloat(e.target.value) || 0)}
                      className="num-input w-full px-3 py-2 rounded-xl text-sm font-black outline-none"
                      style={{ background: "#060b18", border: `1px solid ${meta.border}`, color: meta.color }}
                    />
                  ) : (
                    <p className="text-2xl font-black" style={{ color: meta.color }}>
                      {plan.priceBD === 0 ? "مجاني" : `${plan.priceBD.toFixed(3)} BD`}
                      {plan.priceBD > 0 && <span className="text-xs font-normal mr-1" style={{ color: "#3d5470" }}>/شهر</span>}
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold" style={{ color: "#2d4560" }}>الحدود</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "maxProducts" as const, label: "منتجات", icon: Package2 },
                      { key: "maxOrders" as const,   label: "طلبات/شهر", icon: ShoppingBag },
                      { key: "maxStaff" as const,    label: "موظفون", icon: UserCheck },
                      { key: "maxApps" as const,     label: "تطبيقات", icon: CreditCard },
                    ].map(({ key, label, icon: Icon }) => (
                      <div key={key} className="rounded-xl p-2.5" style={{ background: "#060b18" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3 h-3" style={{ color: "#2d4560" }} />
                          <p className="text-[10px]" style={{ color: "#2d4560" }}>{label}</p>
                        </div>
                        {isEdit ? (
                          <input
                            type="number"
                            value={draft[key] ?? 0}
                            onChange={(e) => updateDraft(plan.plan, key, parseInt(e.target.value) || 0)}
                            placeholder="-1 = غير محدود"
                            className="num-input w-full text-xs font-black outline-none bg-transparent"
                            style={{ color: "#c8ddf0" }}
                          />
                        ) : (
                          <p className="text-xs font-black" style={{ color: "#8aa8c4" }}>
                            {limitLabel(plan[key] as number)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold" style={{ color: "#2d4560" }}>المميزات</p>
                  <div className="space-y-1">
                    {(isEdit ? draft.features : plan.features)?.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} />
                        <span className="text-xs flex-1" style={{ color: "#8aa8c4" }}>{f}</span>
                        {isEdit && (
                          <button onClick={() => removeFeature(plan.plan, i)} className="p-0.5" style={{ color: "#3d5470" }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isEdit && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newFeature[plan.plan] ?? ""}
                        onChange={(e) => setNewFeature((n) => ({ ...n, [plan.plan]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addFeature(plan.plan)}
                        placeholder="أضف ميزة جديدة..."
                        className="flex-1 px-2.5 py-1.5 rounded-xl text-xs outline-none"
                        style={{ background: "#060b18", border: `1px solid ${meta.border}`, color: "#c8ddf0" }}
                      />
                      <button onClick={() => addFeature(plan.plan)}
                        className="p-1.5 rounded-xl" style={{ background: meta.bg, color: meta.color }}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
