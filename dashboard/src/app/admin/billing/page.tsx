"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Search, FileText, CheckCircle2, Clock, AlertTriangle, XCircle,
  RefreshCw, X, ChevronLeft, ChevronRight, TrendingUp, DollarSign,
  Ban, BadgeCheck, Percent, Plus, ExternalLink,
} from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  plan: string;
  amountBD: number; // will come as string from Decimal
  discountBD: number | null;
  discountNote: string | null;
  status: string;
  paidAt: string | null;
  paymentRef: string | null;
  notes: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  store: {
    id: string;
    name: string;
    nameAr: string;
    subdomain: string;
    plan: string;
    merchant: { id: string; firstName: string; lastName: string; email: string };
  };
}

interface BillingData {
  invoices: Invoice[];
  total: number;
  page: number;
  pages: number;
  stats: { paid: number; pending: number; overdue: number; cancelled: number };
}

interface RevenueData {
  monthly: { month: string; paid: number; pending: number; overdue: number; cancelled: number }[];
  totals: { paid: number; pending: number; overdue: number; cancelled: number };
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  PAID:      { bg: "rgba(16,185,129,.12)",  color: "#34d399", label: "مدفوعة",    icon: CheckCircle2 },
  PENDING:   { bg: "rgba(245,158,11,.12)",  color: "#fbbf24", label: "معلقة",     icon: Clock },
  OVERDUE:   { bg: "rgba(239,68,68,.12)",   color: "#f87171", label: "متأخرة",    icon: AlertTriangle },
  CANCELLED: { bg: "rgba(100,116,139,.12)", color: "#94a3b8", label: "ملغاة",     icon: XCircle },
  WAIVED:    { bg: "rgba(139,92,246,.12)",  color: "#a78bfa", label: "معفاة",     icon: CheckCircle2 },
};

const PLAN_COLOR: Record<string, string> = {
  STARTER: "#94a3b8", GROWTH: "#60a5fa", PRO: "#a78bfa", ENTERPRISE: "#fbbf24",
};

