"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Users, Gift, Clock, CheckCircle2, Star, RefreshCw, DollarSign,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MerchantReferral {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referredEmail: string;
  referredMerchantId: string | null;
  status: "PENDING" | "REGISTERED" | "REWARDED";
  rewardAmount: number;
  rewardedAt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  registered: number;
  rewarded: number;
}

// ─── Status Map ───────────────────────────────────────────────────────────────

const STATUS_MAP = {
  PENDING:    { label: "مدعو",         color: "#fbbf24", bg: "rgba(245,158,11,.12)",  icon: Clock },
  REGISTERED: { label: "سجّل حساب",   color: "#60a5fa",  bg: "rgba(59,130,246,.12)", icon: CheckCircle2 },
  REWARDED:   { label: "حصل على مكافأة", color: "#34d399", bg: "rgba(52,211,153,.12)", icon: Gift },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MerchantReferralsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rewardModal, setRewardModal] = useState<MerchantReferral | null>(null);
  const [rewardAmount, setRewardAmount] = useState("5");

  const { data, isLoading } = useQuery<{ referrals: MerchantReferral[]; total: number; stats: Stats; page: number }>({
    queryKey: ["admin-merchant-referrals", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      return api.get(`/admin/merchant-referrals?${params.toString()}`).then(r => r.data);
    },
  });

  const referrals = data?.referrals ?? [];
  const stats = data?.stats;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  const rewardMut = useMutation({
    mutationFn: ({ id, rewardAmount }: { id: string; rewardAmount: string }) =>
      api.patch(`/admin/merchant-referrals/${id}/reward`, { rewardAmount: parseFloat(rewardAmount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-merchant-referrals"] });
      setRewardModal(null);
    },
  });

  return (
    <div className="p-6 min-h-screen" style={{ background: "#060b18" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(96,165,250,.12)", border: "1px solid rgba(96,165,250,.25)" }}>
            <Users className="w-5 h-5" style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#dce8f5" }}>إحالات التجار</h1>
            <p className="text-xs" style={{ color: "#4a6480" }}>تاجر يدعو تاجراً ويحصل على مكافأة</p>
          </div>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["admin-merchant-referrals"] })}
          className="p-2 rounded-xl"
          style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "إجمالي الإحالات", value: stats.total, color: "#dce8f5" },
            { label: "مدعو (لم يسجل)", value: stats.pending, color: "#fbbf24" },
            { label: "سجّل حساباً", value: stats.registered, color: "#60a5fa" },
            { label: "حصل على مكافأة", value: stats.rewarded, color: "#34d399" },
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
        {["", "PENDING", "REGISTERED", "REWARDED"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
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
      ) : referrals.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#1a2840" }} />
          <p className="text-sm" style={{ color: "#4a6480" }}>لا توجد إحالات</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid #1a2840" }}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: "#0c1526" }}>
                  {["المُحيل", "المدعو", "الحالة", "المكافأة", "تاريخ الدعوة", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#4a6480", borderBottom: "1px solid #1a2840" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => {
                  const s = STATUS_MAP[r.status];
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #0f1823" }} className="hover:bg-[#0d1929]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-xs" style={{ color: "#dce8f5" }}>{r.referrerName || "—"}</p>
                        <p className="text-xs" style={{ color: "#4a6480" }}>{r.referrerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>
                        {r.referredEmail}
                        {r.referredMerchantId && (
                          <p className="text-xs" style={{ color: "#34d399" }}>✓ مسجّل</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-lg font-semibold"
                          style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#34d399" }}>
                        {r.rewardAmount > 0 ? `${Number(r.rewardAmount).toFixed(3)} BD` : "—"}
                        {r.rewardedAt && <p className="text-xs font-normal" style={{ color: "#4a6480" }}>{formatDate(r.rewardedAt)}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#4a6480" }}>
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "REGISTERED" && (
                          <button onClick={() => { setRewardModal(r); setRewardAmount("5"); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: "rgba(52,211,153,.12)", color: "#34d399" }}>
                            <Gift className="w-3.5 h-3.5" /> منح مكافأة
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "#4a6480" }}>
                {total.toLocaleString("ar")} إحالة — صفحة {page} من {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: page <= 1 ? "#1a2840" : "#94a3b8" }}>
                  السابق
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: page >= totalPages ? "#1a2840" : "#94a3b8" }}>
                  التالي
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reward Modal */}
      {rewardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <h3 className="font-bold mb-2" style={{ color: "#dce8f5" }}>منح مكافأة</h3>
            <p className="text-sm mb-4" style={{ color: "#64748b" }}>
              المُحيل: <span style={{ color: "#dce8f5" }}>{rewardModal.referrerName}</span>
              <br />دعا: <span style={{ color: "#60a5fa" }}>{rewardModal.referredEmail}</span>
            </p>
            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: "#4a6480" }}>قيمة المكافأة (BHD)</label>
              <input value={rewardAmount} type="number" step="0.001" min="0"
                onChange={e => setRewardAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "#060b18", border: "1px solid #1a2840", color: "#dce8f5" }} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRewardModal(null)} className="px-4 py-2 text-sm rounded-xl"
                style={{ background: "#1a2840", color: "#94a3b8" }}>إلغاء</button>
              <button onClick={() => rewardMut.mutate({ id: rewardModal.id, rewardAmount })}
                disabled={rewardMut.isPending}
                className="px-5 py-2 text-sm font-semibold rounded-xl"
                style={{ background: "#34d399", color: "#000" }}>
                {rewardMut.isPending ? "جارٍ المنح..." : "منح المكافأة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
