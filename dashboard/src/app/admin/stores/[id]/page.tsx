"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatBHD } from "@/lib/utils";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, ExternalLink, ShoppingBag, Users, Package, TrendingUp,
  RefreshCw, XCircle, Store, Calendar, Ban, UserCheck, Crown, BarChart3,
  LogIn, CalendarDays, Activity, Clock,
} from "lucide-react";

interface ActivityItem {
  type: "order" | "product" | "customer";
  id: string;
  title: string;
  subtitle: string | null;
  meta: number | null;
  status: string | null;
  createdAt: string;
}

interface StoreDetail {
  store: {
    id: string;
    name: string;
    nameAr: string;
    subdomain: string;
    plan: string;
    isActive: boolean;
    createdAt: string;
    merchant: { id: string; firstName: string; lastName: string; email: string };
    currency: string;
    logo: string | null;
    _count: { orders: number; products: number; customers: number };
  };
  revenue: number;
  avgOrderValue: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
    customer?: { name: string };
  }[];
  topProducts: {
    id: string;
    name: string;
    nameAr: string;
    price: number;
    totalSold: number;
  }[];
}

const PLAN_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  STARTER:    { bg: "rgba(100,116,139,.12)", color: "#94a3b8", border: "rgba(100,116,139,.25)", label: "ستارتر" },
  GROWTH:     { bg: "rgba(59,130,246,.12)",  color: "#60a5fa", border: "rgba(59,130,246,.3)",   label: "نمو" },
  PRO:        { bg: "rgba(139,92,246,.12)",  color: "#a78bfa", border: "rgba(139,92,246,.3)",   label: "برو" },
  ENTERPRISE: { bg: "rgba(245,158,11,.12)",  color: "#fbbf24", border: "rgba(245,158,11,.3)",   label: "مؤسسات" },
};

const ORDER_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:    { bg: "rgba(245,158,11,.12)",  color: "#fbbf24", label: "معلق" },
  PROCESSING: { bg: "rgba(59,130,246,.12)",  color: "#60a5fa", label: "قيد التجهيز" },
  SHIPPED:    { bg: "rgba(139,92,246,.12)",  color: "#a78bfa", label: "تم الشحن" },
  DELIVERED:  { bg: "rgba(16,185,129,.12)",  color: "#34d399", label: "تم التسليم" },
  CANCELLED:  { bg: "rgba(239,68,68,.12)",   color: "#f87171", label: "ملغي" },
  REFUNDED:   { bg: "rgba(239,68,68,.08)",   color: "#fca5a5", label: "مُسترد" },
};

const PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"];

