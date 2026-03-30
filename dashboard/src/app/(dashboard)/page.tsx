"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, orderStatusBadge, paymentStatusBadge } from "@/components/ui/badge";
import { formatBHD, formatDateTime } from "@/lib/utils";
import type { StoreStats, Order } from "@/types";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  ArrowLeft,
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
} from "recharts";

// Mock revenue chart data (will be replaced by real API)
const mockRevenueData = [
  { day: "السبت",    revenue: 420 },
  { day: "الأحد",    revenue: 380 },
  { day: "الاثنين",  revenue: 610 },
  { day: "الثلاثاء", revenue: 520 },
  { day: "الأربعاء", revenue: 780 },
  { day: "الخميس",   revenue: 890 },
  { day: "الجمعة",   revenue: 650 },
];

export default function DashboardPage() {
  const { store } = useAuthStore();

  const { data: stats, isLoading } = useQuery<StoreStats>({
    queryKey: ["store-stats", store?.id],
    queryFn: async () => {
      const res = await api.get(`/stores/${store!.id}/stats`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 p-8">
        <div className="text-4xl">🏪</div>
        <h2 className="text-xl font-bold text-slate-900">لا يوجد متجر بعد</h2>
        <p className="text-slate-500 text-center">أنشئ متجرك الأول لتبدأ رحلة البيع على بزار</p>
        <Link
          href="/settings/store/new"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          إنشاء متجر جديد
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title={`مرحباً، ${store.name} 👋`}
        subtitle={`آخر تحديث: ${formatDateTime(new Date())}`}
      />

      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="إجمالي الإيرادات"
            value={isLoading ? "..." : formatBHD(stats?.totalRevenue ?? 0)}
            change={stats?.revenueGrowth}
            iconBg="bg-indigo-100"
            icon={<TrendingUp className="h-6 w-6 text-indigo-600" />}
          />
          <StatCard
            title="الطلبات"
            value={isLoading ? "..." : (stats?.totalOrders ?? 0).toLocaleString("ar")}
            change={stats?.ordersGrowth}
            iconBg="bg-amber-100"
            icon={<ShoppingCart className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            title="المنتجات"
            value={isLoading ? "..." : (stats?.totalProducts ?? 0).toLocaleString("ar")}
            iconBg="bg-emerald-100"
            icon={<Package className="h-6 w-6 text-emerald-600" />}
          />
          <StatCard
            title="العملاء"
            value={isLoading ? "..." : (stats?.totalCustomers ?? 0).toLocaleString("ar")}
            iconBg="bg-blue-100"
            icon={<Users className="h-6 w-6 text-blue-600" />}
          />
        </div>

        {/* Revenue Chart + Recent Orders */}
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Chart */}
          <Card className="xl:col-span-2">
            <CardHeader title="الإيرادات - آخر 7 أيام" />
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mockRevenueData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    formatter={(value) => [typeof value === "number" ? formatBHD(value) : String(value), "الإيرادات"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader title="نظرة سريعة" />
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">متوسط قيمة الطلب</span>
                <span className="font-semibold text-slate-900">
                  {isLoading || !stats
                    ? "..."
                    : formatBHD(
                        stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0
                      )}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">الخطة الحالية</span>
                <Badge variant="purple">{store.plan === "FREE" ? "مجاني" : store.plan}</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">العملة</span>
                <span className="font-semibold text-slate-900">{store.currency}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">حالة المتجر</span>
                <Badge variant={store.isActive ? "success" : "error"}>
                  {store.isActive ? "نشط" : "غير نشط"}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader
            title="آخر الطلبات"
            action={
              <Link
                href="/orders"
                className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
              >
                عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-6 py-3 font-medium text-slate-500">رقم الطلب</th>
                  <th className="px-6 py-3 font-medium text-slate-500">العميل</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الإجمالي</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الدفع</th>
                  <th className="px-6 py-3 font-medium text-slate-500">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : !stats?.recentOrders?.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      لا توجد طلبات بعد
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order: Order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3 font-mono font-medium text-indigo-600">
                        <Link href={`/orders/${order.id}`} className="hover:underline">
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-slate-900">{order.customer?.name}</td>
                      <td className="px-6 py-3 font-semibold">{formatBHD(order.total)}</td>
                      <td className="px-6 py-3">{orderStatusBadge(order.status)}</td>
                      <td className="px-6 py-3">{paymentStatusBadge(order.paymentStatus)}</td>
                      <td className="px-6 py-3 text-slate-500">{formatDateTime(order.createdAt)}</td>
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
