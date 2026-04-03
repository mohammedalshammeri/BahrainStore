"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBHD, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Search, ChevronLeft, ChevronRight, ExternalLink,
  Store, ShoppingBag, Users, Package, RefreshCw, TrendingUp, Eye,
} from "lucide-react";

interface AdminStore {
  id: string;
  name: string;
  nameAr: string;
  subdomain: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  revenue: number;
  merchant: { id: string; email: string; firstName: string; lastName: string };
  _count: { orders: number; products: number; customers: number };
}

const PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"];

const PLAN_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  STARTER:    { bg: "rgba(100,116,139,.14)", color: "#94a3b8", border: "rgba(100,116,139,.3)", label: "ستارتر" },
  GROWTH:     { bg: "rgba(59,130,246,.14)",  color: "#60a5fa", border: "rgba(59,130,246,.3)",  label: "نمو" },
  PRO:        { bg: "rgba(139,92,246,.14)",  color: "#a78bfa", border: "rgba(139,92,246,.3)",  label: "برو" },
  ENTERPRISE: { bg: "rgba(245,158,11,.14)",  color: "#fbbf24", border: "rgba(245,158,11,.3)",  label: "مؤسسات" },
};

function StatCard({
  label, value, icon: Icon, color, glow,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string; glow: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 space-y-3 relative overflow-hidden"
      style={{ background: "#0c1526", border: "1px solid #1a2840" }}
    >
      <div
        className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-[0.08] blur-2xl pointer-events-none"
        style={{ background: glow }}
      />
      <div className="flex items-center justify-between relative">
        <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${glow}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black relative" style={{ color: "#dce8f5" }}>
        {typeof value === "number" ? value.toLocaleString("ar") : value}
      </p>
    </div>
  );
}