const AVATAR_COLORS = [
  ["#1e3a5f","#60a5fa"],["#1a3a2e","#34d399"],["#3b1f2b","#f472b6"],
  ["#2d2a1a","#fbbf24"],["#1f1f3b","#a78bfa"],
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<"data" | "activity">("data");
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialDays, setTrialDays] = useState(7);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading } = useQuery<StoreDetail>({
    queryKey: ["admin-store-detail", id],
    queryFn: () => api.get(`/admin/stores/${id}`).then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/admin/stores/${id}`, { isActive }),
    onSuccess: (_, isActive) => {
      qc.invalidateQueries({ queryKey: ["admin-store-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      showToast(isActive ? "تم تفعيل المتجر ✅" : "تم تعطيل المتجر");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const changePlan = useMutation({
    mutationFn: (plan: string) => api.patch(`/admin/stores/${id}`, { plan }),
    onSuccess: (_, plan) => {
      qc.invalidateQueries({ queryKey: ["admin-store-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      showToast(`تم تغيير الباقة إلى ${PLAN_STYLE[plan]?.label} ✅`);
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const extendTrial = useMutation({
    mutationFn: (days: number) => api.post(`/admin/stores/${id}/extend-trial`, { days }),
    onSuccess: (_, days) => {
      showToast(`تم تمديد الفترة بـ ${days} يوم ✅`);
      setShowTrialModal(false);
      qc.invalidateQueries({ queryKey: ["admin-store-detail", id] });
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const impersonate = useMutation({
    mutationFn: () => api.post(`/admin/stores/${id}/impersonate`),
    onSuccess: (res) => {
      window.open(res.data.dashboardUrl, "_blank");
      showToast("تم فتح جلسة التاجر ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["admin-store-activity", id],
    queryFn: () => api.get(`/admin/stores/${id}/activity`).then((r) => r.data),
    enabled: activeMainTab === "activity",
  });

  if (isLoading) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-screen" style={{ background: "#060b18" }}>
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "#3b82f6" }} />
          </div>
          <p className="text-sm" style={{ color: "#3d5470" }}>جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!data?.store) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-screen" style={{ background: "#060b18" }}>
        <div className="text-center space-y-4">
          <XCircle className="w-14 h-14 mx-auto" style={{ color: "#ef4444" }} />
          <p style={{ color: "#8aa8c4" }}>لم يتم العثور على المتجر</p>
          <Link href="/admin/stores" className="text-sm" style={{ color: "#60a5fa" }}>← العودة للمتاجر</Link>
        </div>
      </div>
    );
  }

  const { store, revenue, avgOrderValue, recentOrders, topProducts } = data;
  const ps = PLAN_STYLE[store.plan] ?? PLAN_STYLE.STARTER;
  const [bgC, txtC] = avatarColor(store.nameAr || store.name);
  const storeInitials = (store.nameAr || store.name).slice(0, 2);

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .action-btn:hover { filter: brightness(1.12); }
        .plan-opt { background: #060b18; color: #8aa8c4; }
        .tab-btn { transition: all .2s; }
      `}</style>

      {/* Extend Trial Modal */}
      {showTrialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.75)" }} onClick={() => setShowTrialModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-base" style={{ color: "#e2eef8" }}>تمديد الفترة التجريبية</h2>
              <button onClick={() => setShowTrialModal(false)} style={{ color: "#4a6480" }}><XCircle className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>عدد الأيام</label>
              <input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-center text-xl font-black"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}
              />
            </div>
            <div className="flex gap-2">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrialDays(d)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: trialDays === d ? "rgba(59,130,246,.2)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${trialDays === d ? "rgba(59,130,246,.4)" : "rgba(255,255,255,.08)"}`,
                    color: trialDays === d ? "#60a5fa" : "#3d5470",
                  }}
                >
                  {d} يوم
                </button>
              ))}
            </div>
            <button
              onClick={() => extendTrial.mutate(trialDays)}
              disabled={extendTrial.isPending || trialDays < 1}
              className="action-btn w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)", color: "#34d399" }}
            >
              {extendTrial.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              تمديد {trialDays} يوم
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}
        >
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/stores"
          className="inline-flex items-center gap-2 text-sm font-semibold transition"
          style={{ color: "#4a6480" }}
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى المتاجر
        </Link>

        {/* Hero */}
        <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <div className="absolute top-0 right-0 w-80 h-36 rounded-full opacity-[0.07] blur-3xl pointer-events-none" style={{ background: txtC }} />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative">
            {/* Avatar / Logo */}
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
                style={{ background: bgC, color: txtC, boxShadow: `0 0 30px ${txtC}22` }}
              >
                {storeInitials}
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>{store.nameAr || store.name}</h1>
                <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
                <span
                  className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{
                    background: store.isActive ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)",
                    color: store.isActive ? "#34d399" : "#f87171",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: store.isActive ? "#10b981" : "#ef4444" }} />
                  {store.isActive ? "نشط" : "موقوف"}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: "#4a6480" }}>
                <a
                  href={`https://${store.subdomain}.bazar.bh`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-blue-400 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {store.subdomain}.bazar.bh
                </a>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> أُنشئ {formatDate(store.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الإيرادات", value: formatBHD(revenue), icon: TrendingUp, color: "#34d399", glow: "#10b981" },
            { label: "الطلبات الكلية", value: store._count.orders.toLocaleString("ar"), icon: ShoppingBag, color: "#fbbf24", glow: "#f59e0b" },
            { label: "العملاء", value: store._count.customers.toLocaleString("ar"), icon: Users, color: "#60a5fa", glow: "#3b82f6" },
            { label: "المنتجات", value: store._count.products.toLocaleString("ar"), icon: Package, color: "#a78bfa", glow: "#8b5cf6" },
          ].map(({ label, value, icon: Icon, color, glow }) => (
            <div
              key={label}
              className="rounded-2xl p-4 space-y-3 relative overflow-hidden"
              style={{ background: "#0c1526", border: "1px solid #1a2840" }}
            >
              <div className="absolute top-0 left-0 w-20 h-20 rounded-full opacity-[0.07] blur-2xl pointer-events-none" style={{ background: glow }} />
              <div className="flex items-center justify-between relative">
                <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${glow}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
              </div>
              <p className="text-xl font-black relative" style={{ color: "#dce8f5" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left tabs */}
          <div className="lg:col-span-2 space-y-3">
            {/* Tab headers */}
            <div className="flex gap-2">
              {([{key: "data" as const, label: "الطلبات والمنتجات"}, {key: "activity" as const, label: "سجل النشاطات"}]).map(({key, label}) => (
                <button
                  key={key}
                  onClick={() => setActiveMainTab(key)}
                  className="tab-btn px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: activeMainTab === key ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${activeMainTab === key ? "rgba(59,130,246,.3)" : "rgba(255,255,255,.06)"}`,
                    color: activeMainTab === key ? "#60a5fa" : "#3d5470",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeMainTab === "data" && <>
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#2d4560" }}>آخر الطلبات</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              {(recentOrders?.length ?? 0) === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
                  <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد طلبات بعد</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1a2840" }}>
                      {["الطلب", "العميل", "المبلغ", "الحالة", "التاريخ"].map((h) => (
                        <th
                          key={h}
                          className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest"
                          style={{ color: "#2d4560" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order, idx) => {
                      const os = ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE.PENDING;
                      return (
                        <tr
                          key={order.id}
                          style={{ borderBottom: idx < recentOrders.length - 1 ? "1px solid #0f1a2d" : "none" }}
                        >
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: "#60a5fa" }}>
                            #{order.orderNumber}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "#8aa8c4" }}>
                            {order.customer?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold" style={{ color: "#34d399" }}>
                            {formatBHD(order.total)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: os.bg, color: os.color }}>
                              {os.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "#3d5470" }}>
                            {formatDate(order.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Products */}    
            <p className="text-[11px] font-black uppercase tracking-widest pt-2" style={{ color: "#2d4560" }}>المنتجات الأعلى مبيعاً</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              {(topProducts?.length ?? 0) === 0 ? (
                <div className="py-10 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "#a78bfa" }} />
                  <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد مبيعات بعد</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {topProducts.map((product, idx) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "#060b18" }}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{ background: "rgba(139,92,246,.15)", color: "#a78bfa" }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "#c8ddf0" }}>
                          {product.nameAr || product.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "#3d5470" }}>{formatBHD(product.price)}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="text-xs font-black" style={{ color: "#fbbf24" }}>
                          {product.totalSold.toLocaleString("ar")}
                        </p>
                        <p className="text-[9px]" style={{ color: "#2d4560" }}>مبيع</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            }

            {/* Activity Log Tab */}
            {activeMainTab === "activity" && (
              <div className="space-y-2">
                {(activityData?.activities?.length ?? 0) === 0 ? (
                  <div className="rounded-2xl py-12 text-center" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
                    <p className="text-sm" style={{ color: "#2d4560" }}>لا يوجد نشاط بعد</p>
                  </div>
                ) : (
                  activityData?.activities.map((item) => {
                    const typeStyle = {
                      order:    { bg: "rgba(245,158,11,.1)",  color: "#fbbf24", icon: ShoppingBag },
                      product:  { bg: "rgba(139,92,246,.1)",  color: "#a78bfa", icon: Package },
                      customer: { bg: "rgba(59,130,246,.1)",  color: "#60a5fa", icon: Users },
                    }[item.type];
                    const Icon = typeStyle?.icon ?? Activity;
                    return (
                      <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#0c1526", border: "1px solid #0f1a2d" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: typeStyle?.bg }}>
                          <Icon className="w-4 h-4" style={{ color: typeStyle?.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: "#c8ddf0" }}>{item.title}</p>
                          {item.subtitle && <p className="text-[10px] truncate" style={{ color: "#3d5470" }}>{item.subtitle}</p>}
                        </div>
                        <div className="text-left flex-shrink-0 space-y-0.5">
                          {item.meta !== null && (
                            <p className="text-xs font-black" style={{ color: "#34d399" }}>{item.meta.toFixed(3)} BD</p>
                          )}
                          {item.status && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{
                              background: ORDER_STATUS_STYLE[item.status]?.bg ?? "rgba(59,130,246,.1)",
                              color: ORDER_STATUS_STYLE[item.status]?.color ?? "#60a5fa",
                            }}>
                              {ORDER_STATUS_STYLE[item.status]?.label ?? item.status}
                            </span>
                          )}
                          <p className="text-[9px]" style={{ color: "#2d4560" }}>
                            <Clock className="w-2.5 h-2.5 inline ml-0.5" />
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#2d4560" }}>إجراءات الإدارة</p>
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              {/* Toggle Active */}
              <button
                onClick={() => toggleActive.mutate(!store.isActive)}
                disabled={toggleActive.isPending}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition disabled:opacity-40"
                style={{
                  background: store.isActive ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.08)",
                  border: `1px solid ${store.isActive ? "rgba(239,68,68,.2)" : "rgba(16,185,129,.2)"}`,
                  color: store.isActive ? "#f87171" : "#34d399",
                }}
              >
                {store.isActive
                  ? <><Ban className="w-4 h-4" /> تعطيل المتجر</>
                  : <><UserCheck className="w-4 h-4" /> تفعيل المتجر</>}
              </button>

              {/* Change Plan */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold px-1" style={{ color: "#2d4560" }}>تغيير الباقة</p>
                <select
                  value={store.plan}
                  onChange={(e) => changePlan.mutate(e.target.value)}
                  disabled={changePlan.isPending}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer"
                  style={{
                    background: ps.bg,
                    border: `1px solid ${ps.border}`,
                    color: ps.color,
                  }}
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p} className="plan-opt">
                      {PLAN_STYLE[p].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Divider */}
              <div className="border-t" style={{ borderColor: "#1a2840" }} />

              {/* View Storefront */}
              <a
                href={`https://${store.subdomain}.bazar.bh`}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition"
                style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}
              >
                <ExternalLink className="w-4 h-4" /> فتح المتجر
              </a>

              {/* Extend Trial */}
              <button
                onClick={() => setShowTrialModal(true)}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition"
                style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}
              >
                <CalendarDays className="w-4 h-4" /> تمديد الفترة التجريبية
              </button>

              {/* Impersonate */}
              <button
                onClick={() => impersonate.mutate()}
                disabled={impersonate.isPending}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition disabled:opacity-40"
                style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", color: "#fbbf24" }}
              >
                {impersonate.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                تسجيل الدخول كالتاجر
              </button>

              {/* Divider */}
              <div className="border-t" style={{ borderColor: "#1a2840" }} />

              {/* Merchant Info */}
              <div>
                <p className="text-[10px] font-semibold mb-2" style={{ color: "#2d4560" }}>مالك المتجر</p>
                <Link
                  href={`/admin/merchants/${store.merchant.id}`}
                  className="flex items-center gap-3 p-2 rounded-xl transition"
                  style={{ background: "#060b18" }}
                >
                  {(() => {
                    const [mc, tc] = avatarColor(store.merchant.firstName);
                    return (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: mc, color: tc }}>
                        {store.merchant.firstName[0]}{store.merchant.lastName[0]}
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "#c8ddf0" }}>
                      {store.merchant.firstName} {store.merchant.lastName}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "#3d5470" }}>{store.merchant.email}</p>
                  </div>
                </Link>
              </div>

              {/* Stats */}
              <div className="border-t pt-3 space-y-2" style={{ borderColor: "#1a2840" }}>
                {[
                  { label: "متوسط قيمة الطلب", value: formatBHD(avgOrderValue), color: "#fbbf24" },
                  { label: "العملة", value: store.currency ?? "BHD", color: "#8aa8c4" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <p className="text-[10px]" style={{ color: "#2d4560" }}>{label}</p>
                    <p className="text-xs font-black" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
