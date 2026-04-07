"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getAccessToken } from "@/lib/api";
import { getPublicApiUrl } from "@/lib/env";
import {
  TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle,
  Download, RefreshCw, BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MRRData {
  mrr: number;
  arr: number;
  churnRate: number;
  activeStores: number;
  monthly: { month: string; revenue: number }[];
  planDistribution: { plan: string; count: number }[];
  newStoresMonthly: { month: string; count: number }[];
}

interface AdvancedData {
  ltv: number;
  arpu: number;
  growthRate: number;
  mrr: number;
  prevMrr: number;
}

interface CohortData {
  cohorts: { month: string; new: number; retained: number; churned: number }[];
}

interface AtRiskStore {
  storeId: string;
  name: string;
  plan: string;
  planExpiresAt: string | null;
  lastPaidAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  STARTER: "#64748b", GROWTH: "#3b82f6", PRO: "#8b5cf6", ENTERPRISE: "#f59e0b",
};

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

const API_BASE = getPublicApiUrl();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-BH", { year: "numeric", month: "short", day: "numeric" });
}

function planBadge(plan: string) {
  const color = PLAN_COLOR[plan] ?? "#64748b";
  return (
    <span
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
      className="px-2 py-0.5 rounded text-xs font-medium"
    >
      {plan}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, trend, icon: Icon, color,
}: {
  label: string; value: string; sub?: string; trend?: number; icon: React.ElementType; color: string;
}) {
  const up = trend !== undefined ? trend >= 0 : null;
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "#0c1526", border: "1px solid #1a2840" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="p-2 rounded-lg" style={{ background: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(trend).toFixed(1)}% مقارنةً بالشهر الماضي
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancialReportsPage() {
  const now = new Date();
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);

  const { data: mrrData, isLoading: mrrLoading, refetch: refetchMrr } = useQuery<MRRData>({
    queryKey: ["admin", "analytics", "mrr"],
    queryFn: () => api.get("/analytics/mrr").then((r) => r.data),
  });

  const { data: advData, isLoading: advLoading } = useQuery<AdvancedData>({
    queryKey: ["admin", "analytics", "advanced"],
    queryFn: () => api.get("/admin/analytics/advanced").then((r) => r.data),
  });

  const { data: cohortData, isLoading: cohortLoading } = useQuery<CohortData>({
    queryKey: ["admin", "analytics", "cohort"],
    queryFn: () => api.get("/analytics/cohort").then((r) => r.data),
  });

  const { data: atRiskData, isLoading: atRiskLoading } = useQuery<{ stores: AtRiskStore[] }>({
    queryKey: ["admin", "analytics", "at-risk"],
    queryFn: () => api.get("/admin/analytics/at-risk").then((r) => r.data),
  });

  const isLoading = mrrLoading || advLoading || cohortLoading || atRiskLoading;

  function handleExport(path: string) {
    const tkn = getAccessToken();
    if (!tkn) return;
    fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${tkn}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (path.split("/").pop()?.split("?")[0] ?? "export") + ".csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "#060b18", color: "#e2e8f0" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">التقارير المالية</h1>
          <p className="text-slate-400 text-sm mt-1">تحليل الإيرادات والنمو والأداء المالي للمنصة</p>
        </div>
        <button
          onClick={() => refetchMrr()}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
          style={{ background: "#1a2840", color: "#94a3b8" }}
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {/* Row 1 — Main KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="MRR (الإيراد الشهري)"
          value={`${fmt(mrrData?.mrr ?? 0)} BD`}
          icon={DollarSign}
          color="#3b82f6"
          trend={advData?.growthRate}
        />
        <KpiCard
          label="ARR (الإيراد السنوي)"
          value={`${fmt(mrrData?.arr ?? 0)} BD`}
          sub="= MRR × 12"
          icon={TrendingUp}
          color="#8b5cf6"
        />
        <KpiCard
          label="معدل تراجع العملاء"
          value={`${fmt(mrrData?.churnRate ?? 0, 1)}%`}
          sub="Churn Rate (آخر 30 يوم)"
          icon={TrendingDown}
          color="#ef4444"
        />
        <KpiCard
          label="معدل النمو"
          value={`${fmt(advData?.growthRate ?? 0, 1)}%`}
          sub="Growth Rate (شهر على شهر)"
          icon={BarChart2}
          color="#10b981"
          trend={advData?.growthRate}
        />
      </div>

      {/* Row 2 — ARPU + LTV */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label="ARPU — متوسط الإيراد لكل متجر"
          value={`${fmt(advData?.arpu ?? 0)} BD`}
          sub={`عبر ${mrrData?.activeStores ?? 0} متجر نشط`}
          icon={Users}
          color="#f59e0b"
        />
        <KpiCard
          label="LTV — القيمة الدائمة للتاجر"
          value={`${fmt(advData?.ltv ?? 0)} BD`}
          sub="إجمالي الإيراد ÷ عدد التجار"
          icon={DollarSign}
          color="#06b6d4"
        />
      </div>

      {/* Row 3 — MRR Chart */}
      <div className="rounded-xl p-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
        <h2 className="text-base font-semibold text-white mb-4">MRR — آخر 12 شهر</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={mrrData?.monthly ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2840" />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f1c2e", border: "1px solid #1a2840", borderRadius: 8 }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(v) => [`${Number(v ?? 0).toFixed(2)} BD`, "MRR"] as [string, string]}
            />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="MRR" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Row 4 — Plan Distribution + New Stores */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Plan Distribution */}
        <div className="rounded-xl p-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <h2 className="text-base font-semibold text-white mb-4">توزيع الباقات</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={mrrData?.planDistribution ?? []}
                dataKey="count"
                nameKey="plan"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {(mrrData?.planDistribution ?? []).map((entry, i) => (
                  <Cell key={entry.plan} fill={PLAN_COLOR[entry.plan] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f1c2e", border: "1px solid #1a2840", borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* New Stores Monthly */}
        <div className="rounded-xl p-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <h2 className="text-base font-semibold text-white mb-4">المتاجر الجديدة شهرياً</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mrrData?.newStoresMonthly ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2840" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0f1c2e", border: "1px solid #1a2840", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="متجر جديد" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 5 — Cohort Table */}
      <div className="rounded-xl p-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
        <h2 className="text-base font-semibold text-white mb-4">Cohort Analysis — آخر 6 أشهر</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1a2840" }}>
                <th className="text-right py-2 px-3">الشهر</th>
                <th className="text-right py-2 px-3">جديد</th>
                <th className="text-right py-2 px-3">محتفظ</th>
                <th className="text-right py-2 px-3">تراجع</th>
                <th className="text-right py-2 px-3">معدل الاحتفاظ</th>
              </tr>
            </thead>
            <tbody>
              {cohortLoading && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500">جارٍ التحميل...</td></tr>
              )}
              {(cohortData?.cohorts ?? []).map((row) => {
                const retention = row.new > 0 ? ((row.retained / row.new) * 100).toFixed(1) : "—";
                const retNum = row.new > 0 ? (row.retained / row.new) * 100 : 0;
                return (
                  <tr key={row.month} style={{ borderBottom: "1px solid #1a284066" }}>
                    <td className="py-2 px-3 text-white font-medium">{row.month}</td>
                    <td className="py-2 px-3 text-blue-400">{row.new}</td>
                    <td className="py-2 px-3 text-emerald-400">{row.retained}</td>
                    <td className="py-2 px-3 text-red-400">{row.churned}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full" style={{ background: "#1a2840" }}>
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${retNum}%`,
                              background: retNum >= 80 ? "#10b981" : retNum >= 50 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span style={{ color: retNum >= 80 ? "#10b981" : retNum >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {retention}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 6 — At-Risk Stores */}
      <div className="rounded-xl p-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber-400" />
          <h2 className="text-base font-semibold text-white">المتاجر في خطر</h2>
          {atRiskData && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "#f59e0b22", color: "#f59e0b" }}>
              {atRiskData.stores.length} متجر
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1a2840" }}>
                <th className="text-right py-2 px-3">اسم المتجر</th>
                <th className="text-right py-2 px-3">الباقة</th>
                <th className="text-right py-2 px-3">تنتهي في</th>
                <th className="text-right py-2 px-3">آخر دفعة</th>
                <th className="text-right py-2 px-3">المعرّف</th>
              </tr>
            </thead>
            <tbody>
              {atRiskLoading && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500">جارٍ التحميل...</td></tr>
              )}
              {!atRiskLoading && (atRiskData?.stores ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-emerald-400">لا توجد متاجر في خطر حالياً ✓</td></tr>
              )}
              {(atRiskData?.stores ?? []).map((s) => {
                const expires = s.planExpiresAt ? new Date(s.planExpiresAt) : null;
                const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86400000) : null;
                const urgent = daysLeft !== null && daysLeft <= 7;
                return (
                  <tr key={s.storeId} style={{ borderBottom: "1px solid #1a284066" }}>
                    <td className="py-2 px-3 text-white font-medium">{s.name}</td>
                    <td className="py-2 px-3">{planBadge(s.plan)}</td>
                    <td className={`py-2 px-3 ${urgent ? "text-red-400" : "text-amber-400"}`}>
                      {expires ? `${fmtDate(s.planExpiresAt)} (${daysLeft} يوم)` : "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{fmtDate(s.lastPaidAt)}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs font-mono">{s.storeId.slice(0, 8)}…</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 7 — Exports */}
      <div className="rounded-xl p-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
        <h2 className="text-base font-semibold text-white mb-4">تصدير التقارير</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* All Invoices */}
          <button
            onClick={() => handleExport("/admin/export/invoices")}
            className="flex items-center gap-3 p-4 rounded-lg text-right transition-colors"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          >
            <Download size={20} className="text-blue-400 shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">كل الفواتير — CSV</p>
              <p className="text-slate-500 text-xs mt-0.5">جميع الفواتير مع تفاصيل كاملة</p>
            </div>
          </button>

          {/* All Merchants */}
          <button
            onClick={() => handleExport("/admin/export/merchants")}
            className="flex items-center gap-3 p-4 rounded-lg text-right transition-colors"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          >
            <Download size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">بيانات التجار — CSV</p>
              <p className="text-slate-500 text-xs mt-0.5">قائمة كل التجار وعدد متاجرهم</p>
            </div>
          </button>

          {/* Monthly Report */}
          <div
            className="flex items-start gap-3 p-4 rounded-lg"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          >
            <Download size={20} className="text-violet-400 shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-white font-medium text-sm mb-2">التقرير الشهري — CSV</p>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="number"
                  value={exportYear}
                  onChange={(e) => setExportYear(parseInt(e.target.value))}
                  className="w-20 px-2 py-1 rounded text-xs text-white"
                  style={{ background: "#0c1526", border: "1px solid #1a2840" }}
                  min={2020}
                  max={2100}
                />
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 rounded text-xs text-white"
                  style={{ background: "#0c1526", border: "1px solid #1a2840" }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString("ar-BH", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleExport(`/admin/export/financial-report?year=${exportYear}&month=${exportMonth}`)}
                className="w-full py-1.5 px-3 rounded text-xs font-medium"
                style={{ background: "#7c3aed", color: "white" }}
              >
                تصدير
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