const PLAN_AR: Record<string, string> = {
  STARTER: "مجاني", GROWTH: "نمو", PRO: "احترافي", ENTERPRISE: "مؤسسي",
};

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS_AR[parseInt(m) - 1]} ${y}`;
}

export default function BillingPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<Invoice | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ storeId: "", amountBD: "", notes: "" });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading } = useQuery<BillingData>({
    queryKey: ["admin-billing-invoices", page, statusFilter, search],
    queryFn: () => api.get(`/admin/billing/invoices?${params}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: revenueData } = useQuery<RevenueData>({
    queryKey: ["admin-billing-revenue"],
    queryFn: () => api.get("/admin/billing/revenue-report").then((r) => r.data),
  });

  const updateInvoice = useMutation({
    mutationFn: ({ id, ...body }: any) => api.patch(`/admin/billing/invoices/${id}`, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-billing-invoices"] });
      setDrawer(res.data.invoice);
      showToast("تم تحديث الفاتورة ✅");
      setDiscountAmount("");
      setDiscountNote("");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const createInvoice = useMutation({
    mutationFn: (body: any) => api.post("/admin/billing/invoices", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-billing-invoices"] });
      setShowCreateModal(false);
      setNewInvoice({ storeId: "", amountBD: "", notes: "" });
      showToast("تم إنشاء الفاتورة ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const invoices = data?.invoices ?? [];
  const stats = data?.stats ?? { paid: 0, pending: 0, overdue: 0, cancelled: 0 };
  const monthly = revenueData?.monthly ?? [];
  const maxBar = Math.max(...monthly.map((m) => m.paid + m.pending + m.overdue), 1);

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slide-in { from{transform:translateX(100%)} to{transform:translateX(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .drawer-anim { animation: slide-in .25s ease; }
        .row-hover:hover { background: rgba(255,255,255,.03) !important; cursor: pointer; }
      `}</style>

      {toast && (
        <div className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}>
          {toast.msg}
        </div>
      )}

      {/* Side Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex" style={{ background: "rgba(0,0,0,.6)" }} onClick={() => setDrawer(null)}>
          <div className="drawer-anim ml-auto w-full max-w-md h-full overflow-y-auto p-5 space-y-4"
            style={{ background: "#0c1526", borderLeft: "1px solid #1a2840" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg" style={{ color: "#e2eef8" }}>{drawer.invoiceNumber}</h2>
              <button onClick={() => setDrawer(null)} style={{ color: "#4a6480" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status badge */}
            {(() => {
              const s = STATUS_STYLE[drawer.status] ?? STATUS_STYLE.PENDING;
              const Icon = s.icon;
              return (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: s.bg }}>
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-sm font-bold" style={{ color: s.color }}>{s.label}</span>
                </div>
              );
            })()}

            {/* Invoice details */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#060b18", border: "1px solid #0f1a2d" }}>
              {[
                { label: "المتجر", value: drawer.store.nameAr || drawer.store.name },
                { label: "التاجر", value: `${drawer.store.merchant.firstName} ${drawer.store.merchant.lastName}` },
                { label: "البريد", value: drawer.store.merchant.email },
                { label: "الباقة", value: PLAN_AR[drawer.plan] ?? drawer.plan, color: PLAN_COLOR[drawer.plan] },
                { label: "المبلغ", value: `${Number(drawer.amountBD).toFixed(3)} BD`, color: "#34d399" },
                ...(drawer.discountBD ? [{ label: "الخصم", value: `-${Number(drawer.discountBD).toFixed(3)} BD`, color: "#f87171" }] : []),
                { label: "الفترة", value: `${formatDate(drawer.periodStart)} — ${formatDate(drawer.periodEnd)}` },
                { label: "إنشاء", value: formatDate(drawer.createdAt) },
                ...(drawer.paidAt ? [{ label: "سُدّد", value: formatDate(drawer.paidAt) }] : []),
                ...(drawer.paymentRef ? [{ label: "مرجع الدفع", value: drawer.paymentRef }] : []),
                ...(drawer.notes ? [{ label: "ملاحظات", value: drawer.notes }] : []),
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-semibold flex-shrink-0" style={{ color: "#2d4560" }}>{label}</p>
                  <p className="text-xs font-medium text-left" style={{ color: color ?? "#8aa8c4" }}>{value}</p>
                </div>
              ))}
            </div>

            <Link href={`/admin/stores/${drawer.store.id}`}
              className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#60a5fa" }}>
              <ExternalLink className="w-3.5 h-3.5" /> عرض المتجر
            </Link>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-semibold" style={{ color: "#2d4560" }}>إجراءات</p>

              {drawer.status !== "PAID" && (
                <button
                  onClick={() => updateInvoice.mutate({ id: drawer.id, action: "markPaid" })}
                  disabled={updateInvoice.isPending}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}
                >
                  <BadgeCheck className="w-4 h-4" /> تسجيل كمدفوعة
                </button>
              )}

              {drawer.status !== "OVERDUE" && drawer.status !== "PAID" && (
                <button
                  onClick={() => updateInvoice.mutate({ id: drawer.id, action: "markOverdue" })}
                  disabled={updateInvoice.isPending}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", color: "#fbbf24" }}
                >
                  <AlertTriangle className="w-4 h-4" /> وضع كمتأخرة
                </button>
              )}

              {drawer.status !== "CANCELLED" && (
                <button
                  onClick={() => updateInvoice.mutate({ id: drawer.id, action: "cancel" })}
                  disabled={updateInvoice.isPending}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171" }}
                >
                  <Ban className="w-4 h-4" /> إلغاء الفاتورة
                </button>
              )}

              {/* Discount */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: "#060b18", border: "1px solid #0f1a2d" }}>
                <p className="text-xs font-bold" style={{ color: "#4a6480" }}>إضافة خصم يدوي</p>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="المبلغ (BD)"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#c8ddf0" }}
                />
                <input
                  type="text"
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                  placeholder="سبب الخصم..."
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#c8ddf0" }}
                />
                <button
                  onClick={() => updateInvoice.mutate({ id: drawer.id, action: "discount", discountBD: parseFloat(discountAmount), discountNote })}
                  disabled={updateInvoice.isPending || !discountAmount}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.2)", color: "#a78bfa" }}
                >
                  <Percent className="w-4 h-4" /> تطبيق الخصم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.75)" }}
          onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black" style={{ color: "#e2eef8" }}>إنشاء فاتورة يدوية</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ color: "#4a6480" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {[
              { key: "storeId", label: "معرّف المتجر (ID)", placeholder: "clxxxxxxxx" },
              { key: "amountBD", label: "المبلغ (BD)", placeholder: "0.000", type: "number" },
              { key: "notes", label: "ملاحظات", placeholder: "اختياري..." },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a6480" }}>{label}</label>
                <input
                  type={type ?? "text"}
                  value={(newInvoice as any)[key]}
                  onChange={(e) => setNewInvoice((n) => ({ ...n, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}
                />
              </div>
            ))}
            <button
              onClick={() => createInvoice.mutate({ storeId: newInvoice.storeId, amountBD: parseFloat(newInvoice.amountBD), notes: newInvoice.notes || undefined })}
              disabled={createInvoice.isPending || !newInvoice.storeId || !newInvoice.amountBD}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa" }}
            >
              {createInvoice.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إنشاء الفاتورة
            </button>
          </div>
        </div>
      )}

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>الفواتير</h1>
            <p className="text-sm mt-1" style={{ color: "#3d5470" }}>إدارة كل فواتير الاشتراك</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa" }}
          >
            <Plus className="w-4 h-4" /> فاتورة يدوية
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["PAID", "PENDING", "OVERDUE", "CANCELLED"] as const).map((key) => {
            const { bg, color, label, icon: Icon } = STATUS_STYLE[key];
            const value = stats[key.toLowerCase() as keyof typeof stats];
            return (
              <div key={label} className="rounded-2xl p-4 space-y-1" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>{label}</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                </div>
                <p className="text-xl font-black" style={{ color }}>{Number(value).toFixed(3)} BD</p>
              </div>
            );
          })}
        </div>

        {/* Revenue Chart */}
        {monthly.length > 0 && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "#34d399" }} />
              <p className="text-sm font-black" style={{ color: "#c8ddf0" }}>تقرير الإيرادات — آخر 12 شهر</p>
            </div>
            <div className="flex items-end gap-1.5 h-28">
              {monthly.map((m) => {
                const total = m.paid + m.pending + m.overdue;
                const barH = total > 0 ? Math.round((total / maxBar) * 100) : 2;
                const paidH = total > 0 ? Math.round((m.paid / maxBar) * 100) : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap"
                      style={{ background: "#1a2840", color: "#c8ddf0" }}>
                      {m.paid.toFixed(2)} BD مدفوع
                    </div>
                    <div className="w-full rounded-t-sm relative" style={{ height: `${barH}%`, background: "rgba(59,130,246,.15)" }}>
                      <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${(paidH / Math.max(barH, 1)) * 100}%`, background: "#10b981" }} />
                    </div>
                    <p className="text-[8px]" style={{ color: "#2d4560" }}>{monthLabel(m.month).split(" ")[0].slice(0, 3)}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px]" style={{ color: "#3d5470" }}>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#10b981" }} /> مدفوعة</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(59,130,246,.15)" }} /> إجمالي</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#2d4560" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ابحث بالفاتورة أو المتجر..."
              className="w-full pr-9 pl-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#c8ddf0" }}
            />
          </div>
          <div className="flex gap-1.5">
            {["ALL", "PAID", "PENDING", "OVERDUE", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold transition"
                style={{
                  background: statusFilter === s ? (STATUS_STYLE[s]?.bg ?? "rgba(59,130,246,.15)") : "rgba(255,255,255,.03)",
                  border: `1px solid ${statusFilter === s ? (STATUS_STYLE[s]?.color ?? "#60a5fa") + "40" : "rgba(255,255,255,.06)"}`,
                  color: statusFilter === s ? (STATUS_STYLE[s]?.color ?? "#60a5fa") : "#3d5470",
                }}
              >
                {s === "ALL" ? "الكل" : STATUS_STYLE[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
          {isLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
              <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد فواتير</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #1a2840" }}>
                  {["رقم الفاتورة", "المتجر", "الباقة", "المبلغ", "الحالة", "الفترة", "التاريخ"].map((h) => (
                    <th key={h} className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "#2d4560" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const s = STATUS_STYLE[inv.status] ?? STATUS_STYLE.PENDING;
                  const SIcon = s.icon;
                  return (
                    <tr key={inv.id} className="row-hover transition" style={{ borderBottom: "1px solid #0f1a2d" }}
                      onClick={() => setDrawer(inv)}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold" style={{ color: "#60a5fa" }}>{inv.invoiceNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold" style={{ color: "#c8ddf0" }}>{inv.store.nameAr || inv.store.name}</p>
                        <p className="text-[10px]" style={{ color: "#2d4560" }}>{inv.store.merchant.firstName} {inv.store.merchant.lastName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: PLAN_COLOR[inv.plan] + "18", color: PLAN_COLOR[inv.plan] }}>
                          {PLAN_AR[inv.plan] ?? inv.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-black" style={{ color: "#34d399" }}>{Number(inv.amountBD).toFixed(3)} BD</p>
                        {inv.discountBD && (
                          <p className="text-[10px]" style={{ color: "#f87171" }}>-{Number(inv.discountBD).toFixed(3)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 w-fit text-[10px] font-bold px-2 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color }}>
                          <SIcon className="w-3 h-3" />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[10px]" style={{ color: "#3d5470" }}>
                          {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[10px]" style={{ color: "#3d5470" }}>{formatDate(inv.createdAt)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#2d4560" }}>
              صفحة {data?.page} من {data?.pages} — {data?.total} فاتورة
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-xl disabled:opacity-30" style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))} disabled={page === (data?.pages ?? 1)}
                className="p-2 rounded-xl disabled:opacity-30" style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
