"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Handshake, Plus, X, Pencil, Trash2, BadgeCheck,
  ChevronDown, DollarSign, Building2, User, Link2,
  CheckCircle2, XCircle, Clock, Ban, Star, ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Partner {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  type: string;
  status: "PENDING" | "APPROVED" | "SUSPENDED";
  referralCode: string;
  commissionRate: number;
  totalEarned: number;
  totalPaid: number;
  certifiedBadge: boolean;
  createdAt: string;
  _count: { referrals: number };
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  AGENCY: "وكالة",
  FREELANCER: "فريلانسر",
  RESELLER: "موزع",
  TECHNOLOGY: "شركة تقنية",
};

const STATUS_MAP = {
  PENDING:   { label: "بانتظار الموافقة", color: "#fbbf24", bg: "rgba(245,158,11,.12)",  icon: Clock },
  APPROVED:  { label: "موافق عليه",       color: "#34d399", bg: "rgba(52,211,153,.12)",  icon: CheckCircle2 },
  SUSPENDED: { label: "موقوف",            color: "#f87171", bg: "rgba(239,68,68,.12)",   icon: Ban },
};

const PARTNER_TYPES = ["AGENCY", "FREELANCER", "RESELLER", "TECHNOLOGY"];
const PLAN_LABELS: Record<string, string> = { AGENCY: "وكالة", FREELANCER: "فريلانسر", RESELLER: "موزع", TECHNOLOGY: "تقنية" };

