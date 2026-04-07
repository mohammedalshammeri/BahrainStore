"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Shield, Plus, Pencil, Trash2, X, Check, Lock, Users2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformRole {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  canViewMerchants: boolean;
  canDisableStore: boolean;
  canReplyTickets: boolean;
  canEditPlans: boolean;
  canManageApps: boolean;
  canViewFinancials: boolean;
  canViewAuditLog: boolean;
  canManageContent: boolean;
  canReviewKYC: boolean;
  canManageTeam: boolean;
  isSystem: boolean;
  _count: { members: number };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERMS: { key: keyof PlatformRole; label: string; labelAr: string }[] = [
  { key: "canViewMerchants",  label: "View Merchants",     labelAr: "عرض التجار والمتاجر" },
  { key: "canDisableStore",   label: "Disable Store",      labelAr: "تعطيل/تفعيل متجر" },
  { key: "canReplyTickets",   label: "Reply to Tickets",   labelAr: "الرد على تذاكر الدعم" },
  { key: "canEditPlans",      label: "Edit Plans",         labelAr: "تعديل الباقات والأسعار" },
  { key: "canManageApps",     label: "Manage Apps",        labelAr: "إضافة/تعديل التطبيقات" },
  { key: "canViewFinancials", label: "View Financials",    labelAr: "عرض التقارير المالية" },
  { key: "canViewAuditLog",   label: "View Audit Log",     labelAr: "عرض سجل العمليات" },
  { key: "canManageContent",  label: "Manage Content",     labelAr: "إدارة المحتوى والمدونة" },
  { key: "canReviewKYC",      label: "Review KYC",         labelAr: "مراجعة KYC للتجار" },
  { key: "canManageTeam",     label: "Manage Team",        labelAr: "إدارة فريق المنصة" },
];

