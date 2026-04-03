"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Mail, MessageSquare, Globe, Plus, Send, Trash2,
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Info,
  RefreshCw, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkCampaign {
  id: string;
  type: "EMAIL" | "SMS";
  subject: string | null;
  body: string;
  targetPlan: string | null;
  targetRegion: string | null;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";
  scheduledAt: string | null;
  sentAt: string | null;
  totalSent: number;
  opens: number;
  clicks: number;
  createdAt: string;
}

interface IncidentUpdate { message: string; createdAt: string }

interface PlatformIncident {
  id: string;
  title: string;
  type: "OUTAGE" | "DEGRADED" | "MAINTENANCE" | "NOTICE";
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  isPublic: boolean;
  updates: IncidentUpdate[];
  resolvedAt: string | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SURFACE = { background: "#0c1526", border: "1px solid #1a2840" };
const PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"];
const PLAN_COLOR: Record<string, string> = {
  STARTER: "#64748b", GROWTH: "#3b82f6", PRO: "#8b5cf6", ENTERPRISE: "#f59e0b",
};

const CAMPAIGN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "مسودة",   color: "#94a3b8", bg: "rgba(148,163,184,.12)" },
  SCHEDULED: { label: "مجدولة",  color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
  SENDING:   { label: "جارٍ الإرسال", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  SENT:      { label: "أُرسلت", color: "#10b981", bg: "rgba(16,185,129,.12)"   },
  FAILED:    { label: "فشل",    color: "#ef4444", bg: "rgba(239,68,68,.12)"    },
};

const INCIDENT_TYPE_STYLE: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  OUTAGE:      { label: "تعطل كامل",   color: "#ef4444", Icon: AlertCircle },
  DEGRADED:    { label: "أداء منخفض",  color: "#f59e0b", Icon: AlertTriangle },
  MAINTENANCE: { label: "صيانة",       color: "#3b82f6", Icon: Clock },
  NOTICE:      { label: "إشعار",       color: "#8b5cf6", Icon: Info },
};