const EMPTY_FORM = {
  companyName: "", contactName: "", email: "", phone: "", website: "",
  type: "AGENCY", commissionRate: "20",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pendingAmount(p: Partner) {
  return Math.max(0, Number(p.totalEarned) - Number(p.totalPaid));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PartnersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | "pay" | null>(null);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ companyName: "", contactName: "", commissionRate: "", certifiedBadge: false, status: "" });
  const [payAmount, setPayAmount] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ partners: Partner[]; stats: Stats }>({
    queryKey: ["admin-partners", statusFilter],
    queryFn: () => api.get(`/admin/partners${statusFilter ? `?status=${statusFilter}` : ""}`).then(r => r.data),
  });

  const partners = data?.partners ?? [];
  const stats = data?.stats;

  const createMut = useMutation({
    mutationFn: (d: typeof EMPTY_FORM) => api.post("/admin/partners", { ...d, commissionRate: parseFloat(d.commissionRate) / 100 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-partners"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: typeof editForm & { id: string }) =>
      api.patch(`/admin/partners/${id}`, { ...d, commissionRate: parseFloat(d.commissionRate) / 100 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-partners"] }); closeModal(); },
  });

  const payMut = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) =>
      api.post(`/admin/partners/${id}/pay`, { amount: parseFloat(amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-partners"] }); setModal(null); setPayAmount(""); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/partners/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partners"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/partners/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-partners"] }); setDelId(null); },
  });

  function openEdit(p: Partner) {
    setSelected(p);
    setEditForm({
      companyName: p.companyName,
      contactName: p.contactName,
      commissionRate: String(Math.round(Number(p.commissionRate) * 100)),
      certifiedBadge: p.certifiedBadge,
      status: p.status,
    });
    setModal("edit");
  }

  function openPay(p: Partner) {
    setSelected(p);
    setPayAmount(String(pendingAmount(p)));
    setModal("pay");
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setForm(EMPTY_FORM);
    setPayAmount("");
  }

  return (
    <div className="p-6 min-h-screen" style={{ background: "#060b18" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.25)" }}>
            <Handshake className="w-5 h-5" style={{ color: "#fbbf24" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#dce8f5" }}>برنامج الشركاء</h1>
            <p className="text-xs" style={{ color: "#4a6480" }}>الوكالات والمطورين الشركاء للمنصة</p>
          </div>
        </div>
        <button onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#3b82f6", color: "#fff" }}>
          <Plus className="w-4 h-4" /> شريك جديد
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "إجمالي", value: stats.total, color: "#dce8f5" },
            { label: "بانتظار الموافقة", value: stats.pending, color: "#fbbf24" },
            { label: "موافق عليه", value: stats.approved, color: "#34d399" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#4a6480" }}>{s.label}</p>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        {["", "PENDING", "APPROVED", "SUSPENDED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: statusFilter === s ? "#3b82f6" : "#0c1526",
              color: statusFilter === s ? "#fff" : "#4a6480",
              border: "1px solid #1a2840",
            }}>
            {s === "" ? "الكل" : STATUS_MAP[s as keyof typeof STATUS_MAP]?.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-20" style={{ color: "#4a6480" }}>جارٍ التحميل...</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-20">
          <Handshake className="w-10 h-10 mx-auto mb-3" style={{ color: "#1a2840" }} />
          <p className="text-sm" style={{ color: "#4a6480" }}>لا يوجد شركاء</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a2840" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "#0c1526" }}>
                {["الشركة", "النوع", "الحالة", "الكود", "العمولة", "المكسب / المدفوع", "إجراءات"].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs font-semibold"
                    style={{ color: "#4a6480", borderBottom: "1px solid #1a2840" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.map(p => {
                const s = STATUS_MAP[p.status];
                const pending = pendingAmount(p);
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #0f1823" }} className="hover:bg-[#0d1929]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs" style={{ color: "#dce8f5" }}>{p.companyName}</span>
                            {p.certifiedBadge && <Star className="w-3 h-3" style={{ color: "#fbbf24" }} />}
                          </div>
                          <p className="text-xs" style={{ color: "#4a6480" }}>{p.contactName}</p>
                          <p className="text-xs" style={{ color: "#4a6480" }}>{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: "rgba(99,102,241,.12)", color: "#818cf8" }}>
                        {TYPE_LABELS[p.type] ?? p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg font-semibold flex items-center gap-1 w-fit"
                        style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#60a5fa" }}>{p.referralCode}</td>
                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#dce8f5" }}>
                      {Math.round(Number(p.commissionRate) * 100)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <span style={{ color: "#34d399" }}>+{Number(p.totalEarned).toFixed(3)} BD</span>
                        <span style={{ color: "#4a6480" }}> / </span>
                        <span style={{ color: "#60a5fa" }}>{Number(p.totalPaid).toFixed(3)} BD</span>
                        {pending > 0 && (
                          <p style={{ color: "#fbbf24" }}>معلق: {pending.toFixed(3)} BD</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.status === "PENDING" && (
                          <button onClick={() => statusMut.mutate({ id: p.id, status: "APPROVED" })}
                            className="p-1.5 rounded-lg" title="قبول"
                            style={{ background: "rgba(52,211,153,.1)", color: "#34d399" }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {p.status === "APPROVED" && pending > 0 && (
                          <button onClick={() => openPay(p)}
                            className="p-1.5 rounded-lg" title="دفع العمولة"
                            style={{ background: "rgba(251,191,36,.1)", color: "#fbbf24" }}>
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg" title="تعديل"
                          style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa" }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDelId(p.id)}
                          className="p-1.5 rounded-lg" title="حذف"
                          style={{ background: "rgba(239,68,68,.1)", color: "#f87171" }}>
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

      {/* Create Modal */}
      {modal === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>إضافة شريك جديد</h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>اسم الشركة</label>
                  <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>اسم التواصل</label>
                  <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>البريد الإلكتروني</label>
                <input value={form.email} type="email" onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>النوع</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}>
                    {PARTNER_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>نسبة العمولة %</label>
                  <input value={form.commissionRate} type="number" min="0" max="100"
                    onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الهاتف (اختياري)</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الموقع الإلكتروني</label>
                  <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                  style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
                <button onClick={() => createMut.mutate(form)}
                  disabled={!form.companyName || !form.email || createMut.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: "#3b82f6", color: "#fff", opacity: (!form.companyName || !form.email) ? .5 : 1 }}>
                  {createMut.isPending ? "جارٍ الإضافة..." : "إضافة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modal === "edit" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>تعديل الشريك</h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>اسم الشركة</label>
                <input value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>نسبة العمولة %</label>
                <input value={editForm.commissionRate} type="number" min="0" max="100"
                  onChange={e => setEditForm(f => ({ ...f, commissionRate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>الحالة</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }}>
                  <option value="PENDING">بانتظار الموافقة</option>
                  <option value="APPROVED">موافق عليه</option>
                  <option value="SUSPENDED">موقوف</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: "#94a3b8" }}>شارة معتمد</span>
                <button onClick={() => setEditForm(f => ({ ...f, certifiedBadge: !f.certifiedBadge }))}
                  className="relative inline-flex w-10 h-5 rounded-full"
                  style={{ background: editForm.certifiedBadge ? "#fbbf24" : "#1a2840" }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: editForm.certifiedBadge ? "calc(100% - 18px)" : "2px" }} />
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                  style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
                <button onClick={() => selected && updateMut.mutate({ ...editForm, id: selected.id })}
                  disabled={updateMut.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl"
                  style={{ background: "#3b82f6", color: "#fff" }}>
                  {updateMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {modal === "pay" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: "#dce8f5" }}>تسجيل دفعة عمولة</h2>
              <button onClick={closeModal}><X className="w-5 h-5" style={{ color: "#4a6480" }} /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: "#64748b" }}>
              الشريك: <span style={{ color: "#dce8f5" }}>{selected.companyName}</span>
              <br />المبلغ المعلق: <span style={{ color: "#fbbf24" }}>{pendingAmount(selected).toFixed(3)} BD</span>
            </p>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>المبلغ المدفوع (BHD)</label>
              <input value={payAmount} type="number" step="0.001" min="0"
                onChange={e => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl"
                style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
              <button onClick={() => payMut.mutate({ id: selected.id, amount: payAmount })}
                disabled={!payAmount || payMut.isPending}
                className="px-5 py-2 text-sm font-semibold rounded-xl"
                style={{ background: "#fbbf24", color: "#000" }}>
                {payMut.isPending ? "جارٍ التسجيل..." : "تأكيد الدفع"}
              </button>
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
            <h3 className="font-bold mb-2" style={{ color: "#dce8f5" }}>حذف الشريك؟</h3>
            <p className="text-sm mb-5" style={{ color: "#64748b" }}>ستحذف بيانات الشريك وجميع الإحالات.</p>
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
