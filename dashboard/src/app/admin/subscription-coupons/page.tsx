"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Ticket, Plus, X, Pencil, Trash2, ToggleLeft, ToggleRight,
  Percent, Hash, Calendar, Target,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubscriptionCoupon {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  maxUses: number | null;
  usedCount: number;
  applicablePlan: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { usages: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_OPTS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"];

const EMPTY_FORM = {
  code: "", description: "", type: "PERCENTAGE",
  value: "", maxUses: "", applicablePlan: "",
  validFrom: "", validTo: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isExpired(c: SubscriptionCoupon) {
  if (!c.validTo) return false;
  return new Date(c.validTo) < new Date();
}

function isExhausted(c: SubscriptionCoupon) {
  if (!c.maxUses) return false;
  return c.usedCount >= c.maxUses;
}

function statusLabel(c: SubscriptionCoupon) {
  if (!c.isActive) return { label: "معطل", color: "#f87171", bg: "rgba(239,68,68,.12)" };
  if (isExpired(c)) return { label: "منتهي", color: "#fbbf24", bg: "rgba(245,158,11,.12)" };
  if (isExhausted(c)) return { label: "مستنفد", color: "#f87171", bg: "rgba(239,68,68,.12)" };
  return { label: "نشط", color: "#34d399", bg: "rgba(52,211,153,.12)" };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubscriptionCouponsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [delId, setDelId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ coupons: SubscriptionCoupon[] }>({
    queryKey: ["admin-sub-coupons"],
    queryFn: () => api.get("/admin/subscription-coupons").then(r => r.data),
  });

  const coupons = data?.coupons ?? [];

  const createMut = useMutation({
    mutationFn: (d: typeof EMPTY_FORM) => api.post("/admin/subscription-coupons", {
      ...d,
      maxUses: d.maxUses ? parseInt(d.maxUses) : null,
      applicablePlan: d.applicablePlan || null,
      validFrom: d.validFrom || null,
      validTo: d.validTo || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sub-coupons"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string; isActive?: boolean; description?: string; maxUses?: number | null; validFrom?: string | null; validTo?: string | null }) =>
      api.patch(`/admin/subscription-coupons/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sub-coupons"] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/subscription-coupons/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sub-coupons"] }); setDelId(null); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/subscription-coupons/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sub-coupons"] }),
  });

  function openEdit(c: SubscriptionCoupon) {
    setEditId(c.id);
    setForm({
      code: c.code, description: c.description ?? "", type: c.type,
      value: String(c.value), maxUses: c.maxUses ? String(c.maxUses) : "",
      applicablePlan: c.applicablePlan ?? "",
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : "",
      validTo: c.validTo ? c.validTo.slice(0, 10) : "",
    });
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditId(null); setForm(EMPTY_FORM); }

  function submit() {
    if (modal === "create") createMut.mutate(form);
    else if (modal === "edit" && editId) {
      updateMut.mutate({
        id: editId,
        description: form.description || undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      });
    }
  }

  const totalActive = coupons.filter(c => c.isActive && !isExpired(c) && !isExhausted(c)).length;
  const totalUsed = coupons.reduce((a, c) => a + c.usedCount, 0);

  return (
    <div className="p-6 min-h-screen" style={{ background: "#060b18" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(167,139,250,.12)", border: "1px solid rgba(167,139,250,.25)" }}>
            <Ticket className="w-5 h-5" style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#dce8f5" }}>كوبونات الاشتراك</h1>
            <p className="text-xs" style={{ color: "#4a6480" }}>كوبونات خصم على اشتراكات المنصة</p>
          </div>
        </div>
        <button onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3b82f6", color: "#fff" }}>
          <Plus className="w-4 h-4" /> كوبون جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>إجمالي الكوبونات</p>
          <p className="text-2xl font-black" style={{ color: "#dce8f5" }}>{coupons.length}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>نشط</p>
          <p className="text-2xl font-black" style={{ color: "#34d399" }}>{totalActive}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>إجمالي الاستخدامات</p>
          <p className="text-2xl font-black" style={{ color: "#a78bfa" }}>{totalUsed.toLocaleString("ar")}</p>
        </div>
      </div>

      {/* Coupons Grid */}
      {isLoading ? (
        <div className="text-center py-20" style={{ color: "#4a6480" }}>جارٍ التحميل...</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="w-10 h-10 mx-auto mb-3" style={{ color: "#1a2840" }} />
          <p className="text-sm" style={{ color: "#4a6480" }}>لا توجد كوبونات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map(c => {
            const st = statusLabel(c);
            return (
              <div key={c.id} className="rounded-2xl p-4 space-y-3"
                style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm" style={{ color: "#dce8f5" }}>{c.code}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    {c.description && (
                      <p className="text-xs mt-1" style={{ color: "#64748b" }}>{c.description}</p>
                    )}
                  </div>
                  <div className="text-lg font-black" style={{ color: "#a78bfa" }}>
                    {c.type === "PERCENTAGE" ? `${c.value}%` : `${Number(c.value).toFixed(3)} BD`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5" style={{ color: "#4a6480" }}>
                    <Hash className="w-3 h-3" />
                    {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""} استخدام
                  </div>
                  {c.applicablePlan && (
                    <div className="flex items-center gap-1.5" style={{ color: "#4a6480" }}>
                      <Target className="w-3 h-3" />
                      {c.applicablePlan}
                    </div>
                  )}
                  {c.validTo && (
                    <div className="flex items-center gap-1.5 col-span-2" style={{ color: "#4a6480" }}>
                      <Calendar className="w-3 h-3" />
                      ينتهي: {formatDate(c.validTo)}
                    </div>
                  )}
                </div>

                {/* Usage bar */}
                {c.maxUses && (
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "#1a2840" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, (c.usedCount / c.maxUses) * 100)}%`,
                      background: "#a78bfa",
                    }} />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid #1a2840" }}>
                  <button onClick={() => toggleMut.mutate({ id: c.id, isActive: !c.isActive })}
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: c.isActive ? "#34d399" : "#f87171" }}>
                    {c.isActive
                      ? <><ToggleRight className="w-4 h-4" /> مفعّل</>
                      : <><ToggleLeft className="w-4 h-4" /> معطّل</>}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg"
                      style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa" }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDelId(c.id)}
                      className="p-1.5 rounded-lg"
                      style={{ background: "rgba(239,68,68,.1)", color: "#f87171" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>
                {modal === "create" ? "كوبون جديد" : "تعديل الكوبون"}
              </h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الكود</label>
                  <input value={form.code} disabled={modal === "edit"}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="WELCOME20"
                    className="w-full px-3 py-2 rounded-xl text-sm font-mono"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5", opacity: modal === "edit" ? .5 : 1 }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>نوع الخصم</label>
                  <select value={form.type} disabled={modal === "edit"}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5", opacity: modal === "edit" ? .5 : 1 }}>
                    <option value="PERCENTAGE">نسبة %</option>
                    <option value="FIXED">مبلغ ثابت</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>
                    {form.type === "PERCENTAGE" ? "النسبة %" : "المبلغ (BHD)"}
                  </label>
                  <input value={form.value} type="number" min="0" disabled={modal === "edit"}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5", opacity: modal === "edit" ? .5 : 1 }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الحد الأقصى للاستخدام</label>
                  <input value={form.maxUses} type="number" min="0"
                    placeholder="بلا حد"
                    onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الباقة المطبق عليها</label>
                <select value={form.applicablePlan}
                  onChange={e => setForm(f => ({ ...f, applicablePlan: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}>
                  <option value="">كل الباقات</option>
                  {PLAN_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>تاريخ البداية</label>
                  <input type="date" value={form.validFrom}
                    onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>تاريخ الانتهاء</label>
                  <input type="date" value={form.validTo}
                    onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>وصف (اختياري)</label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                  style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
                <button onClick={submit}
                  disabled={(!form.code || !form.value) || createMut.isPending || updateMut.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: "#3b82f6", color: "#fff", opacity: (!form.code || !form.value) ? .5 : 1 }}>
                  {createMut.isPending || updateMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <h3 className="font-bold mb-2" style={{ color: "#dce8f5" }}>حذف الكوبون؟</h3>
            <p className="text-sm mb-5" style={{ color: "#64748b" }}>لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDelId(null)} className="px-4 py-2 text-sm rounded-xl"
                style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
              <button onClick={() => deleteMut.mutate(delId)} disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ background: "#ef4444", color: "#fff" }}>
                {deleteMut.isPending ? "جارٍ الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