const INCIDENT_STATUS_STYLE: Record<string, { label: string; color: string }> = {
  INVESTIGATING: { label: "قيد التحقيق", color: "#ef4444" },
  IDENTIFIED:    { label: "تم التحديد", color: "#f59e0b" },
  MONITORING:    { label: "مراقبة",     color: "#3b82f6" },
  RESOLVED:      { label: "تم الحل",   color: "#10b981" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-BH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Tab: Campaigns ───────────────────────────────────────────────────────────

function CampaignsTab() {
  const qc = useQueryClient();
  const [campaignType, setCampaignType] = useState<"EMAIL" | "SMS">("EMAIL");
  const [form, setForm] = useState({ subject: "", body: "", targetPlan: "", scheduledAt: "" });
  const [showForm, setShowForm] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ campaigns: BulkCampaign[] }>({
    queryKey: ["admin", "campaigns"],
    queryFn: () => api.get("/admin/communications/campaigns").then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.post("/admin/communications/campaigns", {
        type: campaignType,
        subject: campaignType === "EMAIL" ? form.subject : undefined,
        body: form.body,
        targetPlan: form.targetPlan || undefined,
        scheduledAt: form.scheduledAt || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setShowForm(false);
      setForm({ subject: "", body: "", targetPlan: "", scheduledAt: "" });
    },
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/communications/campaigns/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }); setSendingId(null); },
    onError: () => setSendingId(null),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/communications/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });

  const campaigns = data?.campaigns ?? [];
  const emailCampaigns = campaigns.filter((c) => c.type === "EMAIL");
  const smsCampaigns = campaigns.filter((c) => c.type === "SMS");

  return (
    <div className="space-y-6">
      {/* Type selector + Create */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["EMAIL", "SMS"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setCampaignType(t)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={
              campaignType === t
                ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                : { background: "#0c1526", color: "#64748b", border: "1px solid #1a2840" }
            }
          >
            {t === "EMAIL" ? <Mail size={14} /> : <MessageSquare size={14} />}
            {t === "EMAIL" ? "إيميل جماعي" : "SMS جماعي"}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white ml-auto"
          style={{ background: "#3b82f6" }}
        >
          <Plus size={14} />
          حملة جديدة
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-3" style={SURFACE}>
          <div className="flex gap-2 mb-1">
            {(["EMAIL", "SMS"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCampaignType(t)}
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={
                  campaignType === t
                    ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                    : { background: "#131e30", color: "#64748b", border: "1px solid #1a2840" }
                }
              >
                {t}
              </button>
            ))}
          </div>

          {campaignType === "EMAIL" && (
            <input
              placeholder="الموضوع (Subject)"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm text-white"
              style={{ background: "#131e30", border: "1px solid #1a2840" }}
            />
          )}

          <textarea
            placeholder={campaignType === "EMAIL" ? "محتوى الإيميل..." : "نص الرسالة (SMS)..."}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={5}
            className="w-full px-3 py-2 rounded-lg text-sm text-white resize-none"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">استهداف خطة (اختياري)</label>
              <select
                value={form.targetPlan}
                onChange={(e) => setForm({ ...form, targetPlan: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840" }}
              >
                <option value="">كل الخطط</option>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">جدولة (اختياري)</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840", colorScheme: "dark" }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.body || (campaignType === "EMAIL" && !form.subject) || createMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#3b82f6" }}
            >
              <Plus size={13} />
              {createMut.isPending ? "جارٍ الحفظ..." : "حفظ كمسودة"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400" style={{ background: "#131e30" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading && <p className="text-slate-500 text-sm">جارٍ التحميل...</p>}

      {[
        { label: "إيميل جماعي", icon: Mail, items: emailCampaigns },
        { label: "SMS جماعي", icon: MessageSquare, items: smsCampaigns },
      ].map(({ label, icon: Icon, items }) => (
        <div key={label}>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Icon size={12} /> {label}
          </h3>
          {items.length === 0 && <p className="text-slate-600 text-sm py-2">لا توجد حملات</p>}
          <div className="space-y-2">
            {items.map((c) => {
              const st = CAMPAIGN_STATUS[c.status];
              return (
                <div key={c.id} className="rounded-xl p-4" style={SURFACE}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-medium text-sm">{c.subject ?? c.body.slice(0, 40)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                        {c.targetPlan && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: PLAN_COLOR[c.targetPlan], background: `${PLAN_COLOR[c.targetPlan]}22` }}>
                            {c.targetPlan}
                          </span>
                        )}
                        {!c.targetPlan && <span className="text-xs text-slate-500">كل الخطط</span>}
                      </div>
                      {c.subject && <p className="text-slate-400 text-xs truncate">{c.body.slice(0, 80)}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {c.status === "SENT" && (
                          <>
                            <span>أُرسل لـ <b className="text-slate-300">{c.totalSent}</b></span>
                            <span>فُتح <b className="text-slate-300">{c.opens}</b></span>
                            <span>{fmtDate(c.sentAt)}</span>
                          </>
                        )}
                        {c.status === "SCHEDULED" && <span>مجدول: {fmtDate(c.scheduledAt)}</span>}
                        {c.status === "DRAFT" && <span>أُنشئت: {fmtDate(c.createdAt)}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                        <button
                          onClick={() => { if (confirm(`إرسال هذه الحملة الآن؟`)) { setSendingId(c.id); sendMut.mutate(c.id); } }}
                          disabled={sendingId === c.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white"
                          style={{ background: "#059669" }}
                        >
                          <Send size={12} />
                          {sendingId === c.id ? "جارٍ..." : "إرسال"}
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm("حذف هذه الحملة؟")) deleteMut.mutate(c.id); }}
                        className="p-1.5 rounded text-red-400"
                        style={{ background: "rgba(239,68,68,.1)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={() => refetch()} className="p-1.5 rounded text-slate-500" style={{ background: "#0c1526" }}>
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Status Page ─────────────────────────────────────────────────────────

function StatusPageTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "NOTICE", status: "INVESTIGATING", message: "", isPublic: true });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<Record<string, string>>({});
  const [newStatus, setNewStatus] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ incidents: PlatformIncident[] }>({
    queryKey: ["admin", "incidents"],
    queryFn: () => api.get("/admin/status/incidents").then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/admin/status/incidents", { ...form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "incidents"] }); setShowForm(false); setForm({ title: "", type: "NOTICE", status: "INVESTIGATING", message: "", isPublic: true }); },
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; status?: string; updateMessage?: string }) =>
      api.patch(`/admin/status/incidents/${vars.id}`, { status: vars.status, updateMessage: vars.updateMessage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "incidents"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/status/incidents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "incidents"] }),
  });

  const incidents = data?.incidents ?? [];
  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");
  const resolved = incidents.filter((i) => i.status === "RESOLVED");

  const overall = activeIncidents.some((i) => i.type === "OUTAGE" || i.type === "DEGRADED")
    ? { label: "خدمة متأثرة", color: "#ef4444", bg: "rgba(239,68,68,.08)", Icon: AlertCircle }
    : activeIncidents.some((i) => i.type === "MAINTENANCE")
    ? { label: "صيانة مجدولة", color: "#3b82f6", bg: "rgba(59,130,246,.08)", Icon: Clock }
    : { label: "جميع الأنظمة تعمل", color: "#10b981", bg: "rgba(16,185,129,.08)", Icon: CheckCircle2 };

  return (
    <div className="space-y-5">
      {/* Overall status banner */}
      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: overall.bg, border: `1px solid ${overall.color}33` }}>
        <overall.Icon size={22} style={{ color: overall.color }} />
        <div>
          <p className="font-semibold" style={{ color: overall.color }}>{overall.label}</p>
          <p className="text-slate-400 text-xs mt-0.5">الصفحة العامة: <code className="font-mono">/status</code></p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white ml-auto"
          style={{ background: "#3b82f6" }}
        >
          <Plus size={13} />
          إضافة حادثة
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-3" style={SURFACE}>
          <input
            placeholder="عنوان الحادثة..."
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">النوع</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840" }}>
                <option value="OUTAGE">تعطل كامل</option>
                <option value="DEGRADED">أداء منخفض</option>
                <option value="MAINTENANCE">صيانة</option>
                <option value="NOTICE">إشعار عام</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840" }}>
                <option value="INVESTIGATING">قيد التحقيق</option>
                <option value="IDENTIFIED">تم التحديد</option>
                <option value="MONITORING">مراقبة</option>
                <option value="RESOLVED">تم الحل</option>
              </select>
            </div>
          </div>
          <textarea
            placeholder="رسالة أولية (اختياري)..."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm text-white resize-none"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <div className="flex items-center gap-2">
            <button onClick={() => setForm({ ...form, isPublic: !form.isPublic })}>
              {form.isPublic ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} className="text-slate-500" />}
            </button>
            <span className="text-sm text-slate-300">يظهر في الصفحة العامة</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.title || createMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#3b82f6" }}
            >
              <Plus size={12} />
              {createMut.isPending ? "جارٍ..." : "إنشاء"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400" style={{ background: "#131e30" }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Active Incidents */}
      {activeIncidents.length > 0 && (
        <div>
          <h3 className="text-red-400 text-xs font-semibold mb-2">حوادث نشطة ({activeIncidents.length})</h3>
          <div className="space-y-3">
            {activeIncidents.map((inc) => <IncidentCard key={inc.id} inc={inc} expandedId={expandedId} setExpandedId={setExpandedId} updateMsg={updateMsg} setUpdateMsg={setUpdateMsg} newStatus={newStatus} setNewStatus={setNewStatus} updateMut={updateMut} deleteMut={deleteMut} />)}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-slate-500 text-xs font-semibold mb-2">سجل الحوادث المحلولة ({resolved.length})</h3>
          <div className="space-y-2">
            {resolved.map((inc) => <IncidentCard key={inc.id} inc={inc} expandedId={expandedId} setExpandedId={setExpandedId} updateMsg={updateMsg} setUpdateMsg={setUpdateMsg} newStatus={newStatus} setNewStatus={setNewStatus} updateMut={updateMut} deleteMut={deleteMut} />)}
          </div>
        </div>
      )}

      {!isLoading && incidents.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">لا توجد حوادث مسجّلة</p>
      )}
    </div>
  );
}

