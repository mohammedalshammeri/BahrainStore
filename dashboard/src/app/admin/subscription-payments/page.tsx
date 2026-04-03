"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CreditCard, AlertCircle, CheckCircle2, Clock, RefreshCw,
  Banknote, ShieldCheck, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MerchantPayment {
  id: string;
  storeId: string;
  merchantId: string;
  invoiceId: string | null;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  gatewayRef: string | null;
  retryCount: number;
  failedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  store: { name: string; slug: string; plan: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SURFACE = { background: "#0c1526", border: "1px solid #1a2840" };

const PAYMENT_STATUS: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  PENDING:  { label: "معلق",   color: "#f59e0b", bg: "rgba(245,158,11,.12)",  Icon: Clock },
  PAID:     { label: "مدفوع",  color: "#10b981", bg: "rgba(16,185,129,.12)",  Icon: CheckCircle2 },
  FAILED:   { label: "فشل",   color: "#ef4444", bg: "rgba(239,68,68,.12)",   Icon: AlertCircle },
  REFUNDED: { label: "مُسترد", color: "#8b5cf6", bg: "rgba(139,92,246,.12)",  Icon: Banknote },
};

const PLAN_COLOR: Record<string, string> = {
  STARTER: "#64748b", GROWTH: "#3b82f6", PRO: "#8b5cf6", ENTERPRISE: "#f59e0b",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-BH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Payment Row ──────────────────────────────────────────────────────────────

function PaymentRow({ p, onGrace, onMarkPaid }: { p: MerchantPayment; onGrace: (id: string, days: number) => void; onMarkPaid: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [graceDays, setGraceDays] = useState(7);
  const st = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PENDING;
  const Icon = st.Icon;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0c1526", border: p.status === "FAILED" ? "1px solid rgba(239,68,68,.3)" : "1px solid #1a2840" }}>
      <div className="p-4 flex items-center gap-3">
        <Icon size={16} style={{ color: st.color, flexShrink: 0 }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium text-sm">{p.store.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: PLAN_COLOR[p.store.plan] ?? "#64748b", background: `${PLAN_COLOR[p.store.plan] ?? "#64748b"}22` }}>
              {p.store.plan}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>{st.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
            <span className="font-mono text-slate-300">{parseFloat(p.amount).toFixed(3)} {p.currency}</span>
            {p.paymentMethod && <span>{p.paymentMethod}</span>}
            {p.retryCount > 0 && <span className="text-red-400">محاولات: {p.retryCount}</span>}
            <span>{fmtDate(p.createdAt)}</span>
            {p.gatewayRef && <code className="font-mono text-xs text-slate-600">{p.gatewayRef.slice(0, 20)}…</code>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {p.status === "FAILED" && (
            <>
              <button
                onClick={() => onMarkPaid(p.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white"
                style={{ background: "#059669" }}
              >
                <CheckCircle2 size={12} />
                تسجيل كمدفوع
              </button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded text-slate-400" style={{ background: "#131e30" }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: "1px solid #1a2840" }}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-slate-500">معرّف الدفع</p><p className="text-slate-300 font-mono mt-0.5">{p.id}</p></div>
            <div><p className="text-slate-500">معرّف المتجر</p><p className="text-slate-300 font-mono mt-0.5">{p.storeId}</p></div>
            {p.paidAt && <div><p className="text-slate-500">تاريخ الدفع</p><p className="text-emerald-400 mt-0.5">{fmtDate(p.paidAt)}</p></div>}
            {p.failedAt && <div><p className="text-slate-500">تاريخ الفشل</p><p className="text-red-400 mt-0.5">{fmtDate(p.failedAt)}</p></div>}
            {p.invoiceId && <div><p className="text-slate-500">الفاتورة</p><p className="text-slate-300 font-mono mt-0.5">{p.invoiceId}</p></div>}
          </div>

          {p.status === "FAILED" && (
            <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid #1a2840" }}>
              <Calendar size={13} className="text-amber-400" />
              <span className="text-xs text-slate-400">منح فترة Grace :</span>
              <input
                type="number"
                value={graceDays}
                onChange={(e) => setGraceDays(parseInt(e.target.value))}
                min={1} max={30}
                className="w-16 px-2 py-1 rounded text-xs text-white text-center"
                style={{ background: "#131e30", border: "1px solid #1a2840" }}
              />
              <span className="text-xs text-slate-400">يوم</span>
              <button
                onClick={() => onGrace(p.id, graceDays)}
                className="px-3 py-1 rounded text-xs font-medium text-white"
                style={{ background: "#d97706" }}
              >
                تطبيق Grace Period
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPaymentsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [storeSearch, setStoreSearch] = useState("");

  const { data, isLoading, refetch } = useQuery<{ payments: MerchantPayment[]; total: number; pages: number }>({
    queryKey: ["admin", "merchant-payments", page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      return api.get(`/admin/merchant-payments?${params}`).then((r) => r.data);
    },
  });

  const graceMut = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      api.patch(`/admin/merchant-payments/${id}/grace`, { days }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "merchant-payments"] }),
  });

  const paidMut = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/merchant-payments/${id}/paid`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "merchant-payments"] }),
  });

  const payments = data?.payments ?? [];
  const filtered = storeSearch
    ? payments.filter((p) => p.store.name.toLowerCase().includes(storeSearch.toLowerCase()) || p.store.slug.includes(storeSearch.toLowerCase()))
    : payments;

  // Summary stats
  const pending = payments.filter((p) => p.status === "PENDING").length;
  const failed  = payments.filter((p) => p.status === "FAILED").length;
  const paid    = payments.filter((p) => p.status === "PAID").length;
  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((acc, p) => acc + parseFloat(p.amount), 0);

  return (
    <div className="min-h-screen p-6" style={{ background: "#060b18", color: "#e2e8f0" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">مدفوعات الاشتراك</h1>
        <p className="text-slate-400 text-sm mt-1">تتبع مدفوعات تجديد اشتراكات التجار، Grace Period، وإدارة حالات الفشل</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "معلقة",  value: pending,  color: "#f59e0b", Icon: Clock },
          { label: "فشل",   value: failed,   color: "#ef4444", Icon: AlertCircle },
          { label: "مدفوعة", value: paid,     color: "#10b981", Icon: CheckCircle2 },
          { label: "إيراد (BHD)", value: totalRevenue.toFixed(3), color: "#3b82f6", Icon: CreditCard },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={SURFACE}>
            <div className="flex items-center gap-2 mb-2">
              <s.Icon size={16} style={{ color: s.color }} />
              <span className="text-slate-400 text-xs">{s.label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          placeholder="بحث بالمتجر..."
          value={storeSearch}
          onChange={(e) => setStoreSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white"
          style={{ background: "#0c1526", border: "1px solid #1a2840", minWidth: 180 }}
        />
        <div className="flex gap-1">
          {["", "PENDING", "FAILED", "PAID", "REFUNDED"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-3 py-2 rounded-lg text-xs"
              style={
                statusFilter === s
                  ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                  : { background: "#0c1526", color: "#64748b", border: "1px solid #1a2840" }
              }
            >
              {s || "الكل"}
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} className="p-2 rounded text-slate-500 ml-auto" style={{ background: "#0c1526" }}>
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Grace Policy reminder */}
      <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)" }}>
        <ShieldCheck size={14} className="text-amber-400 shrink-0" />
        <p className="text-amber-400/80 text-xs">
          سياسة Grace Period: 7 أيام بعد فشل الدفع — يتم إعادة المحاولة تلقائياً 3 مرات قبل تعطيل المتجر
        </p>
      </div>

      {/* Payments List */}
      {isLoading && <p className="text-slate-500 text-sm">جارٍ التحميل...</p>}
      <div className="space-y-2">
        {filtered.map((p) => (
          <PaymentRow
            key={p.id}
            p={p}
            onGrace={(id, days) => graceMut.mutate({ id, days })}
            onMarkPaid={(id) => { if (confirm("تسجيل هذا الدفع يدوياً؟")) paidMut.mutate(id); }}
          />
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">لا توجد سجلات دفع</p>
        )}
      </div>

      {/* Pagination */}
      {(data?.pages ?? 0) > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded text-xs"
            style={{ background: "#0c1526", color: "#64748b", border: "1px solid #1a2840" }}
          >
            السابق
          </button>
          <span className="px-3 py-1.5 text-xs text-slate-400">{page} / {data?.pages}</span>
          <button
            disabled={page === data?.pages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded text-xs"
            style={{ background: "#0c1526", color: "#64748b", border: "1px solid #1a2840" }}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
