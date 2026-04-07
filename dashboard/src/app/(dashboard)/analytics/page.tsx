"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/card";
import { formatBHD } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  Clock,
  RefreshCw,
  Percent,
  Globe,
  ShieldCheck,
  AlertTriangle,
  ArrowUpLeft,
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react";

const SOURCE_COLORS: Record<string, string> = {
  direct: "#6366f1",
  search: "#10b981",
  social: "#f59e0b",
  email: "#3b82f6",
  referral: "#ec4899",
};

interface DashboardAnalytics {
  revenue: number;
  orders: number;
  customers: number;
  products: number;
  customersGrowth?: number;
  avgOrderValue?: number;
  conversionRate?: number;
}

interface RevenueSummary {
  daily: Array<{ date: string; revenue: number; orders: number }>;
}

interface TrafficSummary {
  total: number;
  bySource: Array<{ source: string; label: string; count: number; pct: number }>;
  topPages: Array<{ path: string; count: number }>;
}

interface MerchantHealth {
  score: number;
  status: "excellent" | "healthy" | "attention" | "critical";
  summary: string;
  stage: {
    key: "launch" | "build" | "scale";
    label: string;
    detail: string;
  };
  metrics: {
    revenue: number;
    revenueGrowth: number;
    orders: number;
    cancelRate: number;
    activeProducts: number;
    totalCustomers: number;
    repeatCustomers: number;
    repeatCustomerRate: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    abandonedCarts: number;
    activeCoupons: number;
    trafficCount: number;
    trafficToOrderRate: number;
  };
  dimensions: Array<{ key: string; label: string; score: number }>;
  issues: Array<{ key: string; title: string; severity: "low" | "medium" | "high"; detail: string; action: string }>;
  recommendations: Array<{
    key: string;
    title: string;
    description: string;
    whyNow: string;
    impact: string;
    href: string;
    ctaLabel: string;
    category: "sales" | "conversion" | "retention" | "operations" | "catalog" | "channels";
    priority: "urgent" | "high" | "medium";
  }>;
  playbooks: Array<{
    key: string;
    title: string;
    summary: string;
    outcome: string;
    href: string;
    ctaLabel: string;
    category: "sales" | "conversion" | "retention" | "operations" | "catalog" | "channels";
    priority: "urgent" | "high" | "medium";
    steps: string[];
  }>;
}

