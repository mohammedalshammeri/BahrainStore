"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/card";
import { formatBHD } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, ShoppingCart, Package, Users,
  DollarSign, Clock, CheckCircle, XCircle, RefreshCw, Percent, Globe,
} from "lucide-react";

const SOURCE_COLORS: Record<string, string> = {
  direct: "#6366f1",
  search: "#10b981",
  social: "#f59e0b",
  email: "#3b82f6",
  referral: "#ec4899",
};

export default function AnalyticsPage() {
  const { store } = useAuthStore();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["store-stats", store?.id],
    queryFn: async () => {
      const res = await api.get(`/stores/${store!.id}/stats`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const { data: trafficData } = useQuery({
    queryKey: ["traffic", store?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/${store!.id}/traffic`);
      return res.data as {
        total: number;
        bySource: { source: string; label: string; count: number; pct: number }[];
        topPages: { path: string; count: number }[];
        days: number;
      };
    },
    enabled: !!store?.id,
  });

  const stats = statsData?.stats;

  const avgOrderValue = stats?.avgOrderValue
    ? Number(stats.avgOrderValue)
    : stats && stats.totalOrders > 0
    ? Number(stats.totalRevenue) / stats.totalOrders
    : 0;

  // Build last-30-days chart from recentOrders (fallback: empty)
  const last30Days = (() => {
    const days: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toLocaleDateString("ar-BH", { month: "short", day: "numeric" }),
        revenue: 0,
        orders: 0,
      });
    }
    (stats?.recentOrders ?? []).forEach((order: { createdAt: string; total: number }) => {
      const d = new Date(order.createdAt);
      const label = d.toLocaleDateString("ar-BH", { month: "short", day: "numeric" });
      const found = days.find((day) => day.date === label);
      if (found) {
        found.revenue += Number(order.total);
        found.orders += 1;
      }
    });
    return days;
  })();

  const last7Days = last30Days.slice(-7);

  return (
    <div className="flex flex-col">
      <Header title="ط§ظ„طھط­ظ„ظٹظ„ط§طھ" subtitle="ظ†ط¸ط±ط© ط´ط§ظ…ظ„ط© ط¹ظ„ظ‰ ط£ط¯ط§ط، ظ…طھط¬ط±ظƒ" />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ"
            value={isLoading ? "..." : formatBHD(Number(stats?.totalRevenue ?? 0))}
            iconBg="bg-indigo-100"
            icon={<TrendingUp className="h-6 w-6 text-indigo-600" />}
          />
          <StatCard
            title="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط·ظ„ط¨ط§طھ"
            value={isLoading ? "..." : (stats?.totalOrders ?? 0).toLocaleString("ar")}
            iconBg="bg-amber-100"
            icon={<ShoppingCart className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            title="ط·ظ„ط¨ط§طھ ط§ظ„ظٹظˆظ…"
            value={isLoading ? "..." : (stats?.todayOrders ?? 0).toLocaleString("ar")}
            iconBg="bg-blue-100"
            icon={<Clock className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="ظ…طھظˆط³ط· ظ‚ظٹظ…ط© ط§ظ„ط·ظ„ط¨"
            value={isLoading ? "..." : formatBHD(avgOrderValue)}
            iconBg="bg-emerald-100"
            icon={<DollarSign className="h-6 w-6 text-emerald-600" />}
          />
        </div>

        {/* Second KPI row â€” conversion + repeat customers */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="ظ…ط¹ط¯ظ„ ط§ظ„طھط­ظˆظٹظ„"
            value={isLoading ? "..." : `${(stats?.conversionRate ?? 0).toFixed(1)}%`}
            iconBg="bg-violet-100"
            icon={<Percent className="h-6 w-6 text-violet-600" />}
          />
          <StatCard
            title="ط§ظ„ط¹ظ…ظ„ط§ط، ط§ظ„ظ…طھظƒط±ط±ظˆظ†"
            value={isLoading ? "..." : (stats?.repeatCustomers ?? 0).toLocaleString("ar")}
            iconBg="bg-pink-100"
            icon={<RefreshCw className="h-6 w-6 text-pink-600" />}
          />
          <StatCard
            title="ظ†ط³ط¨ط© ط§ظ„طھظƒط±ط§ط±"
            value={isLoading ? "..." : `${(stats?.repeatRate ?? 0).toFixed(1)}%`}
            iconBg="bg-orange-100"
            icon={<Users className="h-6 w-6 text-orange-600" />}
          />
          <StatCard
            title="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط²ظٹط§ط±ط§طھ (30 ظٹظˆظ…)"
            value={trafficData ? trafficData.total.toLocaleString("ar") : "..."}
            iconBg="bg-teal-100"
            icon={<Globe className="h-6 w-6 text-teal-600" />}
          />
        </div>

        {/* Revenue Chart (30 days) */}
        <Card>
          <CardHeader title="ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ â€” ط¢ط®ط± 30 ظٹظˆظ…ط§ظ‹" />
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={last30Days}>
                <defs>
                  <linearGradient id="revGrad30" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  formatter={(value) => [typeof value === "number" ? formatBHD(value) : String(value), "ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#revGrad30)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Orders + Traffic Sources */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Orders bar chart (7 days) */}
          <Card>
            <CardHeader title="ط§ظ„ط·ظ„ط¨ط§طھ â€” ط¢ط®ط± 7 ط£ظٹط§ظ…" />
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last7Days} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    formatter={(value) => [value, "ط·ظ„ط¨"]}
                  />
                  <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Traffic Sources */}
          <Card>
            <CardHeader title="ظ…طµط§ط¯ط± ط§ظ„ط²ظٹط§ط±ط§طھ (ط¢ط®ط± 30 ظٹظˆظ…)" />
            <CardBody className="space-y-3">
              {!trafficData || trafficData.bySource.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <p className="text-sm">ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ط²ظٹط§ط±ط§طھ ط¨ط¹ط¯</p>
                </div>
              ) : (
                trafficData.bySource.map((item) => (
                  <div key={item.source} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-medium">{item.label}</span>
                      <span className="text-slate-500">{item.count.toLocaleString("ar")} ({item.pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: SOURCE_COLORS[item.source] ?? "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Top Pages + Products/Customers */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top pages */}
          <Card>
            <CardHeader title="الصفحات الأكثر زيارة" />
            <CardBody className="space-y-2">
              {!trafficData || trafficData.topPages.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">لا توجد بيانات بعد</p>
              ) : (
                trafficData.topPages.map((p, i) => (
                  <div key={p.path} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-slate-400 font-mono w-4 flex-shrink-0">{i + 1}</span>
                      <span className="text-xs text-slate-700 truncate font-mono">{p.path}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{p.count.toLocaleString("ar")}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Products summary */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <Package className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoading ? "..." : (stats?.totalProducts ?? 0).toLocaleString("ar")}
                  </p>
                  <p className="text-sm text-slate-500">منتج نشط في المتجر</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Customers summary */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoading ? "..." : (stats?.totalCustomers ?? 0).toLocaleString("ar")}
                  </p>
                  <p className="text-sm text-slate-500">إجمالي العملاء المسجلين</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
