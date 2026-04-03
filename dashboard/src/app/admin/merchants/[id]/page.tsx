"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatBHD } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Mail, Phone, Calendar, Store, ShoppingBag,
  Users, Crown, Ban, UserCheck, UserX,
  CheckCircle2, XCircle, ExternalLink, RefreshCw, TrendingUp,
  KeyRound, Send, StickyNote, Trash2, Plus,
} from "lucide-react";

interface MerchantDetail {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  stores: {
    id: string;
    name: string;
    nameAr: string;
    subdomain: string;
    plan: string;
    isActive: boolean;
    _count: { orders: number; products: number; customers: number };
  }[];
  _count: { stores: number; sessions: number };
}

interface AdminNote {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.75)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "#0c1526", border: "1px solid #1a2840" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg" style={{ color: "#e2eef8" }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "#4a6480" }}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PLAN_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  STARTER:    { bg: "rgba(100,116,139,.15)", color: "#94a3b8",  label: "ستارتر" },
  GROWTH:     { bg: "rgba(59,130,246,.15)",  color: "#60a5fa",  label: "نمو" },
  PRO:        { bg: "rgba(139,92,246,.15)",  color: "#a78bfa",  label: "برو" },
  ENTERPRISE: { bg: "rgba(245,158,11,.15)",  color: "#fbbf24",  label: "مؤسسات" },
};

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

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"stores" | "notes">("stores");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [newNote, setNewNote] = useState("");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Notes ──
  const { data: notesData, refetch: refetchNotes } = useQuery<{ notes: AdminNote[] }>({
    queryKey: ["admin-merchant-notes", id],
    queryFn: () => api.get(`/admin/merchants/${id}/notes`).then((r) => r.data),
    enabled: activeTab === "notes",
  });

  const { data: merchant, isLoading } = useQuery<MerchantDetail>({
    queryKey: ["admin-merchant-detail", id],
    queryFn: () => api.get(`/admin/merchants/${id}`).then((r) => r.data.merchant),
  });

  const toggleActive = useMutation({
    mutationFn: ({ isActive }: { isActive: boolean }) =>
      api.patch(`/admin/merchants/${id}`, { isActive }),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ["admin-merchant-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      showToast(isActive ? "تم تفعيل الحساب ✅" : "تم تعطيل الحساب");
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ isAdmin }: { isAdmin: boolean }) =>
      api.patch(`/admin/merchants/${id}`, { isAdmin }),
    onSuccess: (_, { isAdmin }) => {
      qc.invalidateQueries({ queryKey: ["admin-merchant-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      showToast(isAdmin ? "تم منح صلاحية المشرف 🛡️" : "تم سحب صلاحية المشرف");
    },
  });

  const resetPassword = useMutation({
    mutationFn: () => api.post(`/admin/merchants/${id}/reset-password`),
    onSuccess: () => showToast("تم إرسال رابط إعادة التعيين للتاجر ✅"),
    onError: () => showToast("فشل إرسال الإيميل", "error"),
  });

  const sendEmail = useMutation({
    mutationFn: () => api.post(`/admin/merchants/${id}/email`, { subject: emailSubject, body: emailBody }),
    onSuccess: () => {
      showToast("تم إرسال الإيميل ✅");
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
    },
    onError: () => showToast("فشل إرسال الإيميل", "error"),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/admin/merchants/${id}/notes`, { content: newNote }),
    onSuccess: () => {
      setNewNote("");
      refetchNotes();
      showToast("تمت إضافة الملاحظة ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api.delete(`/admin/merchants/${id}/notes/${noteId}`),
    onSuccess: () => { refetchNotes(); showToast("تم حذف الملاحظة"); },
    onError: () => showToast("حدث خطأ", "error"),
  });

  if (isLoading) {
    return (
      <div
        dir="rtl"
        className="flex items-center justify-center min-h-screen"
        style={{ background: "#060b18" }}
      >
        <div className="space-y-3 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}
          >
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "#3b82f6" }} />
          </div>
          <p className="text-sm" style={{ color: "#3d5470" }}>جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-screen" style={{ background: "#060b18" }}>
        <div className="text-center space-y-4">
          <XCircle className="w-14 h-14 mx-auto" style={{ color: "#ef4444" }} />
          <p style={{ color: "#8aa8c4" }}>لم يتم العثور على التاجر</p>
          <Link href="/admin/merchants" className="text-sm" style={{ color: "#60a5fa" }}>← العودة للتجار</Link>
        </div>
      </div>
    );
  }

  const [bgC, txtC] = avatarColor(merchant.firstName);
  const totalOrders = merchant.stores?.reduce((s: number, st: any) => s + st._count.orders, 0) ?? 0;
  const totalProducts = merchant.stores?.reduce((s: number, st: any) => s + st._count.products, 0) ?? 0;
  const totalCustomers = merchant.stores?.reduce((s: number, st: any) => s + st._count.customers, 0) ?? 0;

  return (
    <div
      dir="rtl"
      style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}
    >
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .action-btn:hover { filter: brightness(1.1); }
        .tab-btn { transition: all .2s; }
      `}</style>

      {/* Email Modal */}
      {showEmailModal && (
        <Modal title="إرسال إيميل للتاجر" onClose={() => setShowEmailModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a6480" }}>الموضوع</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="موضوع الرسالة..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a6480" }}>نص الرسالة</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}
              />
            </div>
            <button
              onClick={() => sendEmail.mutate()}
              disabled={sendEmail.isPending || !emailSubject.trim() || !emailBody.trim()}
              className="action-btn w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa" }}
            >
              {sendEmail.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال الإيميل
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}
        >
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/merchants"
          className="inline-flex items-center gap-2 text-sm font-semibold transition"
          style={{ color: "#4a6480" }}
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى التجار
        </Link>

        {/* Hero Card */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: "#0c1526", border: "1px solid #1a2840" }}
        >
          {/* bg glow */}
          <div
            className="absolute top-0 right-0 w-64 h-32 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: bgC === "#1e3a5f" ? "#3b82f6" : bgC }}
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{ background: bgC, color: txtC, boxShadow: `0 0 30px ${txtC}25` }}
            >
              {merchant.firstName[0]}{merchant.lastName[0]}
            </div>

            {/* Name + badges */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>
                  {merchant.firstName} {merchant.lastName}
                </h1>
                {merchant.isAdmin && (
                  <span
                    className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(245,158,11,.15)", color: "#fbbf24" }}
                  >
                    <Crown className="w-3 h-3" /> مشرف المنصة
                  </span>
                )}
                {merchant.isVerified && (
                  <span
                    className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(59,130,246,.15)", color: "#60a5fa" }}
                  >
                    <CheckCircle2 className="w-3 h-3" /> موثق
                  </span>
                )}
                <span
                  className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{
                    background: merchant.isActive ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)",
                    color: merchant.isActive ? "#34d399" : "#f87171",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: merchant.isActive ? "#10b981" : "#ef4444" }}
                  />
                  {merchant.isActive ? "نشط" : "موقوف"}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm" style={{ color: "#4a6480" }}>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {merchant.email}
                </span>
                {merchant.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {merchant.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> انضم {formatDate(merchant.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "المتاجر", value: merchant.stores?.length ?? 0, icon: Store, color: "#3b82f6" },
            { label: "إجمالي الطلبات", value: totalOrders, icon: ShoppingBag, color: "#f59e0b" },
            { label: "إجمالي العملاء", value: totalCustomers, icon: Users, color: "#34d399" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl p-4 space-y-2"
              style={{ background: "#0c1526", border: "1px solid #1a2840" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color: "#dce8f5" }}>
                {value.toLocaleString("ar")}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Tabs */}
          <div className="lg:col-span-2 space-y-3">
            {/* Tab headers */}
            <div className="flex gap-2">
              {([{key: "stores" as const, label: "المتاجر"}, {key: "notes" as const, label: "ملاحظات داخلية 🔒"}]).map(({key, label}) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="tab-btn px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: activeTab === key ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${activeTab === key ? "rgba(59,130,246,.3)" : "rgba(255,255,255,.06)"}`,
                    color: activeTab === key ? "#60a5fa" : "#3d5470",
                  }}
                >
                  {label}
                  {key === "notes" && notesData && notesData.notes.length > 0 && (
                    <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,.25)", color: "#60a5fa" }}>
                      {notesData.notes.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Stores Tab */}
            {activeTab === "stores" && <>{(merchant.stores?.length ?? 0) === 0 ? (
              <div
                className="rounded-2xl py-12 text-center"
                style={{ background: "#0c1526", border: "1px solid #1a2840" }}
              >
                <Store className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
                <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد متاجر بعد</p>
              </div>
            ) : (
              merchant.stores?.map((store: any) => {
                const ps = PLAN_STYLE[store.plan] ?? PLAN_STYLE.STARTER;
                return (
                  <div
                    key={store.id}
                    className="rounded-2xl p-4"
                    style={{ background: "#0c1526", border: "1px solid #1a2840" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
                          style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa" }}
                        >
                          {(store.nameAr || store.name).slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color: "#c8ddf0" }}>{store.nameAr || store.name}</p>
                          <p className="font-mono text-[10px]" style={{ color: "#2d4560" }}>
                            {store.subdomain}.bazar.bh
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: ps.bg, color: ps.color }}>
                          {ps.label}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: store.isActive ? "#10b981" : "#ef4444" }}
                        />
                        <Link
                          href={`/admin/stores/${store.id}`}
                          className="p-1.5 rounded-lg transition"
                          style={{ color: "#2d4560" }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "طلب", value: store._count.orders, icon: ShoppingBag },
                        { label: "منتج", value: store._count.products, icon: TrendingUp },
                        { label: "عميل", value: store._count.customers, icon: Users },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="rounded-xl p-2 flex items-center gap-2" style={{ background: "#060b18" }}>
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2d4560" }} />
                          <div>
                            <p className="text-xs font-black" style={{ color: "#8aa8c4" }}>{value.toLocaleString("ar")}</p>
                            <p className="text-[9px]" style={{ color: "#2d4560" }}>{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}            </>
            }

            {/* Notes Tab */}
            {activeTab === "notes" && (
              <div className="space-y-3">
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="أضف ملاحظة داخلية... (لن تُرسل للتاجر)"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}
                  />
                  <button
                    onClick={() => addNote.mutate()}
                    disabled={addNote.isPending || !newNote.trim()}
                    className="action-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                    style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}
                  >
                    {addNote.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    إضافة ملاحظة
                  </button>
                </div>
                {(notesData?.notes?.length ?? 0) === 0 ? (
                  <div className="py-10 text-center rounded-2xl" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                    <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "#a78bfa" }} />
                    <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد ملاحظات بعد</p>
                  </div>
                ) : (
                  notesData?.notes.map((note) => (
                    <div key={note.id} className="rounded-2xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(139,92,246,.15)", color: "#a78bfa" }}>
                            {note.authorName[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: "#8aa8c4" }}>{note.authorName}</p>
                            <p className="text-[10px]" style={{ color: "#2d4560" }}>{formatDate(note.createdAt)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteNote.mutate(note.id)}
                          disabled={deleteNote.isPending}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-40"
                          style={{ color: "#3d5470" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "#c8ddf0" }}>{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}          </div>

          {/* Actions Panel */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#2d4560" }}>
              إجراءات الإدارة
            </p>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              {/* Toggle Active */}
              <button
                onClick={() => toggleActive.mutate({ isActive: !merchant.isActive })}
                disabled={toggleActive.isPending || merchant.isAdmin}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition disabled:opacity-40"
                style={{
                  background: merchant.isActive ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.08)",
                  border: `1px solid ${merchant.isActive ? "rgba(239,68,68,.2)" : "rgba(16,185,129,.2)"}`,
                  color: merchant.isActive ? "#f87171" : "#34d399",
                }}
              >
                {merchant.isActive
                  ? <><Ban className="w-4 h-4" /> تعطيل الحساب</>
                  : <><UserCheck className="w-4 h-4" /> تفعيل الحساب</>}
              </button>

              {/* Toggle Admin */}
              <button
                onClick={() => toggleAdmin.mutate({ isAdmin: !merchant.isAdmin })}
                disabled={toggleAdmin.isPending}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition"
                style={{
                  background: merchant.isAdmin ? "rgba(239,68,68,.06)" : "rgba(245,158,11,.08)",
                  border: `1px solid ${merchant.isAdmin ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.2)"}`,
                  color: merchant.isAdmin ? "#f87171" : "#fbbf24",
                }}
              >
                {merchant.isAdmin
                  ? <><UserX className="w-4 h-4" /> سحب صلاحية المشرف</>
                  : <><Crown className="w-4 h-4" /> منح صلاحية المشرف</>}
              </button>

              {/* Reset Password */}
              <button
                onClick={() => resetPassword.mutate()}
                disabled={resetPassword.isPending}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition disabled:opacity-40"
                style={{ background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.2)", color: "#a78bfa" }}
              >
                {resetPassword.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                إعادة تعيين كلمة المرور
              </button>

              {/* Send Email */}
              <button
                onClick={() => setShowEmailModal(true)}
                className="action-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition"
                style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}
              >
                <Send className="w-4 h-4" /> إرسال إيميل مباشر
              </button>

              {/* Divider */}
              <div className="border-t my-2" style={{ borderColor: "#1a2840" }} />

              {/* Info rows */}
              {[
                { icon: Mail, label: "البريد", value: merchant.email },
                { icon: Phone, label: "الهاتف", value: merchant.phone ?? "—" },
                { icon: Calendar, label: "الانتساب", value: formatDate(merchant.createdAt) },
                {
                  icon: merchant.isVerified ? CheckCircle2 : XCircle,
                  label: "التوثيق",
                  value: merchant.isVerified ? "موثق" : "غير موثق",
                  color: merchant.isVerified ? "#34d399" : "#2d4560",
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-start gap-3 py-1.5">
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: color ?? "#2d4560" }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold" style={{ color: "#2d4560" }}>{label}</p>
                    <p className="text-xs font-medium truncate mt-0.5" style={{ color: color ?? "#8aa8c4" }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