const EMPTY_FORM = {
  name: "", nameAr: "", description: "",
  canViewMerchants: false, canDisableStore: false, canReplyTickets: false,
  canEditPlans: false, canManageApps: false, canViewFinancials: false,
  canViewAuditLog: false, canManageContent: false, canReviewKYC: false, canManageTeam: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function permCount(r: PlatformRole) {
  return PERMS.filter(p => r[p.key] === true).length;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? "#3b82f6" : "#1a2840" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
        style={{
          background: "#fff",
          left: value ? "calc(100% - 18px)" : "2px",
        }}
      />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RolesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<PlatformRole | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ roles: PlatformRole[] }>({
    queryKey: ["admin-roles"],
    queryFn: () => api.get("/admin/roles").then(r => r.data),
  });

  const roles = data?.roles ?? [];

  const createMut = useMutation({
    mutationFn: (d: typeof EMPTY_FORM) => api.post("/admin/roles", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: typeof EMPTY_FORM & { id: string }) =>
      api.put(`/admin/roles/${id}`, d),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      setSelected(null);
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      setDelId(null);
      if (selected?.id === delId) setSelected(null);
    },
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal("create");
  }

  function openEdit(r: PlatformRole) {
    setForm({
      name: r.name, nameAr: r.nameAr, description: r.description ?? "",
      canViewMerchants: r.canViewMerchants, canDisableStore: r.canDisableStore,
      canReplyTickets: r.canReplyTickets, canEditPlans: r.canEditPlans,
      canManageApps: r.canManageApps, canViewFinancials: r.canViewFinancials,
      canViewAuditLog: r.canViewAuditLog, canManageContent: r.canManageContent,
      canReviewKYC: r.canReviewKYC,
      canManageTeam: r.canManageTeam,
    });
    setEditId(r.id);
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditId(null); }

  function submit() {
    if (!form.name || !form.nameAr) return;
    if (modal === "create") createMut.mutate(form);
    else if (modal === "edit" && editId) updateMut.mutate({ ...form, id: editId });
  }

  const perm = (key: string) => form[key as keyof typeof EMPTY_FORM] as boolean;
  const setPerm = (key: string, v: boolean) => setForm(f => ({ ...f, [key]: v }));

  return (
    <div className="p-6 min-h-screen" style={{ background: "#060b18" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.3)" }}>
            <Shield className="w-5 h-5" style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#dce8f5" }}>الأدوار والصلاحيات</h1>
            <p className="text-xs" style={{ color: "#4a6480" }}>إدارة أدوار موظفي المنصة وصلاحياتهم</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3b82f6", color: "#fff" }}
        >
          <Plus className="w-4 h-4" />
          دور جديد
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20" style={{ color: "#4a6480" }}>جارٍ التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Role List */}
          <div className="space-y-3">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => setSelected(selected?.id === role.id ? null : role)}
                className="rounded-2xl p-4 cursor-pointer transition-colors"
                style={{
                  background: selected?.id === role.id ? "#0f1d32" : "#0c1526",
                  border: `1px solid ${selected?.id === role.id ? "#3b82f6" : "#1a2840"}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: "#dce8f5" }}>{role.nameAr}</span>
                      {role.isSystem && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: "rgba(167,139,250,.15)", color: "#a78bfa" }}>
                          <Lock className="w-2.5 h-2.5" /> نظامي
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: "#3b82f6" }}>{role.name}</p>
                    {role.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "#64748b" }}>{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #1a2840" }}>
                  <span className="text-xs flex items-center gap-1" style={{ color: "#64748b" }}>
                    <Users2 className="w-3.5 h-3.5" />
                    {role._count.members} موظف
                  </span>
                  <span className="text-xs" style={{ color: "#4a6480" }}>
                    {permCount(role)}/{PERMS.length} صلاحية
                  </span>
                </div>
                {/* Mini permission dots */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {PERMS.map(p => (
                    <span
                      key={p.key}
                      className="w-2 h-2 rounded-full"
                      style={{ background: role[p.key] === true ? "#3b82f6" : "#1a2840" }}
                      title={p.labelAr}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="rounded-2xl p-5 h-full" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-bold text-base" style={{ color: "#dce8f5" }}>{selected.nameAr}</h2>
                    <p className="text-xs font-mono" style={{ color: "#3b82f6" }}>{selected.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selected.isSystem && (
                      <>
                        <button
                          onClick={() => openEdit(selected)}
                          className="p-2 rounded-lg"
                          style={{ background: "rgba(59,130,246,.12)", color: "#60a5fa" }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {selected._count.members === 0 && (
                          <button
                            onClick={() => setDelId(selected.id)}
                            className="p-2 rounded-lg"
                            style={{ background: "rgba(239,68,68,.12)", color: "#f87171" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERMS.map(p => (
                    <div
                      key={p.key}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{
                        background: (selected as any)[p.key] ? "rgba(59,130,246,.08)" : "#060b18",
                        border: `1px solid ${(selected as any)[p.key] ? "rgba(59,130,246,.25)" : "#1a2840"}`,
                      }}
                    >
                      <span className="text-sm" style={{ color: (selected as any)[p.key] ? "#dce8f5" : "#4a6480" }}>
                        {p.labelAr}
                      </span>
                      {(selected as any)[p.key]
                        ? <Check className="w-4 h-4" style={{ color: "#34d399" }} />
                        : <X className="w-4 h-4" style={{ color: "#374151" }} />
                      }
                    </div>
                  ))}
                </div>

                {selected.description && (
                  <p className="text-sm mt-4 pt-4" style={{ color: "#64748b", borderTop: "1px solid #1a2840" }}>
                    {selected.description}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl flex items-center justify-center h-64"
                style={{ background: "#0c1526", border: "1px dashed #1a2840" }}>
                <p className="text-sm" style={{ color: "#4a6480" }}>اختر دوراً لعرض تفاصيله</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>
                {modal === "create" ? "إنشاء دور جديد" : "تعديل الدور"}
              </h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>اسم الدور (EN)</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                    placeholder="SUPPORT"
                    disabled={modal === "edit"}
                    className="w-full px-3 py-2 rounded-xl text-sm font-mono"
                    style={{ background: modal === "edit" ? "#0f172a" : "#060b18", border: "1px solid #1a2840", color: modal === "edit" ? "#64748b" : "#dce8f5" }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>اسم الدور (AR)</label>
                  <input
                    value={form.nameAr}
                    onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                    placeholder="دعم فني"
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>وصف (اختياري)</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}
                />
              </div>

              <div style={{ borderTop: "1px solid #1a2840", paddingTop: "16px" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "#4a6480" }}>الصلاحيات</p>
                <div className="space-y-2">
                  {PERMS.map(p => (
                    <div key={p.key} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: "#94a3b8" }}>{p.labelAr}</span>
                      <Toggle value={perm(p.key)} onChange={v => setPerm(p.key, v)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                  style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
                <button
                  onClick={submit}
                  disabled={!form.name || !form.nameAr || createMut.isPending || updateMut.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: "#3b82f6", color: "#fff", opacity: (!form.name || !form.nameAr) ? 0.5 : 1 }}
                >
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
            <h3 className="font-bold mb-2" style={{ color: "#dce8f5" }}>حذف الدور؟</h3>
            <p className="text-sm mb-5" style={{ color: "#64748b" }}>لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDelId(null)} className="px-4 py-2 text-sm rounded-xl"
                style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
              <button
                onClick={() => deleteMut.mutate(delId)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {deleteMut.isPending ? "جارٍ الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
