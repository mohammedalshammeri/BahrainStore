"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBHD } from "@/lib/utils";
import {
  Users, Store, ShoppingCart, DollarSign,
  TrendingUp, Package, UserPlus, Globe,
} from "lucide-react";

interface PlatformStats {
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
  STARTER: "bg-slate-100 text-slate-700",
  GROWTH: "bg-blue-100 text-blue-700",
  PRO: "bg-indigo-100 text-indigo-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

function KpiCard({ title, value, icon, bg }: { title: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
        <p className="text-sm text-slate-500">{title}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const { data: stats, isLoading } = useQuery<PlatformStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await api.get("/admin/stats");
      return res.data;
    },
  });

  const v = (n?: number) => (isLoading ? "..." : (n ?? 0).toLocaleString("ar"));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">إحصائيات المنصة</h1>
        <p className="text-sm text-slate-500 mt-0.5">نظرة شاملة على جميع التجار والمتاجر</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          title="إجمالي الإيرادات"
          value={isLoading ? "..." : formatBHD(stats?.totalRevenue ?? 0)}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-100"
        />
        <KpiCard
          title="التجار المسجلون"
          value={v(stats?.totalMerchants)}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-100"
        />
        <KpiCard
          title="المتاجر المنشأة"
          value={v(stats?.totalStores)}
          icon={<Store className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-100"
        />
        <KpiCard
          title="إجمالي الطلبات"
          value={v(stats?.totalOrders)}
          icon={<ShoppingCart className="w-5 h-5 text-amber-600" />}
          bg="bg-amber-100"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <KpiCard
          title="تجار جدد هذا الأسبوع"
          value={isLoading ? "..." : `+${stats?.newMerchantsThisWeek ?? 0}`}
          icon={<UserPlus className="w-5 h-5 text-violet-600" />}
          bg="bg-violet-100"
        />
        <KpiCard
          title="متاجر جديدة هذا الشهر"
          value={isLoading ? "..." : `+${stats?.newStoresThisMonth ?? 0}`}
          icon={<TrendingUp className="w-5 h-5 text-pink-600" />}
          bg="bg-pink-100"
        />
        <KpiCard
          title="إجمالي العملاء (كل المتاجر)"
          value={v(stats?.totalCustomers)}
          icon={<Globe className="w-5 h-5 text-teal-600" />}
          bg="bg-teal-100"
        />
      </div>

      {/* Plan distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-400" />
          توزيع خطط الاشتراك
        </h2>
        <div className="flex flex-wrap gap-3">
          {stats?.planCounts.map(({ plan, count }) => (
            <div
              key={plan}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${PLAN_COLORS[plan] ?? "bg-slate-100 text-slate-700"}`}
            >
              {PLAN_LABELS[plan] ?? plan}
              <span className="font-bold text-lg leading-none">{count}</span>
              <span className="text-xs opacity-60">متجر</span>
            </div>
          ))}
          {isLoading && <p className="text-sm text-slate-400">جارٍ التحميل...</p>}
          {!isLoading && !stats?.planCounts.length && (
            <p className="text-sm text-slate-400">لا توجد بيانات بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}
