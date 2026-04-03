"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Key, RefreshCw, ToggleLeft, ToggleRight, Activity,
  ChevronLeft, ChevronRight, Plus, Trash2, Globe,
  TrendingUp, AlertTriangle, CheckCircle2, BookOpen,
  X, Clock, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyStore {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  hasKey: boolean;
  keyMasked: string | null;
  apiKeyEnabled: boolean;
  usageLast30d: number;
}

interface UsageLog {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  ip: string | null;
  userAgent: string | null;
  version: string;
  createdAt: string;
}

interface UsageStats {
  summary: { reqToday: number; reqWeek: number; reqMonth: number };
  topStores: { storeId: string; name: string; subdomain: string; plan: string; requests: number }[];
  endpoints: { endpoint: string; method: string; requests: number; avgDurationMs: number }[];
  errors: { statusCode: number; count: number }[];
}

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  type: string;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  STARTER: "#94a3b8", GROWTH: "#60a5fa", PRO: "#a78bfa", ENTERPRISE: "#fbbf24",
};
const PLAN_AR: Record<string, string> = {
  STARTER: "مجاني", GROWTH: "نمو", PRO: "احترافي", ENTERPRISE: "مؤسسي",
};

const TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  BREAKING:    { bg: "rgba(239,68,68,.15)",   color: "#f87171", label: "تغيير جذري" },
  FEATURE:     { bg: "rgba(99,102,241,.15)",  color: "#818cf8", label: "ميزة جديدة" },
  IMPROVEMENT: { bg: "rgba(16,185,129,.15)",  color: "#34d399", label: "تحسين" },
  FIX:         { bg: "rgba(245,158,11,.15)",  color: "#fbbf24", label: "إصلاح" },
  DEPRECATION: { bg: "rgba(100,116,139,.15)", color: "#94a3b8", label: "ستُزال" },
};

const VERSION_COLOR: Record<string, string> = { v1: "#60a5fa", v2: "#a78bfa", v3: "#f97316" };

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

function StatusBadge({ code }: { code: number }) {
  const ok = code < 300;
  const warn = code >= 400 && code < 500;
  return (
    <span style={{
      background: ok ? "rgba(16,185,129,.15)" : warn ? "rgba(245,158,11,.15)" : "rgba(239,68,68,.15)",
      color: ok ? "#34d399" : warn ? "#fbbf24" : "#f87171",
      padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    }}>
      {code}
    </span>
  );
}

// ─── Tab 1: API Keys ──────────────────────────────────────────────────────────

