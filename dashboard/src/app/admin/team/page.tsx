"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users2, Plus, X, Pencil, Trash2, ToggleLeft, ToggleRight,
  Mail, ShieldCheck, UserX, UserCheck, RefreshCw, Search,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformRole {
  id: string;
  name: string;
  nameAr: string;
}

interface PlatformStaff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  invitedAt: string;
  joinedAt: string | null;
  lastLoginAt: string | null;
  role: PlatformRole;
}

const AVATAR_COLORS = [
  ["#1e3a5f", "#60a5fa"],
  ["#1a3a2e", "#34d399"],
  ["#3b1f2b", "#f472b6"],
  ["#2d2a1a", "#fbbf24"],
  ["#1f1f3b", "#a78bfa"],
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
      <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>{label}</p>
      <p className="text-3xl font-black" style={{ color: color ?? "#dce8f5" }}>{value.toLocaleString("ar")}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"invite" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", roleId: "" });
  const [editForm, setEditForm] = useState({ roleId: "", isActive: true });

  const { data, isLoading } = useQuery<{ staff: PlatformStaff[] }>({
    queryKey: ["admin-team"],
    queryFn: () => api.get("/admin/team").then(r => r.data),
  });

  const { data: rolesData } = useQuery<{ roles: PlatformRole[] }>({
    queryKey: ["admin-roles"],
    queryFn: () => api.get("/admin/roles").then(r => r.data),
  });

  const staff = data?.staff ?? [];
  const roles = rolesData?.roles ?? [];

  const filtered = staff.filter(s =>
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const total = staff.length;
  const active = staff.filter(s => s.isActive).length;
  const inactive = total - active;

  const inviteMut = useMutation({
    mutationFn: (d: typeof form) => api.post("/admin/team", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-team"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: typeof editForm & { id: string }) =>
      api.patch(`/admin/team/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-team"] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/team/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-team"] }); setDelId(null); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/team/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-team"] }),
  });

  function openEdit(s: PlatformStaff) {
    setEditId(s.id);
    setEditForm({ roleId: s.role.id, isActive: s.isActive });
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditId(null); setForm({ email: "", firstName: "", lastName: "", roleId: "" }); }

  return (
    <div className="p-6 min-h-screen" style={{ background: "#060b18" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.25)" }}>
            <Users2 className="w-5 h-5" style={{ color: "#34d399" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#dce8f5" }}>فريق المنصة</h1>
            <p className="text-xs" style={{ color: "#4a6480" }}>إدارة موظفي المنصة وصلاحياتهم</p>
          </div>
        </div>
        <button
          onClick={() => setModal("invite")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3b82f6", color: "#fff" }}
        >
          <Plus className="w-4 h-4" />
          دعوة موظف
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="إجمالي الموظفين" value={total} />
        <StatCard label="نشط" value={active} color="#34d399" />
        <StatCard label="موقوف" value={inactive} color="#f87171" />
        <StatCard label="الأدوار" value={roles.length} color="#a78bfa" />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#4a6480" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="w-full pr-10 pl-4 py-2 rounded-xl text-sm"
          style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#dce8f5" }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-20" style={{ color: "#4a6480" }}>جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#1a2840" }} />
          <p className="text-sm" style={{ color: "#4a6480" }}>لا يوجد موظفون</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a2840" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "#0c1526" }}>
                {["الموظف", "الدور", "الحالة", "تاريخ الدعوة", "آخر دخول", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "#4a6480", borderBottom: "1px solid #1a2840" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const [bg, fg] = avatarColor(`${s.firstName}${s.lastName}`);
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #0f1823" }} className="hover:bg-[#0d1929]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: bg, color: fg }}>
                          {initials(s.firstName, s.lastName)}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: "#dce8f5" }}>{s.firstName} {s.lastName}</p>
                          <p className="text-xs" style={{ color: "#4a6480" }}>{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(167,139,250,.12)", color: "#a78bfa" }}>
                        {s.role.nameAr}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: s.id, isActive: !s.isActive })}
                        className="flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: s.isActive ? "#34d399" : "#f87171" }}
                        title={s.isActive ? "إيقاف الموظف" : "تفعيل الموظف"}
                      >
                        {s.isActive
                          ? <><ToggleRight className="w-4 h-4" /> نشط</>
                          : <><ToggleLeft className="w-4 h-4" /> موقوف</>
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#4a6480" }}>
                      {formatDate(s.invitedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#4a6480" }}>
                      {s.lastLoginAt ? formatDate(s.lastLoginAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg"
                          style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa" }}
                          title="تعديل">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDelId(s.id)} className="p-1.5 rounded-lg"
                          style={{ background: "rgba(239,68,68,.1)", color: "#f87171" }}
                          title="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {modal === "invite" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>دعوة موظف جديد</h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الاسم الأول</label>
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الاسم الأخير</label>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>البريد الإلكتروني</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الدور</label>
                <select value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}>
                  <option value="">اختر الدور</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                  style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
                <button
                  onClick={() => inviteMut.mutate(form)}
                  disabled={!form.email || !form.firstName || !form.lastName || !form.roleId || inviteMut.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: "#3b82f6", color: "#fff", opacity: (!form.email || !form.firstName || !form.roleId) ? .5 : 1 }}
                >
                  {inviteMut.isPending ? "جارٍ الدعوة..." : "إرسال الدعوة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modal === "edit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>تعديل الموظف</h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الدور</label>
                <select value={editForm.roleId} onChange={e => setEditForm(f => ({ ...f, roleId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm" style={{ color: "#94a3b8" }}>الحالة: {editForm.isActive ? "نشط" : "موقوف"}</span>
                <button
                  onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: editForm.isActive ? "rgba(239,68,68,.12)" : "rgba(52,211,153,.12)", color: editForm.isActive ? "#f87171" : "#34d399" }}
                >
                  {editForm.isActive ? <><UserX className="w-3.5 h-3.5" /> إيقاف</> : <><UserCheck className="w-3.5 h-3.5" /> تفعيل</>}
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                  style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
                <button
                  onClick={() => editId && updateMut.mutate({ ...editForm, id: editId })}
                  disabled={updateMut.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: "#3b82f6", color: "#fff" }}
                >
                  {updateMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
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
            <h3 className="font-bold mb-2" style={{ color: "#dce8f5" }}>حذف الموظف؟</h3>
            <p className="text-sm mb-5" style={{ color: "#64748b" }}>سيتم حذف بيانات الموظف نهائياً.</p>
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
