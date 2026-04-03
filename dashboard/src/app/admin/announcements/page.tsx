"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Bell, Plus, X, Pencil, Trash2, Pin, AlertTriangle,
  Info, Zap, Wrench, Eye, EyeOff, RefreshCw, Calendar,
  Target,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  titleAr: string;
  body: string | null;
  bodyAr: string | null;
  type: "INFO" | "WARNING" | "MAINTENANCE" | "FEATURE";
  isActive: boolean;
  isPinned: boolean;
  targetPlan: string | null;
  viewCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_MAP = {
  INFO:        { label: "معلومة",         icon: Info,          color: "#60a5fa", bg: "rgba(59,130,246,.12)" },
  WARNING:     { label: "تحذير",          icon: AlertTriangle, color: "#fbbf24", bg: "rgba(245,158,11,.12)" },
  MAINTENANCE: { label: "صيانة",          icon: Wrench,        color: "#f87171", bg: "rgba(239,68,68,.12)"  },
  FEATURE:     { label: "ميزة جديدة",     icon: Zap,           color: "#a78bfa", bg: "rgba(167,139,250,.12)" },
};

const PLAN_OPTS = ["", "STARTER", "GROWTH", "PRO", "ENTERPRISE"];

const EMPTY: Partial<Announcement> = {
  title: "", titleAr: "", body: "", bodyAr: "",
  type: "INFO", isActive: true, isPinned: false,
  targetPlan: null, startsAt: null, endsAt: null,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<Announcement>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ["admin-announcements"],
    queryFn: () => api.get("/admin/announcements").then((r) => r.data),
  });

  const announcements = data?.announcements ?? [];

  const createMut = useMutation({
    mutationFn: (d: Partial<Announcement>) => api.post("/admin/announcements", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-announcements"] }); close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<Announcement> & { id: string }) =>
      api.put(`/admin/announcements/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-announcements"] }); close(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/announcements/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  function openCreate() {
    setForm({ ...EMPTY });
    setEditId(null);
    setModal("create");
  }
  function openEdit(a: Announcement) {
    setForm({ ...a });
    setEditId(a.id);
    setModal("edit");
  }
  function close() { setModal(null); }

  function submit() {
    const payload = {
      ...form,
      targetPlan: form.targetPlan || null,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    };
    if (modal === "create") createMut.mutate(payload);
    else if (modal === "edit" && editId) updateMut.mutate({ ...payload, id: editId } as any);
  }

  const isBusy = createMut.isPending || updateMut.isPending;

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>الإعلانات</h1>
            <p className="text-sm mt-0.5" style={{ color: "#3d5470" }}>
              إعلانات تظهر داخل داشبورد التجار
            </p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}>
            <Plus className="w-4 h-4" />
            إعلان جديد
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الإعلانات", value: announcements.length,             color: "#60a5fa" },
            { label: "مفعّلة الآن",       value: announcements.filter(a=>a.isActive).length, color: "#34d399" },
            { label: "مثبّتة",            value: announcements.filter(a=>a.isPinned).length,  color: "#fbbf24" },
            { label: "إجمالي المشاهدات", value: announcements.reduce((s,a)=>s+a.viewCount,0), color: "#a78bfa" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-4 text-center"
              style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <p className="text-xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#3d5470" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Announcements list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-10 text-center">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-16 text-center rounded-2xl" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
              <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد إعلانات بعد</p>
            </div>
          ) : (
            announcements.map((a) => {
              const t = TYPE_MAP[a.type] ?? TYPE_MAP.INFO;
              const TypeIcon = t.icon;
              return (
                <div key={a.id} className="rounded-2xl p-4 flex items-start gap-4 transition"
                  style={{
                    background: "#0c1526",
                    border: `1px solid ${a.isActive ? "#1a2840" : "#0f1a2d"}`,
                    opacity: a.isActive ? 1 : 0.55,
                  }}>
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: t.bg }}>
                    <TypeIcon className="w-5 h-5" style={{ color: t.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm" style={{ color: "#dce8f5" }}>{a.titleAr}</p>
                      {a.isPinned && <Pin className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: t.bg, color: t.color }}>{t.label}</span>
                      {a.targetPlan && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(167,139,250,.1)", color: "#a78bfa" }}>
                          <Target className="w-2.5 h-2.5" />
                          {a.targetPlan}
                        </span>
                      )}
                    </div>
                    {a.bodyAr && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "#4a6480" }}>{a.bodyAr}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {a.startsAt && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#3d5470" }}>
                          <Calendar className="w-3 h-3" />
                          من {formatDate(a.startsAt)}
                        </span>
                      )}
                      {a.endsAt && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#3d5470" }}>
                          إلى {formatDate(a.endsAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#3d5470" }}>
                        <Eye className="w-3 h-3" />
                        {a.viewCount} مشاهدة
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleMut.mutate(a.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{
                        background: a.isActive ? "rgba(16,185,129,.1)" : "rgba(100,116,139,.1)",
                        border: `1px solid ${a.isActive ? "rgba(16,185,129,.2)" : "rgba(100,116,139,.2)"}`,
                      }}>
                      {a.isActive
                        ? <Eye className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                        : <EyeOff className="w-3.5 h-3.5" style={{ color: "#64748b" }} />}
                    </button>
                    <button onClick={() => openEdit(a)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.15)" }}>
                      <Pencil className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
                    </button>
                    <button onClick={() => confirm("حذف هذا الإعلان؟") && deleteMut.mutate(a.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.12)" }}>
                      <Trash2 className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Modal ─── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-y-auto max-h-[90vh]"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between p-5"
              style={{ borderBottom: "1px solid #1a2840" }}>
              <h2 className="text-lg font-black" style={{ color: "#e2eef8" }}>
                {modal === "create" ? "إعلان جديد" : "تعديل الإعلان"}
              </h2>
              <button onClick={close}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.12)" }}>
                <X className="w-4 h-4" style={{ color: "#f87171" }} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="العنوان (عربي)" required>
                  <input value={form.titleAr ?? ""} onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                    placeholder="عنوان الإعلان بالعربي" style={inputStyle} />
                </Field>
                <Field label="العنوان (إنجليزي)" required>
                  <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Announcement title" style={inputStyle} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="النص (عربي)">
                  <textarea value={form.bodyAr ?? ""} onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
                    rows={3} placeholder="تفاصيل الإعلان بالعربي" style={{ ...inputStyle, resize: "none" }} />
                </Field>
                <Field label="النص (إنجليزي)">
                  <textarea value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={3} placeholder="Announcement details" style={{ ...inputStyle, resize: "none" }} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="النوع">
                  <select value={form.type ?? "INFO"} onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    style={inputStyle}>
                    {Object.entries(TYPE_MAP).map(([key, v]) => (
                      <option key={key} value={key}>{v.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="استهداف خطة">
                  <select value={form.targetPlan ?? ""} onChange={(e) => setForm({ ...form, targetPlan: e.target.value || null })}
                    style={inputStyle}>
                    <option value="">كل الخطط</option>
                    {PLAN_OPTS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="الخيارات">
                  <div className="flex items-center gap-3 mt-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#8aa8c4" }}>
                      <input type="checkbox" checked={form.isPinned ?? false}
                        onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="accent-yellow-400" />
                      مثبّت
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#8aa8c4" }}>
                      <input type="checkbox" checked={form.isActive ?? true}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-green-400" />
                      مفعّل
                    </label>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="تاريخ البداية">
                  <input type="datetime-local"
                    value={form.startsAt ? form.startsAt.slice(0, 16) : ""}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value || null })}
                    style={inputStyle} />
                </Field>
                <Field label="تاريخ الانتهاء">
                  <input type="datetime-local"
                    value={form.endsAt ? form.endsAt.slice(0, 16) : ""}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value || null })}
                    style={inputStyle} />
                </Field>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 p-5" style={{ borderTop: "1px solid #1a2840" }}>
              <button onClick={submit} disabled={isBusy || !form.titleAr || !form.title}
                className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-40"
                style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.25)", color: "#60a5fa" }}>
                {isBusy ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : modal === "create" ? "إنشاء الإعلان" : "حفظ التعديلات"}
              </button>
              <button onClick={close} className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#0f1a2d", border: "1px solid #1a2840", color: "#4a6480" }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 10,
  background: "#0a1220", border: "1px solid #1a2840",
  color: "#dce8f5", fontSize: 13, outline: "none",
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black mb-1.5" style={{ color: "#4a6480" }}>
        {label}{required && <span style={{ color: "#f87171" }}> *</span>}
      </p>
      {children}
    </div>
  );
}