export default function AdminStoresPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const qc = useQueryClient();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__adminStoreTimer);
    (window as any).__adminStoreTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 350);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stores", page, debouncedSearch, planFilter, statusFilter],
    queryFn: async () => {
      const q = new URLSearchParams({ page: String(page), limit: "15" });
      if (debouncedSearch) q.set("search", debouncedSearch);
      if (planFilter !== "all") q.set("plan", planFilter);
      if (statusFilter !== "all") q.set("status", statusFilter);
      const res = await api.get(`/admin/stores?${q}`);
      return res.data as { stores: AdminStore[]; total: number; pages: number };
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/stores/${id}`, { isActive }),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      showToast(isActive ? "تم تفعيل المتجر ✅" : "تم تعطيل المتجر");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      api.patch(`/admin/stores/${id}`, { plan }),
    onSuccess: (_, { plan }) => {
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      showToast(`تم تغيير الباقة إلى ${PLAN_STYLE[plan]?.label} ✅`);
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  return (
    <div
      dir="rtl"
      style={{
        background: "#060b18",
        minHeight: "100vh",
        color: "#dce8f5",
        fontFamily: "Cairo, sans-serif",
      }}
    >
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.35} }
        .toast-anim { animation: fadein .3s ease; }
        .store-row { transition: background .15s; }
        .store-row:hover { background: #0a1120 !important; }
        .pulse-dot { animation: pulse-dot 2s infinite; }
        .plan-opt { background: #060b18; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}
        >
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "#e2eef8" }}>المتاجر</h1>
            <p className="text-sm mt-1" style={{ color: "#2d4560" }}>
              {data?.total ? `${data.total.toLocaleString("ar")} متجر مسجل` : "تحميل..."}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="إجمالي المتاجر"  value={data?.total ?? 0}          icon={Store}       color="#60a5fa" glow="#3b82f6" />
          <StatCard label="الطلبات الكلية"   value={data?.stores.reduce((s, x) => s + x._count.orders, 0) ?? 0}    icon={ShoppingBag} color="#fbbf24" glow="#f59e0b" />
          <StatCard label="إجمالي العملاء"   value={data?.stores.reduce((s, x) => s + x._count.customers, 0) ?? 0} icon={Users}       color="#34d399" glow="#10b981" />
          <StatCard
            label="إجمالي الإيرادات"
            value={formatBHD(data?.stores.reduce((s, x) => s + (x.revenue ?? 0), 0) ?? 0)}
            icon={TrendingUp}
            color="#a78bfa"
            glow="#8b5cf6"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "#2d4560" }}
            />
            <input
              type="text"
              placeholder="بحث بالاسم أو النطاق أو البريد..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2.5 text-sm rounded-xl outline-none transition"
              style={{
                background: "#0c1526",
                border: "1px solid #1a2840",
                color: "#c8ddf0",
              }}
            />
          </div>

          {/* Plan filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["all", ...PLANS].map((p) => {
              const ps = PLAN_STYLE[p];
              const active = planFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => { setPlanFilter(p); setPage(1); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  style={{
                    background: active ? (ps?.bg ?? "rgba(59,130,246,.15)") : "rgba(255,255,255,.03)",
                    border: `1px solid ${active ? (ps?.border ?? "rgba(59,130,246,.3)") : "rgba(255,255,255,.06)"}`,
                    color: active ? (ps?.color ?? "#60a5fa") : "#3d5470",
                  }}
                >
                  {p === "all" ? "الكل" : ps?.label ?? p}
                </button>
              );
            })}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                style={{
                  background: statusFilter === s
                    ? s === "active" ? "rgba(16,185,129,.12)" : s === "inactive" ? "rgba(239,68,68,.1)" : "rgba(59,130,246,.1)"
                    : "rgba(255,255,255,.03)",
                  border: `1px solid ${statusFilter === s
                    ? s === "active" ? "rgba(16,185,129,.25)" : s === "inactive" ? "rgba(239,68,68,.2)" : "rgba(59,130,246,.2)"
                    : "rgba(255,255,255,.06)"}`,
                  color: statusFilter === s
                    ? s === "active" ? "#34d399" : s === "inactive" ? "#f87171" : "#60a5fa"
                    : "#3d5470",
                }}
              >
                {s === "all" ? "الحالة" : s === "active" ? "نشط" : "موقوف"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a2840" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ background: "#0c1526" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1a2840" }}>
                  {["المتجر", "التاجر", "الباقة", "الإيرادات", "الطلبات", "المنتجات", "العملاء", "تاريخ الإنشاء", "الحالة", ""].map((h) => (
                    <th
                      key={h}
                      className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                      style={{ color: "#2d4560", background: "#060b18" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array(8).fill(0).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #0a1120" }}>
                        {Array(10).fill(0).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-3 rounded-full animate-pulse" style={{ background: "#1a2840", width: `${40 + Math.random() * 40}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : data?.stores.map((s, idx) => {
                      const ps = PLAN_STYLE[s.plan] ?? PLAN_STYLE.STARTER;
                      const initials = (s.nameAr || s.name).slice(0, 2);
                      return (
                        <tr
                          key={s.id}
                          className="store-row"
                          style={{ borderBottom: "1px solid #0a1120", background: "#060b18" }}
                        >
                          {/* Store */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                                style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa" }}
                              >
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-sm leading-tight" style={{ color: "#c8ddf0" }}>
                                  {s.nameAr || s.name}
                                </p>
                                <a
                                  href={`http://${s.subdomain}.bazar.bh`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[10px] flex items-center gap-1 mt-0.5 hover:text-blue-400 transition"
                                  style={{ color: "#2d4560" }}
                                >
                                  {s.subdomain}.bazar.bh
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </div>
                          </td>

                          {/* Merchant */}
                          <td className="px-4 py-4">
                            <Link href={`/admin/merchants/${s.merchant.id}`}>
                              <p className="text-xs font-semibold hover:text-blue-400 transition" style={{ color: "#8aa8c4" }}>
                                {s.merchant.firstName} {s.merchant.lastName}
                              </p>
                              <p className="text-[10px] mt-0.5" style={{ color: "#3d5470" }}>
                                {s.merchant.email}
                              </p>
                            </Link>
                          </td>

                          {/* Plan inline select */}
                          <td className="px-4 py-4">
                            <select
                              value={s.plan}
                              onChange={(e) => changePlan.mutate({ id: s.id, plan: e.target.value })}
                              className="text-[11px] font-black px-2.5 py-1 rounded-full cursor-pointer outline-none appearance-none plan-opt"
                              style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}
                            >
                              {PLANS.map((p) => (
                                <option key={p} value={p} className="plan-opt">{PLAN_STYLE[p].label}</option>
                              ))}
                            </select>
                          </td>

                          {/* Revenue */}
                          <td className="px-4 py-4 font-black text-sm" style={{ color: "#34d399" }}>
                            {formatBHD(s.revenue ?? 0)}
                          </td>

                          {/* Orders */}
                          <td className="px-4 py-4 text-xs font-semibold" style={{ color: "#8aa8c4" }}>
                            {s._count.orders.toLocaleString("ar")}
                          </td>

                          {/* Products */}
                          <td className="px-4 py-4 text-xs" style={{ color: "#4a6480" }}>
                            {s._count.products.toLocaleString("ar")}
                          </td>

                          {/* Customers */}
                          <td className="px-4 py-4 text-xs" style={{ color: "#4a6480" }}>
                            {s._count.customers.toLocaleString("ar")}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-4 text-xs whitespace-nowrap" style={{ color: "#3d5470" }}>
                            {formatDate(s.createdAt)}
                          </td>

                          {/* Status toggle */}
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleActive.mutate({ id: s.id, isActive: !s.isActive })}
                              disabled={toggleActive.isPending}
                              className="flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full transition disabled:opacity-40"
                              style={{
                                background: s.isActive ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.08)",
                                border: `1px solid ${s.isActive ? "rgba(16,185,129,.25)" : "rgba(239,68,68,.2)"}`,
                                color: s.isActive ? "#34d399" : "#f87171",
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full pulse-dot"
                                style={{ background: s.isActive ? "#10b981" : "#ef4444" }}
                              />
                              {s.isActive ? "نشط" : "موقوف"}
                            </button>
                          </td>

                          {/* View */}
                          <td className="px-4 py-4">
                            <Link
                              href={`/admin/stores/${s.id}`}
                              className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition"
                              style={{ background: "rgba(59,130,246,.08)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.15)" }}
                            >
                              <Eye className="w-3 h-3" /> عرض
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!isLoading && data?.stores.length === 0 && (
            <div className="py-20 text-center" style={{ background: "#060b18" }}>
              <Store className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
              <p style={{ color: "#2d4560" }}>لا توجد متاجر بهذه الفلاتر</p>
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ background: "#060b18", borderTop: "1px solid #1a2840" }}
            >
              <p className="text-xs" style={{ color: "#3d5470" }}>
                صفحة {page} من {data.pages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl transition disabled:opacity-30"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="p-2 rounded-xl transition disabled:opacity-30"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
