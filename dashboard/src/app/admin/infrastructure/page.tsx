"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Zap, Wrench, Gauge, Server, Plus, Trash2, Save,
  RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  ToggleLeft, ToggleRight, Layers, PackageX, Trash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enabledForPlans: string[];
  betaMerchantIds: string[];
  createdAt: string;
}

interface MaintenanceWindow {
  id: string;
  title: string;
  message: string;
  isActive: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  notifyMerchants: boolean;
  createdBy: string | null;
  createdAt: string;
}

interface RateLimitConfig {
  id: string;
  plan: string;
  reqPerMinute: number;
  reqPerDay: number;
  burstLimit: number;
}

interface QueueStats {
  jobs: { pending: number; running: number; done: number; failed: number };
  recentErrors: { id: string; level: string; message: string; path: string | null; storeId: string | null; createdAt: string }[];
}

interface JobItem {
  id: string;
  source: string;
  status: string;
  totalItems: number;
  imported: number;
  failed: number;
  createdAt: string;
  store: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SURFACE = { background: "#0c1526", border: "1px solid #1a2840" };
const PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"];
const PLAN_COLOR: Record<string, string> = {
  STARTER: "#64748b", GROWTH: "#3b82f6", PRO: "#8b5cf6", ENTERPRISE: "#f59e0b",
};
const JOB_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,.12)", label: "معلّق" },
  RUNNING: { color: "#3b82f6", bg: "rgba(59,130,246,.12)", label: "قيد التشغيل" },
  DONE:    { color: "#10b981", bg: "rgba(16,185,129,.12)", label: "مكتمل" },
  FAILED:  { color: "#ef4444", bg: "rgba(239,68,68,.12)", label: "فشل" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-BH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Tab: Feature Flags ───────────────────────────────────────────────────────

function FeatureFlagsTab() {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState({ key: "", name: "", description: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlans, setEditPlans] = useState<string[]>([]);
  const [editBeta, setEditBeta] = useState("");

  const { data, isLoading, refetch } = useQuery<{ flags: FeatureFlag[] }>({
    queryKey: ["admin", "feature-flags"],
    queryFn: () => api.get("/admin/feature-flags").then((r) => r.data),
  });

  const addMut = useMutation({
    mutationFn: (body: typeof addForm) => api.post("/admin/feature-flags", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] }); setAddForm({ key: "", name: "", description: "" }); },
  });

  const patchMut = useMutation({
    mutationFn: (vars: { id: string; data: Partial<FeatureFlag> }) => api.patch(`/admin/feature-flags/${vars.id}`, vars.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] }); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/feature-flags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] }),
  });

  return (
    <div className="space-y-4">
      {/* Add Form */}
      <div className="rounded-xl p-4" style={SURFACE}>
        <h3 className="text-white font-medium text-sm mb-3">إضافة ميزة جديدة</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            placeholder="المفتاح (مثال: live_chat)"
            value={addForm.key}
            onChange={(e) => setAddForm({ ...addForm, key: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm text-white w-40"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <input
            placeholder="الاسم (عربي أو إنجليزي)"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <input
            placeholder="الوصف (اختياري)"
            value={addForm.description}
            onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <button
            onClick={() => addMut.mutate(addForm)}
            disabled={!addForm.key || !addForm.name || addMut.isPending}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "#3b82f6" }}
          >
            <Plus size={14} />
            إضافة
          </button>
        </div>
      </div>

      {/* Flags Table */}
      <div className="space-y-3">
        {isLoading && <p className="text-slate-500 text-sm py-4">جارٍ التحميل...</p>}
        {(data?.flags ?? []).map((flag) => (
          <div key={flag.id} className="rounded-xl p-4" style={SURFACE}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-blue-400 text-xs font-mono bg-blue-400/10 px-1.5 py-0.5 rounded">{flag.key}</code>
                  <span className="text-white font-medium text-sm">{flag.name}</span>
                  {flag.description && <span className="text-slate-500 text-xs">{flag.description}</span>}
                </div>

                {/* Plan restriction badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {flag.enabledForPlans.length === 0
                    ? <span className="text-xs text-emerald-400">كل الباقات</span>
                    : flag.enabledForPlans.map((p) => (
                        <span key={p} className="text-xs px-1.5 py-0.5 rounded" style={{ color: PLAN_COLOR[p] ?? "#64748b", background: `${PLAN_COLOR[p] ?? "#64748b"}22` }}>
                          {p}
                        </span>
                      ))
                  }
                  {flag.betaMerchantIds.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "#a78bfa", background: "rgba(167,139,250,.12)" }}>
                      Beta: {flag.betaMerchantIds.length} تاجر
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle enable/disable */}
                <button onClick={() => patchMut.mutate({ id: flag.id, data: { isEnabled: !flag.isEnabled } })}>
                  {flag.isEnabled
                    ? <ToggleRight size={28} className="text-emerald-400" />
                    : <ToggleLeft size={28} className="text-slate-600" />
                  }
                </button>
                {/* Edit plans */}
                <button
                  onClick={() => { setEditId(editId === flag.id ? null : flag.id); setEditPlans(flag.enabledForPlans); setEditBeta(flag.betaMerchantIds.join(",")); }}
                  className="p-1.5 rounded text-slate-400"
                  style={{ background: "#131e30" }}
                >
                  <Gauge size={14} />
                </button>
                <button
                  onClick={() => { if (confirm("حذف هذه الميزة؟")) deleteMut.mutate(flag.id); }}
                  className="p-1.5 rounded text-red-400"
                  style={{ background: "rgba(239,68,68,.1)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Inline plan/beta editor */}
            {editId === flag.id && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1a2840" }}>
                <p className="text-xs text-slate-400 mb-2">تفعيل لباقات محددة (اتركه فارغاً = كل الباقات):</p>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {PLANS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPlans(editPlans.includes(p) ? editPlans.filter((x) => x !== p) : [...editPlans, p])}
                      className="px-3 py-1 rounded text-xs font-medium"
                      style={
                        editPlans.includes(p)
                          ? { background: `${PLAN_COLOR[p]}33`, color: PLAN_COLOR[p], border: `1px solid ${PLAN_COLOR[p]}66` }
                          : { background: "#131e30", color: "#64748b", border: "1px solid #1a2840" }
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-2">Beta — معرّفات التجار (مفصولة بفاصلة):</p>
                <div className="flex gap-2">
                  <input
                    value={editBeta}
                    onChange={(e) => setEditBeta(e.target.value)}
                    placeholder="merchantId1,merchantId2"
                    className="flex-1 px-3 py-1.5 rounded text-xs text-white font-mono"
                    style={{ background: "#131e30", border: "1px solid #1a2840" }}
                  />
                  <button
                    onClick={() => patchMut.mutate({
                      id: flag.id,
                      data: {
                        enabledForPlans: editPlans,
                        betaMerchantIds: editBeta ? editBeta.split(",").map((x) => x.trim()).filter(Boolean) : [],
                      },
                    })}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-white"
                    style={{ background: "#059669" }}
                  >
                    <Save size={12} />
                    حفظ
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!isLoading && (data?.flags ?? []).length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">لا توجد Feature Flags بعد</div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => refetch()} className="p-1.5 rounded text-slate-500" style={{ background: "#0c1526" }}>
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Maintenance ─────────────────────────────────────────────────────────

function MaintenanceTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", message: "", scheduledStart: "", scheduledEnd: "", notifyMerchants: true });
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<{ windows: MaintenanceWindow[]; active: MaintenanceWindow | null }>({
    queryKey: ["admin", "maintenance"],
    queryFn: () => api.get("/admin/maintenance").then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/admin/maintenance", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "maintenance"] }); setShowForm(false); setForm({ title: "", message: "", scheduledStart: "", scheduledEnd: "", notifyMerchants: true }); },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/maintenance/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "maintenance"] }),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/maintenance/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "maintenance"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/maintenance/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "maintenance"] }),
  });

  const active = data?.active;

  return (
    <div className="space-y-4">
      {/* Active Banner */}
      {active && (
        <div className="rounded-xl p-4 flex items-start justify-between gap-3" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)" }}>
          <div className="flex items-start gap-2">
            <Wrench size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-300 font-semibold">{active.title}</p>
              <p className="text-red-400/80 text-sm mt-0.5">{active.message}</p>
            </div>
          </div>
          <button
            onClick={() => deactivateMut.mutate(active.id)}
            className="shrink-0 px-3 py-1.5 rounded text-xs font-medium text-white"
            style={{ background: "#dc2626" }}
          >
            إنهاء الصيانة
          </button>
        </div>
      )}
      {!active && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.2)" }}>
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span className="text-emerald-400 text-sm">المنصة تعمل بشكل طبيعي — لا توجد صيانة نشطة</span>
        </div>
      )}

      {/* Create Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium text-sm">سجل نوافذ الصيانة</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ background: "#3b82f6" }}
        >
          <Plus size={13} />
          جدولة صيانة
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={SURFACE}>
          <input
            placeholder="عنوان الصيانة"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <textarea
            placeholder="رسالة للتجار"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm text-white resize-none"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">وقت البداية</label>
              <input
                type="datetime-local"
                value={form.scheduledStart}
                onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840", colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">وقت الانتهاء</label>
              <input
                type="datetime-local"
                value={form.scheduledEnd}
                onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840", colorScheme: "dark" }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setForm({ ...form, notifyMerchants: !form.notifyMerchants })}>
              {form.notifyMerchants
                ? <ToggleRight size={22} className="text-emerald-400" />
                : <ToggleLeft size={22} className="text-slate-500" />
              }
            </button>
            <span className="text-sm text-slate-300">إشعار التجار بالصيانة</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.title || !form.message || createMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#3b82f6" }}
            >
              <Save size={13} />
              {createMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400" style={{ background: "#131e30" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Windows List */}
      <div className="space-y-2">
        {isLoading && <p className="text-slate-500 text-sm">جارٍ التحميل...</p>}
        {(data?.windows ?? []).map((w) => (
          <div key={w.id} className="rounded-xl p-4" style={{ background: "#0c1526", border: w.isActive ? "1px solid rgba(239,68,68,.4)" : "1px solid #1a2840" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {w.isActive && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
                  <span className="text-white font-medium text-sm">{w.title}</span>
                  {w.isActive && <span className="text-xs px-1.5 py-0.5 rounded text-red-300" style={{ background: "rgba(239,68,68,.15)" }}>نشط</span>}
                </div>
                <p className="text-slate-400 text-xs mt-1">{w.message}</p>
                <p className="text-slate-500 text-xs mt-1">
                  {w.scheduledStart ? `${fmtDate(w.scheduledStart)} — ${fmtDate(w.scheduledEnd)}` : fmtDate(w.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!w.isActive && (
                  <button
                    onClick={() => activateMut.mutate(w.id)}
                    className="px-3 py-1 rounded text-xs text-white"
                    style={{ background: "#dc2626" }}
                  >
                    تفعيل
                  </button>
                )}
                {w.isActive && (
                  <button
                    onClick={() => deactivateMut.mutate(w.id)}
                    className="px-3 py-1 rounded text-xs text-white"
                    style={{ background: "#475569" }}
                  >
                    إيقاف
                  </button>
                )}
                <button
                  onClick={() => { if (confirm("حذف؟")) deleteMut.mutate(w.id); }}
                  className="p-1.5 rounded text-red-400"
                  style={{ background: "rgba(239,68,68,.1)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && (data?.windows ?? []).length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">لا توجد نوافذ صيانة مسجّلة</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Performance ─────────────────────────────────────────────────────────

function PerformanceTab() {
  const qc = useQueryClient();
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<RateLimitConfig>>>({});
  const [cacheStoreId, setCacheStoreId] = useState("");

  const { data: rlData, isLoading: rlLoading } = useQuery<{ configs: RateLimitConfig[] }>({
    queryKey: ["admin", "rate-limits"],
    queryFn: () => api.get("/admin/rate-limits").then((r) => r.data),
  });

  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery<QueueStats>({
    queryKey: ["admin", "queue", "stats"],
    queryFn: () => api.get("/admin/queue/stats").then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: jobsData } = useQuery<{ jobs: JobItem[] }>({
    queryKey: ["admin", "queue", "jobs"],
    queryFn: () => api.get("/admin/queue/jobs").then((r) => r.data),
  });

  const { data: cacheData, refetch: refetchCache } = useQuery<{ invalidations: { storeId: string; invalidatedAt: string }[] }>({
    queryKey: ["admin", "cache", "status"],
    queryFn: () => api.get("/admin/cache/status").then((r) => r.data),
  });

  const rlMut = useMutation({
    mutationFn: (vars: { plan: string; data: Partial<RateLimitConfig> }) =>
      api.put(`/admin/rate-limits/${vars.plan}`, vars.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "rate-limits"] }); setEditedConfigs({}); },
  });

  const cacheMut = useMutation({
    mutationFn: (storeId?: string) => api.post("/admin/cache/invalidate", storeId ? { storeId } : {}),
    onSuccess: () => { refetchCache(); setCacheStoreId(""); },
  });

  function getConfig(plan: string): RateLimitConfig {
    const existing = rlData?.configs.find((c) => c.plan === plan);
    const edited = editedConfigs[plan];
    return {
      id: existing?.id ?? "",
      plan,
      reqPerMinute: edited?.reqPerMinute ?? existing?.reqPerMinute ?? (plan === "STARTER" ? 30 : plan === "GROWTH" ? 60 : plan === "PRO" ? 120 : 300),
      reqPerDay: edited?.reqPerDay ?? existing?.reqPerDay ?? (plan === "STARTER" ? 5000 : plan === "GROWTH" ? 10000 : plan === "PRO" ? 50000 : 200000),
      burstLimit: edited?.burstLimit ?? existing?.burstLimit ?? (plan === "STARTER" ? 10 : plan === "GROWTH" ? 20 : plan === "PRO" ? 40 : 100),
    };
  }

  const hasEdits = Object.keys(editedConfigs).length > 0;

  return (
    <div className="space-y-6">
      {/* Rate Limits */}
      <div className="rounded-xl p-5" style={SURFACE}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Rate Limiting — حدود API لكل خطة</h3>
          {hasEdits && (
            <button
              onClick={() => Object.entries(editedConfigs).forEach(([plan, data]) => rlMut.mutate({ plan, data }))}
              disabled={rlMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#059669" }}
            >
              <Save size={13} />
              {rlMut.isPending ? "جارٍ الحفظ..." : "حفظ جميع التغييرات"}
            </button>
          )}
        </div>
        {rlLoading && <p className="text-slate-500 text-sm">جارٍ التحميل...</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const cfg = getConfig(plan);
            const edited = editedConfigs[plan];
            return (
              <div key={plan} className="rounded-lg p-4" style={{ background: "#131e30", border: edited ? `1px solid ${PLAN_COLOR[plan]}66` : "1px solid #1a2840" }}>
                <p className="font-semibold text-sm mb-3" style={{ color: PLAN_COLOR[plan] }}>{plan}</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400">طلبات/دقيقة</label>
                    <input
                      type="number"
                      value={cfg.reqPerMinute}
                      onChange={(e) => setEditedConfigs({ ...editedConfigs, [plan]: { ...editedConfigs[plan], reqPerMinute: parseInt(e.target.value) } })}
                      className="w-full px-2 py-1 rounded text-sm text-white mt-0.5"
                      style={{ background: "#0c1526", border: "1px solid #1a2840" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">طلبات/يوم</label>
                    <input
                      type="number"
                      value={cfg.reqPerDay}
                      onChange={(e) => setEditedConfigs({ ...editedConfigs, [plan]: { ...editedConfigs[plan], reqPerDay: parseInt(e.target.value) } })}
                      className="w-full px-2 py-1 rounded text-sm text-white mt-0.5"
                      style={{ background: "#0c1526", border: "1px solid #1a2840" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">حد Burst</label>
                    <input
                      type="number"
                      value={cfg.burstLimit}
                      onChange={(e) => setEditedConfigs({ ...editedConfigs, [plan]: { ...editedConfigs[plan], burstLimit: parseInt(e.target.value) } })}
                      className="w-full px-2 py-1 rounded text-sm text-white mt-0.5"
                      style={{ background: "#0c1526", border: "1px solid #1a2840" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue Monitoring */}
      <div className="rounded-xl p-5" style={SURFACE}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Queue Monitoring — مراقبة المهام</h3>
          <button onClick={() => refetchQueue()} className="p-1.5 rounded text-slate-500" style={{ background: "#131e30" }}>
            <RefreshCw size={13} className={queueLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Job counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "معلّقة", value: queueData?.jobs.pending ?? 0, color: "#f59e0b" },
            { label: "قيد التشغيل", value: queueData?.jobs.running ?? 0, color: "#3b82f6" },
            { label: "مكتملة", value: queueData?.jobs.done ?? 0, color: "#10b981" },
            { label: "فشل", value: queueData?.jobs.failed ?? 0, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "#131e30" }}>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Jobs */}
        <h4 className="text-slate-400 text-xs font-medium mb-2">أحدث مهام الاستيراد</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1a2840" }}>
                <th className="text-right pb-2 px-2">المتجر</th>
                <th className="text-right pb-2 px-2">المصدر</th>
                <th className="text-right pb-2 px-2">الحالة</th>
                <th className="text-right pb-2 px-2">إجمالي / مستورد / فشل</th>
                <th className="text-right pb-2 px-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(jobsData?.jobs ?? []).slice(0, 10).map((job) => {
                const st = JOB_STATUS_STYLE[job.status] ?? JOB_STATUS_STYLE.PENDING;
                return (
                  <tr key={job.id} style={{ borderBottom: "1px solid #1a284044" }}>
                    <td className="py-2 px-2 text-white">{job.store?.name ?? "—"}</td>
                    <td className="py-2 px-2 text-slate-400">{job.source}</td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    </td>
                    <td className="py-2 px-2 text-slate-400">{job.totalItems} / {job.imported} / {job.failed}</td>
                    <td className="py-2 px-2 text-slate-500">{fmtDate(job.createdAt)}</td>
                  </tr>
                );
              })}
              {(jobsData?.jobs ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-4 text-slate-500">لا توجد مهام</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Errors */}
        {(queueData?.recentErrors ?? []).length > 0 && (
          <div className="mt-4">
            <h4 className="text-red-400 text-xs font-medium mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              أخطاء النظام — آخر 24 ساعة ({queueData?.recentErrors.length})
            </h4>
            <div className="space-y-1.5">
              {(queueData?.recentErrors ?? []).slice(0, 8).map((err) => (
                <div key={err.id} className="rounded-lg p-2.5 flex items-start gap-2" style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)" }}>
                  <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-red-300 text-xs truncate">{err.message}</p>
                    <p className="text-red-400/60 text-xs mt-0.5">{err.path ?? "—"} · {fmtDate(err.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cache Management */}
      <div className="rounded-xl p-5" style={SURFACE}>
        <h3 className="text-white font-semibold mb-4">Cache Management — إدارة الكاش</h3>
        <div className="flex gap-2 flex-wrap mb-4">
          <input
            placeholder="معرّف المتجر (اتركه فارغاً = مسح الكل)"
            value={cacheStoreId}
            onChange={(e) => setCacheStoreId(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm text-white font-mono"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <button
            onClick={() => cacheMut.mutate(cacheStoreId || undefined)}
            disabled={cacheMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: cacheStoreId ? "#dc2626" : "#7c3aed" }}
          >
            <Trash size={13} />
            {cacheStoreId ? "مسح كاش المتجر" : "مسح الكاش الكلي"}
          </button>
        </div>
        {cacheMut.isSuccess && (
          <p className="text-emerald-400 text-xs mb-3">✓ تم إصدار إشارة مسح الكاش بنجاح</p>
        )}

        {(cacheData?.invalidations ?? []).length > 0 && (
          <div>
            <p className="text-slate-400 text-xs mb-2">آخر عمليات مسح الكاش:</p>
            <div className="space-y-1">
              {cacheData?.invalidations.slice(0, 5).map((inv) => (
                <div key={inv.storeId} className="flex justify-between text-xs" style={{ color: "#94a3b8" }}>
                  <code className="font-mono">{inv.storeId}</code>
                  <span>{fmtDate(inv.invalidatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "flags",       label: "Feature Flags",  icon: Zap },
  { key: "maintenance", label: "وضع الصيانة",    icon: Wrench },
  { key: "performance", label: "الأداء والكاش",   icon: Gauge },
];

export default function InfrastructurePage() {
  const [tab, setTab] = useState("flags");

  return (
    <div className="min-h-screen p-6" style={{ background: "#060b18", color: "#e2e8f0" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">البنية التحتية</h1>
        <p className="text-slate-400 text-sm mt-1">Feature Flags، وضع الصيانة، الأداء، Rate Limiting، وإدارة الكاش</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={
                tab === t.key
                  ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                  : { background: "#0c1526", color: "#64748b", border: "1px solid #1a2840" }
              }
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "flags"       && <FeatureFlagsTab />}
      {tab === "maintenance" && <MaintenanceTab />}
      {tab === "performance" && <PerformanceTab />}
    </div>
  );
}
