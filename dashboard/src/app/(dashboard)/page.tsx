"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { orderStatusBadge, paymentStatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonStatCard, SkeletonTableRow } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBHD, formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  ArrowLeft,
  Plus,
  Tag,
  Megaphone,
  BarChart2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface DashboardAnalytics {
  revenue: number;
  orders: number;
  customers: number;
  products: number;
  revenueGrowth?: number;
  ordersGrowth?: number;
  avgOrderValue?: number;
  recentOrders?: Order[];
}

interface RevenueSummary {
  daily: Array<{ date: string; revenue: number; orders: number }>;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "مساء الخير";
  return "مساء النور";
}

const quickActions = [
  { label: "منتج جديد", href: "/products/new", icon: Package, color: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100" },
  { label: "كوبون جديد", href: "/coupons", icon: Tag, color: "text-amber-600 bg-amber-50 hover:bg-amber-100" },
  { label: "حملة تسويق", href: "/email-marketing", icon: Megaphone, color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" },
  { label: "التقارير", href: "/analytics", icon: BarChart2, color: "text-blue-600 bg-blue-50 hover:bg-blue-100" },
];

export default function DashboardPage() {
  const { store } = useAuthStore();

  const { data: stats, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["dashboard-analytics", store?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/dashboard?storeId=${store!.id}&period=7d`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const { data: revenueSummary } = useQuery<RevenueSummary>({
    queryKey: ["dashboard-revenue", store?.id],
    queryFn: async () => {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const res = await api.get(`/analytics/revenue?storeId=${store!.id}&startDate=${startDate}&endDate=${endDate}`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl gradient-brand-subtle text-4xl">
            🏪
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">لا يوجد متجر بعد</h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            أنشئ متجرك الأول وابدأ رحلة البيع على منصة بزار البحرينية
          </p>
          <Link href="/settings/store/new">
            <Button size="lg" icon={<Plus />}>إنشاء متجر جديد</Button>
          </Link>
        </div>
      </div>
    );
  }

  const chartData = (revenueSummary?.daily ?? []).map((entry) => ({
    day: new Date(entry.date).toLocaleDateString("ar-BH", { weekday: "short" }),
    revenue: entry.revenue,
    orders: entry.orders,
  }));
  const pendingOrders = stats?.recentOrders?.filter((order) => order.status === "PENDING").length ?? 0;
  const newOrdersToday = revenueSummary?.daily.at(-1)?.orders ?? 0;

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={`${getGreeting()}، ${store.name} 👋`}
        subtitle={`آخر تحديث: ${formatDateTime(new Date())}`}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map(({ label, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-sm font-medium shadow-xs transition-all duration-150 hover:shadow-card hover:-translate-y-0.5 ${color}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {isLoading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              <StatCard
                title="إجمالي الإيرادات"
                value={formatBHD(stats?.revenue ?? 0)}
                rawValue={stats?.revenue}
                change={stats?.revenueGrowth}
                color="indigo"
                icon={<TrendingUp />}
              />
              <StatCard
                title="الطلبات"
                value={(stats?.orders ?? 0).toLocaleString("ar")}
                rawValue={stats?.orders}
                change={stats?.ordersGrowth}
                color="amber"
                icon={<ShoppingCart />}
              />
              <StatCard
                title="المنتجات"
                value={(stats?.products ?? 0).toLocaleString("ar")}
                rawValue={stats?.products}
                color="emerald"
                icon={<Package />}
              />
              <StatCard
                title="العملاء"
                value={(stats?.customers ?? 0).toLocaleString("ar")}
                rawValue={stats?.customers}
                color="blue"
                icon={<Users />}
              />
            </>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="الإيرادات خلال آخر 7 أيام"
              subtitle="بالدينار البحريني"
              action={
                <Link href="/finance" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                  تقرير كامل <ArrowLeft className="h-3 w-3" />
                </Link>
              }
            />
            <CardBody className="pt-2">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", padding: "8px 12px" }}
                    formatter={(value) => [typeof value === "number" ? formatBHD(value) : value, "الإيرادات"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#grad1)"
                    dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="الطلبات اليومية" subtitle="آخر 7 أيام" />
              <CardBody className="pt-1 pb-3">
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.85} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px" }} formatter={(value) => [value, "طلبات"]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-slate-600">طلبات معلّقة</span>
                  </div>
                  <span className="text-sm font-bold text-amber-600">{pendingOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600">طلبات اليوم</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{newOrdersToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm text-slate-600">الخطة الحالية</span>
                  </div>
                  <Badge variant="brand">{store.plan === "FREE" ? "مجاني" : store.plan}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-slate-600">متوسط الطلب</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {stats && stats.orders > 0 ? formatBHD(stats.avgOrderValue ?? (stats.revenue / stats.orders)) : "—"}
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader
            title="آخر الطلبات"
            action={
              <Link href="/orders">
                <Button variant="outline" size="sm" icon={<ArrowLeft />}>عرض الكل</Button>
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">رقم الطلب</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">العميل</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">الإجمالي</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">الدفع</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <>
                    <SkeletonTableRow cols={6} />
                    <SkeletonTableRow cols={6} />
                    <SkeletonTableRow cols={6} />
                    <SkeletonTableRow cols={6} />
                  </>
                ) : !stats?.recentOrders?.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={<ShoppingCart />}
                        title="لا توجد طلبات بعد"
                        description="ستظهر هنا أول طلبات متجرك"
                        size="sm"
                      />
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-6 py-3.5 font-mono text-[13px] font-semibold">
                        <Link href={`/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-slate-800 font-medium">{order.customer?.name ?? "—"}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-900">{formatBHD(order.total)}</td>
                      <td className="px-6 py-3.5">{orderStatusBadge(order.status)}</td>
                      <td className="px-6 py-3.5">{paymentStatusBadge(order.paymentStatus)}</td>
                      <td className="px-6 py-3.5 text-slate-400 text-xs">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