function IncidentCard({
  inc, expandedId, setExpandedId, updateMsg, setUpdateMsg, newStatus, setNewStatus, updateMut, deleteMut,
}: {
  inc: PlatformIncident;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  updateMsg: Record<string, string>;
  setUpdateMsg: (x: Record<string, string>) => void;
  newStatus: Record<string, string>;
  setNewStatus: (x: Record<string, string>) => void;
  updateMut: { mutate: (v: { id: string; status?: string; updateMessage?: string }) => void };
  deleteMut: { mutate: (id: string) => void };
}) {
  const typeStyle = INCIDENT_TYPE_STYLE[inc.type] ?? INCIDENT_TYPE_STYLE.NOTICE;
  const statusStyle = INCIDENT_STATUS_STYLE[inc.status] ?? INCIDENT_STATUS_STYLE.INVESTIGATING;
  const expanded = expandedId === inc.id;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0c1526", border: inc.status !== "RESOLVED" ? `1px solid ${typeStyle.color}44` : "1px solid #1a2840" }}>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <typeStyle.Icon size={16} style={{ color: typeStyle.color, marginTop: 2, flexShrink: 0 }} />
          <div>
            <p className="text-white font-medium text-sm">{inc.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: typeStyle.color, background: `${typeStyle.color}22` }}>{typeStyle.label}</span>
              <span className="text-xs" style={{ color: statusStyle.color }}>{statusStyle.label}</span>
              {!inc.isPublic && <span className="text-xs text-slate-500">غير عام</span>}
              <span className="text-xs text-slate-500">{new Date(inc.createdAt).toLocaleDateString("ar-BH")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setExpandedId(expanded ? null : inc.id)} className="p-1.5 rounded text-slate-400" style={{ background: "#131e30" }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => { if (confirm("حذف؟")) deleteMut.mutate(inc.id); }} className="p-1.5 rounded text-red-400" style={{ background: "rgba(239,68,68,.1)" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid #1a2840" }}>
          {/* Updates timeline */}
          {inc.updates.length > 0 && (
            <div className="mt-3 space-y-2 mb-4">
              {inc.updates.map((u, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-slate-500 shrink-0">{new Date(u.createdAt).toLocaleString("ar-BH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-slate-300">{u.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add update */}
          {inc.status !== "RESOLVED" && (
            <div className="flex gap-2 mt-3">
              <input
                placeholder="أضف تحديثاً..."
                value={updateMsg[inc.id] ?? ""}
                onChange={(e) => setUpdateMsg({ ...updateMsg, [inc.id]: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded text-xs text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840" }}
              />
              <select
                value={newStatus[inc.id] ?? inc.status}
                onChange={(e) => setNewStatus({ ...newStatus, [inc.id]: e.target.value })}
                className="px-2 py-1.5 rounded text-xs text-white"
                style={{ background: "#131e30", border: "1px solid #1a2840" }}
              >
                <option value="INVESTIGATING">قيد التحقيق</option>
                <option value="IDENTIFIED">تم التحديد</option>
                <option value="MONITORING">مراقبة</option>
                <option value="RESOLVED">تم الحل</option>
              </select>
              <button
                onClick={() => {
                  updateMut.mutate({ id: inc.id, updateMessage: updateMsg[inc.id], status: newStatus[inc.id] });
                  setUpdateMsg({ ...updateMsg, [inc.id]: "" });
                }}
                className="px-3 py-1.5 rounded text-xs text-white"
                style={{ background: "#3b82f6" }}
              >
                حفظ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "campaigns", label: "الحملات",     icon: Mail },
  { key: "status",    label: "Status Page", icon: Globe },
];

export default function CommunicationsPage() {
  const [tab, setTab] = useState("campaigns");

  return (
    <div className="min-h-screen p-6" style={{ background: "#060b18", color: "#e2e8f0" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">التواصل مع التجار</h1>
        <p className="text-slate-400 text-sm mt-1">إيميل وSMS جماعي، جدولة الإرسال، وإدارة صفحة الحالة العامة</p>
      </div>

      <div className="flex gap-2 mb-6">
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

      {tab === "campaigns" && <CampaignsTab />}
      {tab === "status"    && <StatusPageTab />}
    </div>
  );
}