function ApiKeysTab() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [usageStoreId, setUsageStoreId] = useState<string | null>(null);
  const [usagePage, setUsagePage] = useState(1);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading } = useQuery<{ stores: ApiKeyStore[] }>({
    queryKey: ["admin-api-keys"],
    queryFn: () => api.get("/admin/api-keys").then((r) => r.data),
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<{ logs: UsageLog[]; total: number; page: number; limit: number }>({
    queryKey: ["admin-api-usage-store", usageStoreId, usagePage],
    queryFn: () => api.get(`/admin/api-keys/${usageStoreId}/usage?page=${usagePage}&limit=50`).then((r) => r.data),
    enabled: !!usageStoreId,
  });

  const regenerateMut = useMutation({
    mutationFn: (storeId: string) => api.post(`/admin/api-keys/${storeId}/regenerate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-api-keys"] }); showToast("تم تجديد المفتاح بنجاح"); },
    onError: () => showToast("حدث خطأ أثناء التجديد", "error"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ storeId, enabled }: { storeId: string; enabled: boolean }) =>
      api.patch(`/admin/api-keys/${storeId}/toggle`, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-api-keys"] }); showToast("تم تحديث الحالة"); },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const stores = data?.stores ?? [];
  const usageLogs = usageData?.logs ?? [];
  const usageTotal = usageData?.total ?? 0;
  const usageTotalPages = Math.ceil(usageTotal / 50);
  const selectedStore = stores.find((s) => s.id === usageStoreId);

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "#065f46" : "#7f1d1d",
          color: "#fff", padding: "10px 24px", borderRadius: 10, zIndex: 9999, fontWeight: 600, fontSize: 14,
        }}>
          {toast.msg}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>جاري التحميل...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a2840" }}>
                {["المتجر", "الخطة", "المفتاح", "الحالة", "استخدام 30 يوم", "إجراءات"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontSize: 13, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #1a2840" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, color: "#f1f5f9" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.subdomain}.bazar.bh</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: `${PLAN_COLOR[s.plan]}22`, color: PLAN_COLOR[s.plan], padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {PLAN_AR[s.plan] ?? s.plan}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13 }}>
                    {s.hasKey ? (
                      <code style={{ background: "#0c1526", border: "1px solid #1a2840", padding: "3px 8px", borderRadius: 6, color: "#94a3b8", fontSize: 12 }}>
                        {s.keyMasked}
                      </code>
                    ) : (
                      <span style={{ color: "#475569", fontSize: 12 }}>لا يوجد مفتاح</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      background: s.apiKeyEnabled ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)",
                      color: s.apiKeyEnabled ? "#34d399" : "#f87171",
                      padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    }}>
                      {s.apiKeyEnabled ? "مفعّل" : "معطّل"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Activity size={13} color="#60a5fa" />
                      {s.usageLast30d.toLocaleString("ar")} طلب
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => regenerateMut.mutate(s.id)}
                        disabled={regenerateMut.isPending}
                        style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#94a3b8", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                        title="تجديد المفتاح"
                      >
                        <RefreshCw size={12} /> تجديد
                      </button>
                      <button
                        onClick={() => toggleMut.mutate({ storeId: s.id, enabled: !s.apiKeyEnabled })}
                        disabled={toggleMut.isPending}
                        style={{
                          background: s.apiKeyEnabled ? "rgba(239,68,68,.1)" : "rgba(16,185,129,.1)",
                          border: `1px solid ${s.apiKeyEnabled ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
                          color: s.apiKeyEnabled ? "#f87171" : "#34d399",
                          borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {s.apiKeyEnabled ? <><ToggleRight size={12} /> تعطيل</> : <><ToggleLeft size={12} /> تفعيل</>}
                      </button>
                      <button
                        onClick={() => { setUsageStoreId(s.id); setUsagePage(1); }}
                        style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Activity size={12} /> السجل
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#475569" }}>لا توجد متاجر</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Log Drawer */}
      {usageStoreId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={(e) => { if (e.target === e.currentTarget) setUsageStoreId(null); }}>
          <div style={{
            background: "#0c1526", border: "1px solid #1a2840", borderRadius: 14,
            width: "min(900px, 96vw)", maxHeight: "85vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #1a2840", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 16 }}>سجل API — {selectedStore?.name}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>إجمالي {usageTotal.toLocaleString("ar")} طلب</div>
              </div>
              <button onClick={() => setUsageStoreId(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {usageLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>جاري التحميل...</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1a2840", position: "sticky", top: 0, background: "#0c1526" }}>
                      {["المسار", "الطريقة", "الكود", "المدة", "IP", "الوقت"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontSize: 12, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usageLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: "1px solid #111827" }}>
                        <td style={{ padding: "9px 14px", fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{log.endpoint}</td>
                        <td style={{ padding: "9px 14px" }}>
                          <span style={{ background: "#1e3a5f", color: "#60a5fa", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                            {log.method}
                          </span>
                        </td>
                        <td style={{ padding: "9px 14px" }}><StatusBadge code={log.statusCode} /></td>
                        <td style={{ padding: "9px 14px", fontSize: 12, color: log.duration > 500 ? "#fbbf24" : "#64748b" }}>
                          {log.duration}ms
                        </td>
                        <td style={{ padding: "9px 14px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{log.ip ?? "—"}</td>
                        <td style={{ padding: "9px 14px", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(log.createdAt)}</td>
                      </tr>
                    ))}
                    {usageLogs.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#475569" }}>لا توجد سجلات</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {usageTotalPages > 1 && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid #1a2840", display: "flex", justifyContent: "center", gap: 8 }}>
                <button
                  onClick={() => setUsagePage((p) => Math.max(1, p - 1))}
                  disabled={usagePage === 1}
                  style={{ background: "#1a2840", border: "none", color: "#94a3b8", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}
                >
                  <ChevronRight size={14} />
                </button>
                <span style={{ color: "#64748b", fontSize: 13, alignSelf: "center" }}>
                  {usagePage} / {usageTotalPages}
                </span>
                <button
                  onClick={() => setUsagePage((p) => Math.min(usageTotalPages, p + 1))}
                  disabled={usagePage === usageTotalPages}
                  style={{ background: "#1a2840", border: "none", color: "#94a3b8", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Usage Stats ───────────────────────────────────────────────────────

function UsageStatsTab() {
  const { data, isLoading } = useQuery<UsageStats>({
    queryKey: ["admin-api-usage-stats"],
    queryFn: () => api.get("/admin/api-keys/usage/stats").then((r) => r.data),
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>جاري التحميل...</div>;
  if (!data) return null;

  const totalErrors = (data.errors ?? []).reduce((s, e) => s + e.count, 0);
  const errorRate = data.summary.reqMonth > 0 ? ((totalErrors / data.summary.reqMonth) * 100).toFixed(1) : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {[
          { label: "طلبات اليوم", value: data.summary.reqToday, icon: Zap, color: "#60a5fa" },
          { label: "طلبات الأسبوع", value: data.summary.reqWeek, icon: TrendingUp, color: "#a78bfa" },
          { label: "طلبات الشهر", value: data.summary.reqMonth, icon: Activity, color: "#34d399" },
          { label: "نسبة الأخطاء", value: `${errorRate}%`, icon: AlertTriangle, color: "#f87171" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ background: `${card.color}22`, borderRadius: 8, padding: 8 }}>
                <card.icon size={18} color={card.color} />
              </div>
              <span style={{ color: "#64748b", fontSize: 13 }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9" }}>
              {typeof card.value === "number" ? card.value.toLocaleString("ar") : card.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Top Stores */}
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={16} color="#60a5fa" /> أكثر المتاجر استخداماً (30 يوم)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.topStores.length === 0 && <div style={{ color: "#475569", fontSize: 13 }}>لا توجد بيانات</div>}
            {data.topStores.map((s, i) => (
              <div key={s.storeId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: i < 3 ? "#1e3a5f" : "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: i < 3 ? "#60a5fa" : "#475569", fontWeight: 700 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{s.subdomain}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{s.requests.toLocaleString("ar")}</span>
                  <span style={{ background: `${PLAN_COLOR[s.plan]}22`, color: PLAN_COLOR[s.plan], padding: "1px 6px", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>{PLAN_AR[s.plan] ?? s.plan}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Endpoint Breakdown */}
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} color="#a78bfa" /> تفصيل المسارات (30 يوم)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1a2840" }}>
                  {["المسار", "الطريقة", "الطلبات", "متوسط المدة"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "right", color: "#64748b", fontSize: 11, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.endpoints.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "#475569", fontSize: 12 }}>لا توجد بيانات</td></tr>
                )}
                {data.endpoints.map((ep, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #111827" }}>
                    <td style={{ padding: "7px 10px", fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{ep.endpoint}</td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ background: "#1e3a5f", color: "#60a5fa", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{ep.method}</span>
                    </td>
                    <td style={{ padding: "7px 10px", color: "#f1f5f9", fontWeight: 600, fontSize: 13 }}>{ep.requests.toLocaleString("ar")}</td>
                    <td style={{ padding: "7px 10px", fontSize: 12, color: ep.avgDurationMs > 500 ? "#fbbf24" : "#64748b" }}>{ep.avgDurationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Error Breakdown */}
      {data.errors.length > 0 && (
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} color="#f87171" /> توزيع الأخطاء (30 يوم)
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {data.errors.map((e) => (
              <div key={e.statusCode} style={{ background: e.statusCode >= 500 ? "rgba(239,68,68,.1)" : "rgba(245,158,11,.1)", border: `1px solid ${e.statusCode >= 500 ? "rgba(239,68,68,.3)" : "rgba(245,158,11,.3)"}`, borderRadius: 8, padding: "10px 16px", minWidth: 100, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: e.statusCode >= 500 ? "#f87171" : "#fbbf24" }}>{e.statusCode}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{e.count.toLocaleString("ar")} طلب</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Changelog ─────────────────────────────────────────────────────────

const CHANGELOG_TYPES = ["BREAKING", "FEATURE", "IMPROVEMENT", "FIX", "DEPRECATION"];
const CHANGELOG_VERSIONS = ["v1", "v2"];

function ChangelogTab() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    version: "v1", title: "", description: "", type: "IMPROVEMENT", isPublished: true, publishedAt: "",
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading } = useQuery<{ entries: ChangelogEntry[] }>({
    queryKey: ["admin-api-changelog"],
    queryFn: () => api.get("/admin/api-changelog").then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (payload: typeof form) => api.post("/admin/api-changelog", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-api-changelog"] });
      setShowForm(false);
      setForm({ version: "v1", title: "", description: "", type: "IMPROVEMENT", isPublished: true, publishedAt: "" });
      showToast("تم إضافة الإدخال بنجاح");
    },
    onError: () => showToast("حدث خطأ أثناء الإضافة", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/api-changelog/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-api-changelog"] }); showToast("تم الحذف"); },
    onError: () => showToast("حدث خطأ أثناء الحذف", "error"),
  });

  const entries = data?.entries ?? [];

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "#065f46" : "#7f1d1d",
          color: "#fff", padding: "10px 24px", borderRadius: 10, zIndex: 9999, fontWeight: 600, fontSize: 14,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ color: "#64748b", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Globe size={14} />
          رابط عام: <code style={{ color: "#60a5fa", fontSize: 12 }}>GET /api/public/v1/changelog</code>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13,
          }}
        >
          <Plus size={14} /> إضافة تغيير
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>إضافة إدخال جديد</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>الإصدار</label>
              <select
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                style={{ width: "100%", background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 10px", fontSize: 13 }}
              >
                {CHANGELOG_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>النوع</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                style={{ width: "100%", background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 10px", fontSize: 13 }}
              >
                {CHANGELOG_TYPES.map((t) => <option key={t} value={t}>{TYPE_STYLE[t]?.label ?? t}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>العنوان</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: إضافة حقل discount إلى /products"
                style={{ width: "100%", boxSizing: "border-box", background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 12px", fontSize: 13 }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>الوصف</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="اشرح التغيير وأثره على المطورين..."
                style={{ width: "100%", boxSizing: "border-box", background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 12px", fontSize: 13, resize: "vertical" }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>تاريخ النشر (اختياري)</label>
              <input
                type="date"
                value={form.publishedAt}
                onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                style={{ width: "100%", boxSizing: "border-box", background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 12px", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
              <label style={{ color: "#94a3b8", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                  style={{ accentColor: "#2563eb", width: 16, height: 16 }}
                />
                نشر فوراً
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => createMut.mutate(form)}
              disabled={!form.title || !form.description || createMut.isPending}
              style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 13, opacity: (!form.title || !form.description) ? 0.5 : 1 }}
            >
              {createMut.isPending ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: "#1a2840", color: "#94a3b8", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>جاري التحميل...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "#475569", border: "1px dashed #1a2840", borderRadius: 12 }}>
              لا توجد إدخالات بعد — أضف أول تغيير في API
            </div>
          )}
          {entries.map((e) => {
            const typeStyle = TYPE_STYLE[e.type] ?? { bg: "#1a2840", color: "#94a3b8", label: e.type };
            const vColor = VERSION_COLOR[e.version] ?? "#60a5fa";
            return (
              <div
                key={e.id}
                style={{
                  background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: "16px 20px",
                  display: "flex", gap: 16, alignItems: "flex-start",
                  opacity: e.isPublished ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
                  <span style={{ background: `${vColor}22`, color: vColor, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, display: "block", textAlign: "center" }}>
                    {e.version}
                  </span>
                  <span style={{ background: typeStyle.bg, color: typeStyle.color, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, display: "block", textAlign: "center", whiteSpace: "nowrap" }}>
                    {typeStyle.label}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 15 }}>{e.title}</span>
                    {!e.isPublished && (
                      <span style={{ background: "#1a2840", color: "#64748b", fontSize: 10, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>مسودة</span>
                    )}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>{e.description}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, color: "#475569", fontSize: 11 }}>
                    <Clock size={11} /> {fmtDate(e.publishedAt)}
                  </div>
                </div>
                <button
                  onClick={() => deleteMut.mutate(e.id)}
                  disabled={deleteMut.isPending}
                  style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", borderRadius: 7, padding: "6px 10px", cursor: "pointer" }}
                  title="حذف"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "keys",      label: "مفاتيح API",    icon: Key },
  { id: "stats",     label: "الاستخدام",     icon: Activity },
  { id: "changelog", label: "Changelog",     icon: BookOpen },
];

export default function ApiManagementPage() {
  const [activeTab, setActiveTab] = useState("keys");

  return (
    <div style={{ background: "#060b18", minHeight: "100vh", padding: "28px 32px", fontFamily: "Cairo, sans-serif" }} dir="rtl">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ background: "rgba(37,99,235,.15)", borderRadius: 10, padding: 10 }}>
            <Key size={22} color="#60a5fa" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>إدارة API</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>مفاتيح API، سجلات الاستخدام، وإصدارات Changelog</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#0c1526", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid #1a2840" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 20px", border: "none", borderRadius: 7, cursor: "pointer",
              fontWeight: 600, fontSize: 13, fontFamily: "Cairo, sans-serif",
              display: "flex", alignItems: "center", gap: 6,
              background: activeTab === tab.id ? "#2563eb" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#64748b",
              transition: "all 0.15s",
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 14, padding: 24 }}>
        {activeTab === "keys"      && <ApiKeysTab />}
        {activeTab === "stats"     && <UsageStatsTab />}
        {activeTab === "changelog" && <ChangelogTab />}
      </div>
    </div>
  );
}
