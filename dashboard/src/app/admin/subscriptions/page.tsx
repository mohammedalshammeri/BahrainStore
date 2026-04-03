"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Clock, AlertTriangle, RefreshCw, BellRing, ShieldOff,
  Store, ChevronRight,
} from "lucide-react";

interface StoreItem {
  id: string;
  name: string;
  nameAr: string;
  subdomain: string;
  plan: string;
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  merchant: { id: string; firstName: string; lastName: string; email: string };
  _count: { products: number; orders: number };
}

interface ListResponse {
  stores: StoreItem[];
  total: number;
  page: number;
  pages: number;
}

const PLAN_COLOR: Record<string, string> = {
  STARTER: "#94a3b8", GROWTH: "#60a5fa", PRO: "#a78bfa", ENTERPRISE: "#fbbf24",
};
const PLAN_AR: Record<string, string> = {
  STARTER: "مجاني", GROWTH: "نمو", PRO: "احترافي", ENTERPRISE: "مؤسسي",
};

function daysDiff(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  return Math.round((d - now) / 86_400_000);
}

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"expired" | "trial">("expired");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: expiredData, isLoading: loadingExpired } = useQuery<ListResponse>({
    queryKey: ["admin-subscriptions-expired"],
    queryFn: () => api.get("/admin/subscriptions/expired?limit=100").then((r) => r.data),
  });

  const { data: trialData, isLoading: loadingTrial } = useQuery<ListResponse>({
    queryKey: ["admin-subscriptions-trial"],
    queryFn: () => api.get("/admin/subscriptions/trial?limit=100").then((r) => r.data),
  });

  const suspendExpired = useMutation({
    mutationFn: () => api.post("/admin/billing/suspend-expired"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-subscriptions-expired"] });
      showToast(`تم تعطيل ${res.data.suspended} متجر ✅`);
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const notifyExpiring = useMutation({
    mutationFn: () => api.post("/admin/billing/notify-expiring"),
    onSuccess: (res) => {
      showToast(`تم إرسال ${res.data.notified ?? 0} إشعار ✅`);
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const expiredList = expiredData?.stores ?? [];
  const trialList = trialData?.stores ?? [];
  const activeList = tab === "expired" ? expiredList : trialList;
  const loading = tab === "expired" ? loadingExpired : loadingTrial;

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .row-hover:hover { background: rgba(255,255,255,.03) !important; }
      `}</style>

      {toast && (
        <div className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}>
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>الاشتراكات</h1>
            <p className="text-sm mt-1" style={{ color: "#3d5470" }}>متابعة حالة اشتراكات المتاجر</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => notifyExpiring.mutate()}
              disabled={notifyExpiring.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", color: "#fbbf24" }}
            >
              {notifyExpiring.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
              إرسال التنبيهات
            </button>
            <button
              onClick={() => suspendExpired.mutate()}
              disabled={suspendExpired.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171" }}
            >
              {suspendExpired.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
              تعطيل المنتهية
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 space-y-1 flex flex-col" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>منتهية الاشتراك</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,.12)" }}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
              </div>
            </div>
            <p className="text-3xl font-black" style={{ color: "#f87171" }}>{expiredData?.total ?? "—"}</p>
            <p className="text-[10px]" style={{ color: "#2d4560" }}>متجر منتهي الاشتراك</p>
          </div>

          <div className="rounded-2xl p-4 space-y-1 flex flex-col" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>في فترة تجريبية</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(96,165,250,.12)" }}>
                <Clock className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
              </div>
            </div>
            <p className="text-3xl font-black" style={{ color: "#60a5fa" }}>{trialData?.total ?? "—"}</p>
            <p className="text-[10px]" style={{ color: "#2d4560" }}>متجر في التجربة</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#0c1526", width: "fit-content" }}>
          {[
            { key: "expired", label: "منتهية الاشتراك", icon: AlertTriangle, color: "#f87171" },
            { key: "trial",   label: "الفترة التجريبية",  icon: Clock,         color: "#60a5fa" },
          ].map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition"
              style={{
                background: tab === key ? "rgba(255,255,255,.05)" : "transparent",
                color: tab === key ? color : "#3d5470",
                border: tab === key ? "1px solid rgba(255,255,255,.06)" : "1px solid transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
            </div>
          ) : activeList.length === 0 ? (
            <div className="py-16 text-center">
              <Store className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
              <p className="text-sm" style={{ color: "#2d4560" }}>
                {tab === "expired" ? "لا توجد متاجر منتهية الاشتراك" : "لا توجد متاجر في فترة تجريبية"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #1a2840" }}>
                  {["المتجر", "التاجر", "الباقة", tab === "expired" ? "مدة الانتهاء" : "المتبقي للانتهاء", "المنتجات / الطلبات", ""].map((h) => (
                    <th key={h} className="text-right px-4 py-3 text-[10px] font-black uppercase" style={{ color: "#2d4560" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeList.map((store) => {
                  const refDate = tab === "expired" ? store.planExpiresAt : store.trialEndsAt;
                  const diff = refDate ? daysDiff(refDate) : null;
                  const diffLabel = diff === null ? "—"
                    : tab === "expired"
                      ? `منذ ${Math.abs(diff)} يوم`
                      : `${diff} يوم متبقي`;
                  const diffColor = tab === "expired"
                    ? "#f87171"
                    : diff !== null && diff <= 3 ? "#fbbf24" : "#34d399";
                  return (
                    <tr key={store.id} className="row-hover transition" style={{ borderBottom: "1px solid #0f1a2d" }}>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold" style={{ color: "#c8ddf0" }}>{store.nameAr || store.name}</p>
                        <p className="text-[10px]" style={{ color: "#2d4560" }}>{store.subdomain}.bahrain.store</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium" style={{ color: "#8aa8c4" }}>
                          {store.merchant.firstName} {store.merchant.lastName}
                        </p>
                        <p className="text-[10px]" style={{ color: "#2d4560" }}>{store.merchant.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: PLAN_COLOR[store.plan] + "18", color: PLAN_COLOR[store.plan] }}>
                          {PLAN_AR[store.plan] ?? store.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold" style={{ color: diffColor }}>{diffLabel}</p>
                        {refDate && (
                          <p className="text-[10px]" style={{ color: "#2d4560" }}>{formatDate(refDate)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[10px]" style={{ color: "#3d5470" }}>
                          {store._count.products} منتج / {store._count.orders} طلب
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/stores/${store.id}`}>
                          <ChevronRight className="w-4 h-4" style={{ color: "#2d4560" }} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
