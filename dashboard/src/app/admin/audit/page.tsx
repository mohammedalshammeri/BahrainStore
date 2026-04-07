"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getPublicApiUrl } from "@/lib/env";
import { ClipboardList, Download, Filter, X, RefreshCw, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  actorId: string;
  actorType: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Action color map ─────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, [string, string]> = {
  CREATE_ROLE:       ["rgba(52,211,153,.12)", "#34d399"],
  UPDATE_ROLE:       ["rgba(59,130,246,.12)", "#60a5fa"],
  DELETE_ROLE:       ["rgba(239,68,68,.12)",  "#f87171"],
  INVITE_STAFF:      ["rgba(167,139,250,.12)","#a78bfa"],
  UPDATE_STAFF_ROLE: ["rgba(59,130,246,.12)", "#60a5fa"],
  UPDATE_STAFF:      ["rgba(59,130,246,.12)", "#60a5fa"],
  DISABLE_STAFF:     ["rgba(245,158,11,.12)", "#fbbf24"],
  DELETE_STAFF:      ["rgba(239,68,68,.12)",  "#f87171"],
  DISABLE_STORE:     ["rgba(239,68,68,.12)",  "#f87171"],
  UPDATE_PLAN:       ["rgba(245,158,11,.12)", "#fbbf24"],
  DELETE_APP:        ["rgba(239,68,68,.12)",  "#f87171"],
};

function actionColor(action: string): [string, string] {
  return ACTION_COLORS[action] ?? ["rgba(99,102,241,.12)", "#818cf8"];
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    CREATE_ROLE: "إنشاء دور",
    UPDATE_ROLE: "تعديل دور",
    DELETE_ROLE: "حذف دور",
    INVITE_STAFF: "دعوة موظف",
    UPDATE_STAFF_ROLE: "تغيير دور موظف",
    UPDATE_STAFF: "تعديل موظف",
    DISABLE_STAFF: "إيقاف موظف",
    DELETE_STAFF: "حذف موظف",
    DISABLE_STORE: "تعطيل متجر",
    UPDATE_PLAN: "تعديل باقة",
    DELETE_APP: "حذف تطبيق",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

const ACTOR_COLORS: Record<string, [string, string]> = {
  ADMIN: ["rgba(239,68,68,.12)", "#f87171"],
  STAFF: ["rgba(59,130,246,.12)", "#60a5fa"],
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  action: string;
  actorId: string;
  entityType: string;
  from: string;
  to: string;
}

const ENTITY_TYPES = ["ROLE", "STAFF", "STORE", "MERCHANT", "APP", "THEME", "TICKET", "PLAN"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ action: "", actorId: "", entityType: "", from: "", to: "" });
  const [showFilters, setShowFilters] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (filters.action) params.set("action", filters.action);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const queryKey = ["admin-audit", page, filters];

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey,
    queryFn: () => api.get(`/admin/audit?${params.toString()}`).then(r => r.data),
  });

  const { data: statsData } = useQuery<{ total: number; todayCount: number; topActions: { action: string; count: number }[] }>({
    queryKey: ["admin-audit-stats"],
    queryFn: () => api.get("/admin/audit/stats").then(r => r.data),
  });

  const { data: actionsData } = useQuery<{ actions: string[] }>({
    queryKey: ["admin-audit-actions"],
    queryFn: () => api.get("/admin/audit/actions").then(r => r.data),
  });

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const availableActions = actionsData?.actions ?? [];

  function resetFilters() {
    setFilters({ action: "", actorId: "", entityType: "", from: "", to: "" });
    setPage(1);
  }

  const hasFilters = Object.values(filters).some(v => v !== "");

  function exportCSV() {
    const exportParams = new URLSearchParams(params);
    exportParams.delete("page");
    exportParams.delete("limit");
    window.open(`${getPublicApiUrl()}/admin/audit/export?${exportParams.toString()}`, "_blank");
  }

  return (
    <div className="p-6 min-h-screen" style={{ background: "#060b18" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.25)" }}>
            <ClipboardList className="w-5 h-5" style={{ color: "#f87171" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#dce8f5" }}>سجل العمليات</h1>
            <p className="text-xs" style={{ color: "#4a6480" }}>تتبع جميع العمليات على المنصة بالتفصيل</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl"
            style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#94a3b8" }}
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
          <button
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: showFilters ? "#3b82f6" : "#0c1526", border: "1px solid #1a2840", color: showFilters ? "#fff" : "#94a3b8" }}
          >
            <Filter className="w-4 h-4" />
            فلترة
            {hasFilters && <span className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />}
          </button>
        </div>
      </div>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>إجمالي السجلات</p>
            <p className="text-2xl font-black" style={{ color: "#dce8f5" }}>{statsData.total.toLocaleString("ar")}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>اليوم</p>
            <p className="text-2xl font-black" style={{ color: "#60a5fa" }}>{statsData.todayCount.toLocaleString("ar")}</p>
          </div>
          {statsData.topActions.slice(0, 2).map((a) => {
            const [bg, fg] = actionColor(a.action);
            return (
              <div key={a.action} className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>{actionLabel(a.action)}</p>
                <p className="text-2xl font-black" style={{ color: fg }}>{a.count.toLocaleString("ar")}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      {showFilters && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>نوع العملية</label>
              <select
                value={filters.action}
                onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
              >
                <option value="">الكل</option>
                {availableActions.map(a => (
                  <option key={a} value={a}>{actionLabel(a)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>نوع العنصر</label>
              <select
                value={filters.entityType}
                onChange={e => { setFilters(f => ({ ...f, entityType: e.target.value })); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
              >
                <option value="">الكل</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>معرف المنفذ</label>
              <input
                value={filters.actorId}
                onChange={e => { setFilters(f => ({ ...f, actorId: e.target.value })); setPage(1); }}
                placeholder="actorId..."
                className="w-full px-3 py-2 rounded-xl text-xs font-mono"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>من تاريخ</label>
              <input
                type="date"
                value={filters.from}
                onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>إلى تاريخ</label>
              <input
                type="date"
                value={filters.to}
                onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
              />
            </div>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-3 flex items-center gap-1.5 text-xs"
              style={{ color: "#f87171" }}>
              <X className="w-3.5 h-3.5" /> مسح الفلاتر
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-20" style={{ color: "#4a6480" }}>جارٍ التحميل...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList className="w-10 h-10 mx-auto mb-3" style={{ color: "#1a2840" }} />
          <p className="text-sm" style={{ color: "#4a6480" }}>لا توجد سجلات</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid #1a2840" }}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: "#0c1526" }}>
                  {["المنفذ", "العملية", "العنصر", "IP", "التاريخ والوقت"].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#4a6480", borderBottom: "1px solid #1a2840" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const [abg, afg] = actionColor(log.action);
                  const [tbg, tfg] = ACTOR_COLORS[log.actorType] ?? ["rgba(99,102,241,.12)", "#818cf8"];
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #0f1823" }} className="hover:bg-[#0d1929]">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-xs" style={{ color: "#dce8f5" }}>{log.actorName || "—"}</p>
                          <p className="text-xs" style={{ color: "#4a6480" }}>{log.actorEmail}</p>
                          <span className="mt-0.5 inline-block text-xs px-1.5 py-0.5 rounded-md"
                            style={{ background: tbg, color: tfg }}>
                            {log.actorType}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: abg, color: afg }}>
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.entityType ? (
                          <div>
                            <span className="text-xs font-mono" style={{ color: "#4a6480" }}>{log.entityType}</span>
                            {log.entityName && (
                              <p className="text-xs" style={{ color: "#94a3b8" }}>{log.entityName}</p>
                            )}
                          </div>
                        ) : <span style={{ color: "#1a2840" }}>—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "#4a6480" }}>
                        {log.ip ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#4a6480" }}>
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#4a6480" }}>
              {total.toLocaleString("ar")} سجل — صفحة {page} من {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: page <= 1 ? "#1a2840" : "#94a3b8" }}
              >
                السابق
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: page >= totalPages ? "#1a2840" : "#94a3b8" }}
              >
                التالي
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
