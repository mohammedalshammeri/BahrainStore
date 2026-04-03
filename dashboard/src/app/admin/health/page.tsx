"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Activity, Server, Cpu, AlertTriangle, CheckCircle2,
  RefreshCw, Wifi, WifiOff, Clock, XCircle, Zap,
} from "lucide-react";

interface HealthStats {
  uptime: number;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number; external: number };
  recentActivity: number;
  webhookErrorRate: number;
  pendingTickets: number;
  urgentTickets: number;
}

interface WebhookLog {
  id: string;
  event: string;
  statusCode: number | null;
  response: string | null;
  success: boolean;
  createdAt: string;
  webhook: {
    event: string;
    url: string;
    store: { name: string; subdomain: string } | null;
  } | null;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d} يوم`);
  if (h) parts.push(`${h} ساعة`);
  if (m) parts.push(`${m} دقيقة`);
  return parts.join(" ") || "أقل من دقيقة";
}

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

const STATUS_COLOR = (ok: boolean) => ok
  ? { color: "#34d399", bg: "rgba(16,185,129,.1)" }
  : { color: "#f87171", bg: "rgba(239,68,68,.1)" };

export default function HealthPage() {
  const { data: stats, isLoading, refetch, dataUpdatedAt } = useQuery<HealthStats>({
    queryKey: ["admin-health-stats"],
    queryFn: () => api.get("/admin/health/stats").then((r) => r.data),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: WebhookLog[] }>({
    queryKey: ["admin-health-recent"],
    queryFn: () => api.get("/admin/health/recent-requests").then((r) => r.data),
    refetchInterval: 30000,
  });

  const logs = logsData?.logs ?? [];
  const heapPct = stats
    ? Math.round((stats.memoryUsage.heapUsed / stats.memoryUsage.heapTotal) * 100)
    : 0;
  const errorRateOk = (stats?.webhookErrorRate ?? 0) < 5;
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ar-BH") : "—";

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .row-hover:hover { background: rgba(255,255,255,.03) !important; }
        .pulse-green { animation: pulse-g 2s infinite; }
        @keyframes pulse-g { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>صحة النظام</h1>
            <p className="text-sm mt-1" style={{ color: "#3d5470" }}>
              آخر تحديث: {lastRefresh} — يتجدد تلقائياً كل 30 ثانية
            </p>
          </div>
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>

        {isLoading ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
          </div>
        ) : stats ? (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* Uptime */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>Uptime</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(16,185,129,.1)" }}>
                    <Server className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: "#34d399" }}>
                  {formatUptime(stats.uptime)}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full pulse-green" style={{ background: "#34d399" }} />
                  <span className="text-[10px] font-semibold" style={{ color: "#34d399" }}>السيرفر يعمل</span>
                </div>
              </div>

              {/* Memory */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>الذاكرة (Heap)</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: heapPct > 80 ? "rgba(239,68,68,.1)" : "rgba(59,130,246,.1)" }}>
                    <Cpu className="w-3.5 h-3.5" style={{ color: heapPct > 80 ? "#f87171" : "#60a5fa" }} />
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: heapPct > 80 ? "#f87171" : "#60a5fa" }}>
                  {formatBytes(stats.memoryUsage.heapUsed)}
                </p>
                {/* Bar */}
                <div className="w-full h-1.5 rounded-full" style={{ background: "#0f1a2d" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(heapPct, 100)}%`,
                      background: heapPct > 80 ? "#f87171" : "#60a5fa",
                    }} />
                </div>
                <p className="text-[10px]" style={{ color: "#3d5470" }}>
                  {heapPct}% من {formatBytes(stats.memoryUsage.heapTotal)}
                </p>
              </div>

              {/* RSS Memory */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>RSS Memory</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(167,139,250,.1)" }}>
                    <Activity className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: "#a78bfa" }}>
                  {formatBytes(stats.memoryUsage.rss)}
                </p>
                <p className="text-[10px]" style={{ color: "#3d5470" }}>
                  External: {formatBytes(stats.memoryUsage.external)}
                </p>
              </div>

              {/* Webhook Error Rate */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>معدل أخطاء Webhook</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: STATUS_COLOR(errorRateOk).bg }}>
                    {errorRateOk
                      ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                      : <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#f87171" }} />}
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: STATUS_COLOR(errorRateOk).color }}>
                  {stats.webhookErrorRate.toFixed(1)}%
                </p>
                <p className="text-[10px]" style={{ color: "#3d5470" }}>آخر 24 ساعة</p>
              </div>

              {/* Pending Tickets */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>تذاكر معلقة</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: stats.pendingTickets > 0 ? "rgba(245,158,11,.1)" : "rgba(16,185,129,.1)" }}>
                    <Clock className="w-3.5 h-3.5"
                      style={{ color: stats.pendingTickets > 0 ? "#fbbf24" : "#34d399" }} />
                  </div>
                </div>
                <p className="text-base font-black"
                  style={{ color: stats.pendingTickets > 0 ? "#fbbf24" : "#34d399" }}>
                  {stats.pendingTickets}
                </p>
                {stats.urgentTickets > 0 && (
                  <p className="text-[10px] font-bold" style={{ color: "#f87171" }}>
                    {stats.urgentTickets} عاجلة
                  </p>
                )}
              </div>

              {/* Recent Activity (5 min) */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>نشاط (5 دقائق)</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,.1)" }}>
                    <Zap className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: "#60a5fa" }}>
                  {stats.recentActivity}
                </p>
                <p className="text-[10px]" style={{ color: "#3d5470" }}>webhook call آخر 5 دقائق</p>
              </div>
            </div>

            {/* Status Summary Bar */}
            <div className="rounded-2xl p-4 flex flex-wrap gap-4"
              style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              {[
                { label: "السيرفر",          ok: true,                              icon: Server },
                { label: "قاعدة البيانات",   ok: true,                              icon: Activity },
                { label: "معدل الأخطاء",     ok: errorRateOk,                       icon: Wifi },
                { label: "تذاكر عاجلة",      ok: stats.urgentTickets === 0,         icon: AlertTriangle },
                { label: "الذاكرة",          ok: heapPct < 80,                      icon: Cpu },
              ].map(({ label, ok, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  {ok
                    ? <CheckCircle2 className="w-4 h-4" style={{ color: "#34d399" }} />
                    : <XCircle className="w-4 h-4" style={{ color: "#f87171" }} />}
                  <span className="text-xs font-semibold" style={{ color: ok ? "#4a6480" : "#f87171" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* Recent Webhook Logs */}
        <div>
          <h2 className="text-sm font-black mb-3" style={{ color: "#8aa8c4" }}>
            آخر 100 طلب Webhook
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            {logsLoading ? (
              <div className="py-10 text-center">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center">
                <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "#60a5fa" }} />
                <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد سجلات</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a2840" }}>
                    {["الحالة", "الحدث", "المتجر", "رمز الاستجابة", "الوقت"].map((h) => (
                      <th key={h} className="text-right px-4 py-3 text-[10px] font-black uppercase"
                        style={{ color: "#2d4560" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="row-hover transition"
                      style={{ borderBottom: "1px solid #0f1a2d" }}>
                      <td className="px-4 py-2.5">
                        {log.success
                          ? <CheckCircle2 className="w-4 h-4" style={{ color: "#34d399" }} />
                          : <XCircle className="w-4 h-4" style={{ color: "#f87171" }} />}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-lg"
                          style={{ background: "rgba(59,130,246,.08)", color: "#60a5fa" }}>
                          {log.webhook?.event ?? log.event}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs" style={{ color: "#8aa8c4" }}>
                          {log.webhook?.store?.name ?? "—"}
                        </p>
                        {log.webhook?.url && (
                          <p className="text-[10px] truncate max-w-[160px]" style={{ color: "#2d4560" }}>
                            {log.webhook.url}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{
                            background: log.statusCode && log.statusCode < 300
                              ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
                            color: log.statusCode && log.statusCode < 300 ? "#34d399" : "#f87171",
                          }}>
                          {log.statusCode ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-[10px]" style={{ color: "#3d5470" }}>
                          {formatDate(log.createdAt)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