const HEALTH_STATUS_STYLE: Record<MerchantHealth["status"], { label: string; badge: string; ring: string }> = {
  excellent: { label: "ممتاز", badge: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200" },
  healthy: { label: "صحي", badge: "bg-blue-100 text-blue-700", ring: "ring-blue-200" },
  attention: { label: "يحتاج متابعة", badge: "bg-amber-100 text-amber-700", ring: "ring-amber-200" },
  critical: { label: "حرج", badge: "bg-rose-100 text-rose-700", ring: "ring-rose-200" },
};

const ISSUE_STYLE: Record<"low" | "medium" | "high", string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

const RECOMMENDATION_STYLE: Record<MerchantHealth["recommendations"][number]["priority"], { label: string; badge: string }> = {
  urgent: { label: "فوري", badge: "bg-rose-100 text-rose-700" },
  high: { label: "مرتفع", badge: "bg-amber-100 text-amber-700" },
  medium: { label: "متوسط", badge: "bg-blue-100 text-blue-700" },
};

const CATEGORY_LABEL: Record<MerchantHealth["recommendations"][number]["category"], string> = {
  sales: "المبيعات",
  conversion: "التحويل",
  retention: "الاستبقاء",
  operations: "التشغيل",
  catalog: "الكتالوج",
  channels: "القنوات",
};

export default function AnalyticsPage() {
  const { store } = useAuthStore();

  const { data: stats, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["analytics-dashboard", store?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/dashboard?storeId=${store!.id}&period=30d`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const { data: revenueData } = useQuery<RevenueSummary>({
    queryKey: ["analytics-revenue", store?.id],
    queryFn: async () => {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const res = await api.get(`/analytics/revenue?storeId=${store!.id}&startDate=${startDate}&endDate=${endDate}`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const { data: trafficData } = useQuery<TrafficSummary>({
    queryKey: ["analytics-traffic", store?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/${store!.id}/traffic`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const { data: merchantHealth } = useQuery<MerchantHealth>({
    queryKey: ["merchant-health", store?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/merchant-health?storeId=${store!.id}`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const last30Days = (revenueData?.daily ?? []).map((day) => ({
    date: new Date(day.date).toLocaleDateString("ar-BH", { month: "short", day: "numeric" }),
    revenue: day.revenue,
    orders: day.orders,
  }));
  const last7Days = last30Days.slice(-7);
  const avgOrderValue = stats?.avgOrderValue
    ? Number(stats.avgOrderValue)
    : stats && stats.orders > 0
    ? Number(stats.revenue) / stats.orders
    : 0;

  return (
    <div className="flex flex-col">
      <Header title="التحليلات" subtitle="نظرة شاملة على أداء متجرك" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="إجمالي الإيرادات"
            value={isLoading ? "..." : formatBHD(Number(stats?.revenue ?? 0))}
            iconBg="bg-indigo-100"
            icon={<TrendingUp className="h-6 w-6 text-indigo-600" />}
          />
          <StatCard
            title="إجمالي الطلبات"
            value={isLoading ? "..." : (stats?.orders ?? 0).toLocaleString("ar")}
            iconBg="bg-amber-100"
            icon={<ShoppingCart className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            title="طلبات آخر يوم"
            value={isLoading ? "..." : (last7Days.at(-1)?.orders ?? 0).toLocaleString("ar")}
            iconBg="bg-blue-100"
            icon={<Clock className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="متوسط قيمة الطلب"
            value={isLoading ? "..." : formatBHD(avgOrderValue)}
            iconBg="bg-emerald-100"
            icon={<DollarSign className="h-6 w-6 text-emerald-600" />}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="معدل التحويل"
            value={isLoading ? "..." : `${(stats?.conversionRate ?? 0).toFixed(1)}%`}
            iconBg="bg-violet-100"
            icon={<Percent className="h-6 w-6 text-violet-600" />}
          />
          <StatCard
            title="العملاء"
            value={isLoading ? "..." : (stats?.customers ?? 0).toLocaleString("ar")}
            iconBg="bg-pink-100"
            icon={<Users className="h-6 w-6 text-pink-600" />}
          />
          <StatCard
            title="نمو العملاء"
            value={isLoading ? "..." : `${(stats?.customersGrowth ?? 0).toFixed(1)}%`}
            iconBg="bg-orange-100"
            icon={<RefreshCw className="h-6 w-6 text-orange-600" />}
          />
          <StatCard
            title="إجمالي الزيارات (30 يوم)"
            value={trafficData ? trafficData.total.toLocaleString("ar") : "..."}
            iconBg="bg-teal-100"
            icon={<Globe className="h-6 w-6 text-teal-600" />}
          />
        </div>

        {merchantHealth && (
          <Card>
            <CardHeader title="صحة المتجر" />
            <CardBody className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-5 ring-1 ${HEALTH_STATUS_STYLE[merchantHealth.status].ring}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-slate-700" />
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${HEALTH_STATUS_STYLE[merchantHealth.status].badge}`}>
                          {HEALTH_STATUS_STYLE[merchantHealth.status].label}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {merchantHealth.stage.label}
                        </span>
                      </div>
                      <p className="mt-3 text-4xl font-bold text-slate-900">{merchantHealth.score}/100</p>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{merchantHealth.summary}</p>
                      <p className="mt-2 max-w-xl text-xs leading-6 text-slate-500">{merchantHealth.stage.detail}</p>
                    </div>
                    <div className="grid min-w-44 gap-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span>نمو الإيرادات</span>
                        <strong>{merchantHealth.metrics.revenueGrowth.toFixed(1)}%</strong>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span>معدل الإلغاء</span>
                        <strong>{merchantHealth.metrics.cancelRate.toFixed(1)}%</strong>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span>السلات المهجورة</span>
                        <strong>{merchantHealth.metrics.abandonedCarts.toLocaleString("ar")}</strong>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span>تحويل الزيارات</span>
                        <strong>{merchantHealth.metrics.trafficToOrderRate.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {merchantHealth.dimensions.map((dimension) => (
                    <div key={dimension.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{dimension.label}</span>
                        <span className="font-semibold text-slate-900">{dimension.score}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${dimension.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">إجمالي العملاء</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{merchantHealth.metrics.totalCustomers.toLocaleString("ar")}</p>
                  <p className="mt-1 text-xs text-slate-500">{merchantHealth.metrics.repeatCustomers.toLocaleString("ar")} منهم عادوا للشراء</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">نسبة العملاء العائدين</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{merchantHealth.metrics.repeatCustomerRate.toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-slate-500">مؤشر مباشر على الاستبقاء وجودة ما بعد الشراء</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">زيارات آخر 30 يوم</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{merchantHealth.metrics.trafficCount.toLocaleString("ar")}</p>
                  <p className="mt-1 text-xs text-slate-500">تُستخدم لتحديد هل المشكلة في الجذب أم في التحويل</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">العروض النشطة</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{merchantHealth.metrics.activeCoupons.toLocaleString("ar")}</p>
                  <p className="mt-1 text-xs text-slate-500">العروض الموجهة أفضل من الخصم العام العشوائي</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                  <Target className="h-4 w-4" />
                  <h3 className="font-semibold">أفضل الخطوات التالية</h3>
                </div>
                {merchantHealth.recommendations.length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد توصيات حرجة حالياً. استمر بالمراقبة الأسبوعية وراجع التحليلات بعد أي حملة أو تغيير كبير.</p>
                ) : (
                  <div className="space-y-3">
                    {merchantHealth.recommendations.map((recommendation) => (
                      <div key={recommendation.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${RECOMMENDATION_STYLE[recommendation.priority].badge}`}>
                                {RECOMMENDATION_STYLE[recommendation.priority].label}
                              </span>
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                {CATEGORY_LABEL[recommendation.category]}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">{recommendation.title}</p>
                            <p className="text-sm leading-6 text-slate-600">{recommendation.description}</p>
                            <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                                <span className="font-semibold text-slate-700">لماذا الآن: </span>
                                {recommendation.whyNow}
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                                <span className="font-semibold text-slate-700">الأثر المتوقع: </span>
                                {recommendation.impact}
                              </div>
                            </div>
                          </div>
                          <Link
                            href={recommendation.href}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                          >
                            {recommendation.ctaLabel}
                            <ArrowUpLeft className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {merchantHealth.playbooks.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-4 flex items-center gap-2 text-slate-900">
                    <Zap className="h-4 w-4" />
                    <h3 className="font-semibold">Playbooks جاهزة للتنفيذ</h3>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {merchantHealth.playbooks.map((playbook) => (
                      <div key={playbook.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${RECOMMENDATION_STYLE[playbook.priority].badge}`}>
                            {RECOMMENDATION_STYLE[playbook.priority].label}
                          </span>
                          <span className="text-xs font-medium text-slate-500">{CATEGORY_LABEL[playbook.category]}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{playbook.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{playbook.summary}</p>
                        <p className="mt-2 text-xs leading-6 text-slate-500">النتيجة: {playbook.outcome}</p>
                        <div className="mt-3 space-y-2">
                          {playbook.steps.map((step, index) => (
                            <div key={`${playbook.key}-${index}`} className="flex items-start gap-2 text-xs leading-6 text-slate-600">
                              <CheckCircle2 className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                        <Link
                          href={playbook.href}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-indigo-700"
                        >
                          {playbook.ctaLabel}
                          <ArrowUpLeft className="h-4 w-4" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <AlertTriangle className="h-4 w-4" />
                    <h3 className="font-semibold">أهم الملاحظات</h3>
                  </div>
                  {merchantHealth.issues.length === 0 ? (
                    <p className="text-sm text-slate-500">لا توجد نقاط تشغيلية حرجة حالياً.</p>
                  ) : (
                    <div className="space-y-3">
                      {merchantHealth.issues.map((issue) => (
                        <div key={issue.key} className="rounded-xl bg-slate-50 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${ISSUE_STYLE[issue.severity]}`}>
                              {issue.severity === "high" ? "مرتفع" : issue.severity === "medium" ? "متوسط" : "منخفض"}
                            </span>
                            <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
                          </div>
                          <p className="text-sm text-slate-600">{issue.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 font-semibold text-slate-900">إجراءات مقترحة الآن</h3>
                  {merchantHealth.issues.length === 0 ? (
                    <p className="text-sm text-slate-500">استمر على نفس الوتيرة وراقب الأداء أسبوعياً.</p>
                  ) : (
                    <div className="space-y-3">
                      {merchantHealth.issues.map((issue) => (
                        <div key={`${issue.key}-action`} className="rounded-xl border border-slate-200 p-3">
                          <p className="text-sm font-medium text-slate-900">{issue.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{issue.action}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="الإيرادات خلال آخر 30 يوماً" />
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
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  formatter={(value) => [typeof value === "number" ? formatBHD(value) : String(value), "الإيرادات"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad30)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="الطلبات خلال آخر 7 أيام" />
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last7Days} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    formatter={(value) => [value, "طلب"]}
                  />
                  <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="مصادر الزيارات خلال آخر 30 يوماً" />
            <CardBody className="space-y-3">
              {!trafficData || trafficData.bySource.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <p className="text-sm">لا توجد بيانات زيارات بعد</p>
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

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader title="الصفحات الأكثر زيارة" />
            <CardBody className="space-y-2">
              {!trafficData || trafficData.topPages.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">لا توجد بيانات بعد</p>
              ) : (
                trafficData.topPages.map((page, index) => (
                  <div key={page.path} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-slate-400 font-mono w-4 flex-shrink-0">{index + 1}</span>
                      <span className="text-xs text-slate-700 truncate font-mono">{page.path}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{page.count.toLocaleString("ar")}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <Package className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoading ? "..." : (stats?.products ?? 0).toLocaleString("ar")}
                  </p>
                  <p className="text-sm text-slate-500">منتج نشط في المتجر</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoading ? "..." : (stats?.customers ?? 0).toLocaleString("ar")}
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
