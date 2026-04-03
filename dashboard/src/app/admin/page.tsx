"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users, Store, ShoppingBag, CreditCard, TrendingUp,
  UserCheck, Layers, ArrowUpRight, RefreshCw,
} from "lucide-react";

interface AdminStats {
  totalMerchants: number;
  totalStores: number;
  totalOrders: number;
  totalCustomers: number;
  newMerchantsThisWeek: number;
  newStoresThisMonth: number;
  totalRevenue: number;
  planCounts: { plan: string; count: number }[];
}

const PLAN_LABELS: Record<string, string> = {
  STARTER: "ستارتر",
  GROWTH: "نمو",
  PRO: "برو",
  ENTERPRISE: "مؤسسات",
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-slate-100 text-slate-600",
  GROWTH: "bg-blue-100 text-blue-700",
  PRO: "bg-indigo-100 text-indigo-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

const PLAN_BAR_COLORS: Record<string, string> = {
  STARTER: "bg-slate-400",
  GROWTH: "bg-blue-500",
  PRO: "bg-indigo-500",
  ENTERPRISE: "bg-purple-600",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("ar-BH", {
    style: "currency",
    currency: "BHD",
    maximumFractionDigits: 3,
  }).format(n);
}

export default function AdminOverviewPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await api.get("/admin/stats");
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const totalPlanStores = data?.planCounts.reduce((s, p) => s + p.count, 0) ?? 0;

  const cards = [
    {
      label: "إجمالي التجار",
      value: data?.totalMerchants ?? 0,
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      sub: `+${data?.newMerchantsThisWeek ?? 0} هذا الأسبوع`,
      subColor: "text-emerald-600",
    },
    {
      label: "إجمالي المتاجر",
      value: data?.totalStores ?? 0,
      icon: Store,
      color: "text-blue-600",
      bg: "bg-blue-50",
      sub: `+${data?.newStoresThisMonth ?? 0} هذا الشهر`,
      subColor: "text-emerald-600",
    },
    {
      label: "إجمالي الطلبات",
      value: data?.totalOrders ?? 0,
      icon: ShoppingBag,
      color: "text-amber-600",
      bg: "bg-amber-50",
      sub: "جميع الطلبات",
      subColor: "text-slate-400",
    },
    {
      label: "إجمالي العملاء",
      value: data?.totalCustomers ?? 0,
      icon: UserCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
      sub: "في كل المتاجر",
      subColor: "text-slate-400",
    },
    {
      label: "إجمالي الإيرادات",
      value: null,
      formatted: formatCurrency(data?.totalRevenue ?? 0),
      icon: CreditCard,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      sub: "من الطلبات المكتملة",
      subColor: "text-slate-400",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">نظرة عامة على المنصة</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            إحصائيات حية لجميع التجار والمتاجر
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{c.label}</span>
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-4 h-4 ${c.color}`} />
              </div>
            </div>

            {isLoading ? (
              <div className="h-7 bg-slate-100 rounded animate-pulse w-3/4" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">
                {c.formatted ?? c.value!.toLocaleString("ar-BH")}
              </p>
            )}

            <div className={`flex items-center gap-1 text-xs ${c.subColor}`}>
              <TrendingUp className="w-3 h-3" />
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Plan breakdown card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">توزيع خطط الاشتراك</h2>
              <p className="text-xs text-slate-400 mt-0.5">عدد المتاجر لكل خطة</p>
            </div>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(["STARTER", "GROWTH", "PRO", "ENTERPRISE"] as const).map((plan) => {
                const found = data?.planCounts.find((p) => p.plan === plan);
                const count = found?.count ?? 0;
                const pct = totalPlanStores > 0 ? (count / totalPlanStores) * 100 : 0;
                return (
                  <div key={plan} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[plan]}`}
                        >
                          {PLAN_LABELS[plan]}
                        </span>
                      </div>
                      <span className="text-slate-600 font-medium">
                        {count.toLocaleString("ar-BH")} متجر
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${PLAN_BAR_COLORS[plan]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">إجراءات سريعة</h2>
            <p className="text-xs text-slate-400 mt-0.5">اختصارات إدارة المنصة</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              {
                href: "/admin/merchants",
                label: "إدارة التجار",
                desc: "تفعيل / تعطيل / منح صلاحيات",
                icon: Users,
                color: "text-indigo-600",
                bg: "bg-indigo-50",
              },
              {
                href: "/admin/stores",
                label: "إدارة المتاجر",
                desc: "تغيير الخطة، تعطيل متجر",
                icon: Store,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition group"
              >
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition" />
              </a>
            ))}
          </div>

          {/* Platform health */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">النظام يعمل بشكل طبيعي</p>
              <p className="text-xs text-emerald-600 opacity-70">جميع الخدمات متاحة</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
