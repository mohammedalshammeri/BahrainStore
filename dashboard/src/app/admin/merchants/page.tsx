"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Search, Users, Store, ShieldCheck, ShieldOff,
  ChevronLeft, ChevronRight, Crown, Ban,
  UserCheck, UserX, ArrowUpRight, X, Phone,
  Mail, Calendar, Eye, MoreHorizontal, RefreshCw,
  CheckCircle2, XCircle, Download, Filter,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminMerchant {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  _count: { stores: number };
}

interface AdminStats {
  totalMerchants: number;
  newMerchantsThisWeek: number;
  totalStores: number;
}

const AVATAR_COLORS = [
  ["#1e3a5f", "#60a5fa"],
  ["#1a3a2e", "#34d399"],
  ["#3b1f2b", "#f472b6"],
  ["#2d2a1a", "#fbbf24"],
  ["#1f1f3b", "#a78bfa"],
];

function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

function StatCard({ label, value, sub, subColor }: { label: string; value: string | number; sub?: string; subColor?: string }) {
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: "#0c1526", border: "1px solid #1a2840" }}
    >
      <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>
        {label}
      </p>
      <p className="text-2xl font-black" style={{ color: "#dce8f5" }}>
        {typeof value === "number" ? value.toLocaleString("ar") : value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: subColor ?? "#4a6480" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function AdminMerchantsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [selectedMerchant, setSelectedMerchant] = useState<AdminMerchant | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const qc = useQueryClient();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__adminMerchantTimer);
    (window as any).__adminMerchantTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 350);
  };

  const { data: statsData } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
    staleTime: 60_000,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-merchants", page, debouncedSearch, statusFilter, verifiedFilter],
    queryFn: async () => {
      const q = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) q.set("search", debouncedSearch);
      const res = await api.get(`/admin/merchants?${q}`);
      let merchants: AdminMerchant[] = res.data.merchants;
      if (statusFilter === "active") merchants = merchants.filter((m) => m.isActive);
      if (statusFilter === "inactive") merchants = merchants.filter((m) => !m.isActive);
      if (verifiedFilter === "verified") merchants = merchants.filter((m) => m.isVerified);
      if (verifiedFilter === "unverified") merchants = merchants.filter((m) => !m.isVerified);
      return { ...res.data, merchants };
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/merchants/${id}`, { isActive }),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      if (selectedMerchant) setSelectedMerchant({ ...selectedMerchant, isActive });
      showToast(isActive ? "تم تفعيل الحساب ✅" : "تم تعطيل الحساب");
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      api.patch(`/admin/merchants/${id}`, { isAdmin }),
    onSuccess: (_, { isAdmin }) => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      if (selectedMerchant) setSelectedMerchant({ ...selectedMerchant, isAdmin });
      showToast(isAdmin ? "تم منح صلاحية المشرف 🛡️" : "تم سحب صلاحية المشرف");
    },
  });

  const activeCount = statsData ? statsData.totalMerchants - 1 : 0;

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        .m-row:hover { background: rgba(59,130,246,.04) !important; cursor: pointer; }
        .filter-btn { transition: all .15s; }
        .filter-btn:hover { background: rgba(59,130,246,.08); color: #93c5fd; }
        .filter-btn.active-filter { background: rgba(59,130,246,.15); color: #60a5fa; }
        @keyframes slide-in { from { transform: translateX(-100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        .drawer { animation: slide-in .22s cubic-bezier(.4,0,.2,1); }
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "#fff",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "#e2eef8" }}>التجار</h1>
            <p className="text-sm mt-0.5" style={{ color: "#3d5470" }}>
              إدارة جميع التجار المسجلين في المنصة
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition"
              style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="إجمالي التجار" value={statsData?.totalMerchants ?? data?.total ?? 0} sub="منذ إطلاق المنصة" />
          <StatCard label="جدد هذا الأسبوع" value={statsData?.newMerchantsThisWeek ?? 0} sub="تسجيل جديد" subColor="#34d399" />
          <StatCard label="إجمالي المتاجر" value={statsData?.totalStores ?? 0} sub="عبر جميع التجار" />
          <StatCard label="الصفحة الحالية" value={`${page} / ${data?.pages ?? 1}`} sub={`${data?.total ?? 0} تاجر`} />
        </div>

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-3 p-3 rounded-2xl"
          style={{ background: "#0c1526", border: "1px solid #1a2840" }}
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "#2d4560" }}
            />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ابحث بالاسم أو البريد أو الهاتف..."
              className="w-full pr-10 pl-4 py-2 text-sm rounded-xl focus:outline-none"
              style={{
                background: "#060b18",
                border: "1px solid #1a2840",
                color: "#c0d4ea",
              }}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "#060b18", border: "1px solid #1a2840" }}>
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === f ? "active-filter" : ""}`}
                style={{ color: statusFilter === f ? "#60a5fa" : "#4a6480" }}
              >
                {f === "all" ? "الكل" : f === "active" ? "نشط" : "موقوف"}
              </button>
            ))}
          </div>

          {/* Verified filter */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "#060b18", border: "1px solid #1a2840" }}>
            {(["all", "verified", "unverified"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setVerifiedFilter(f)}
                className={`filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold ${verifiedFilter === f ? "active-filter" : ""}`}
                style={{ color: verifiedFilter === f ? "#60a5fa" : "#4a6480" }}
              >
                {f === "all" ? "كل التوثيق" : f === "verified" ? "موثق" : "غير موثق"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a2840" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr style={{ background: "#0a1525", borderBottom: "1px solid #1a2840" }}>
                  {["التاجر", "التواصل", "المتاجر", "التوثيق", "الانتساب", "الحالة", ""].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-right text-[11px] font-black uppercase tracking-widest"
                      style={{ color: "#2d4560" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array(8).fill(0).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1a2840" }}>
                      {Array(7).fill(0).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div
                            className="h-4 rounded-lg"
                            style={{ background: "rgba(255,255,255,.04)", animation: "pulse 1.5s ease-in-out infinite" }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                  : data?.merchants.map((m: AdminMerchant) => {
                    const [bgC, txtC] = avatarColor(m.firstName);
                    return (
                      <tr
                        key={m.id}
                        className="m-row transition-colors"
                        onClick={() => setSelectedMerchant(m)}
                        style={{ borderBottom: "1px solid #111d2e", background: "#060b18" }}
                      >
                        {/* Merchant */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl text-xs font-black flex items-center justify-center flex-shrink-0"
                              style={{ background: bgC, color: txtC }}
                            >
                              {m.firstName[0]}{m.lastName[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[13px]" style={{ color: "#c8ddf0" }}>
                                  {m.firstName} {m.lastName}
                                </span>
                                {m.isAdmin && (
                                  <span
                                    className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{ background: "rgba(245,158,11,.15)", color: "#fbbf24" }}
                                  >
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px]" style={{ color: "#2d4560" }}>
                                {m.id.slice(0, 8)}…
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-5 py-4">
                          <p className="font-mono text-[11px]" style={{ color: "#4a6480" }}>{m.email}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "#2d4560" }}>{m.phone ?? "—"}</p>
                        </td>

                        {/* Stores count */}
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa" }}
                          >
                            <Store className="w-3 h-3" />
                            {m._count.stores}
                          </span>
                        </td>

                        {/* Verified */}
                        <td className="px-5 py-4">
                          {m.isVerified ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#34d399" }}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> موثق
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#2d4560" }}>
                              <XCircle className="w-3.5 h-3.5" /> غير موثق
                            </span>
                          )}
                        </td>

                        {/* Join date */}
                        <td className="px-5 py-4 text-[11px]" style={{ color: "#2d4560" }}>
                          {formatDate(m.createdAt)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background: m.isActive ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
                              color: m.isActive ? "#34d399" : "#f87171",
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: m.isActive ? "#10b981" : "#ef4444" }}
                            />
                            {m.isActive ? "نشط" : "موقوف"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/admin/merchants/${m.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition"
                            style={{ background: "rgba(59,130,246,.08)", color: "#60a5fa" }}
                          >
                            <Eye className="w-3 h-3" />
                            تفاصيل
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Empty */}
          {!isLoading && data?.merchants.length === 0 && (
            <div className="py-20 text-center" style={{ background: "#060b18" }}>
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
              <p style={{ color: "#2d4560" }}>لا يوجد تجار بهذه الفلاتر</p>
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid #1a2840", background: "#0a1525" }}
            >
              <p className="text-xs" style={{ color: "#2d4560" }}>
                صفحة {page} من {data.pages} — {data.total} تاجر
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl transition disabled:opacity-30"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="p-2 rounded-xl transition disabled:opacity-30"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#4a6480" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Side Drawer ─── */}
      {selectedMerchant && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setSelectedMerchant(null)}
          />
          {/* Drawer */}
          <div
            className="drawer fixed left-0 top-0 bottom-0 z-50 overflow-y-auto"
            style={{
              width: 360,
              background: "#0a1120",
              borderRight: "1px solid #1a2840",
              boxShadow: "4px 0 40px rgba(0,0,0,.6)",
            }}
            dir="rtl"
          >
            {/* Drawer Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
              style={{ background: "#0a1120", borderBottom: "1px solid #1a2840" }}
            >
              <p className="font-black text-sm" style={{ color: "#e2eef8" }}>تفاصيل التاجر</p>
              <button onClick={() => setSelectedMerchant(null)} style={{ color: "#3d5068" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Avatar + Name */}
              {(() => {
                const [bgC, txtC] = avatarColor(selectedMerchant.firstName);
                return (
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0"
                      style={{ background: bgC, color: txtC }}
                    >
                      {selectedMerchant.firstName[0]}{selectedMerchant.lastName[0]}
                    </div>
                    <div>
                      <p className="font-black text-base" style={{ color: "#dce8f5" }}>
                        {selectedMerchant.firstName} {selectedMerchant.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{
                            background: selectedMerchant.isActive ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)",
                            color: selectedMerchant.isActive ? "#34d399" : "#f87171",
                          }}
                        >
                          {selectedMerchant.isActive ? "نشط" : "موقوف"}
                        </span>
                        {selectedMerchant.isAdmin && (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(245,158,11,.15)", color: "#fbbf24" }}
                          >
                            مشرف المنصة
                          </span>
                        )}
                        {selectedMerchant.isVerified && (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(59,130,246,.15)", color: "#60a5fa" }}
                          >
                            موثق
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Info */}
              <div className="space-y-3 rounded-xl p-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                {[
                  { icon: Mail, label: "البريد", value: selectedMerchant.email },
                  { icon: Phone, label: "الهاتف", value: selectedMerchant.phone ?? "—" },
                  { icon: Calendar, label: "الانتساب", value: formatDate(selectedMerchant.createdAt) },
                  { icon: Store, label: "عدد المتاجر", value: `${selectedMerchant._count.stores} متجر` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "#2d4560" }} />
                    <div>
                      <p className="text-[10px] font-semibold" style={{ color: "#2d4560" }}>{label}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: "#8aa8c4" }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#2d4560" }}>إجراءات</p>

                <button
                  onClick={() => toggleActive.mutate({ id: selectedMerchant.id, isActive: !selectedMerchant.isActive })}
                  disabled={toggleActive.isPending || selectedMerchant.isAdmin}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition disabled:opacity-40"
                  style={{
                    background: selectedMerchant.isActive ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.08)",
                    border: `1px solid ${selectedMerchant.isActive ? "rgba(239,68,68,.2)" : "rgba(16,185,129,.2)"}`,
                    color: selectedMerchant.isActive ? "#f87171" : "#34d399",
                  }}
                >
                  {selectedMerchant.isActive
                    ? <><Ban className="w-4 h-4" /> تعطيل الحساب</>
                    : <><UserCheck className="w-4 h-4" /> تفعيل الحساب</>}
                </button>

                <button
                  onClick={() => toggleAdmin.mutate({ id: selectedMerchant.id, isAdmin: !selectedMerchant.isAdmin })}
                  disabled={toggleAdmin.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition"
                  style={{
                    background: selectedMerchant.isAdmin ? "rgba(239,68,68,.06)" : "rgba(245,158,11,.08)",
                    border: `1px solid ${selectedMerchant.isAdmin ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.2)"}`,
                    color: selectedMerchant.isAdmin ? "#f87171" : "#fbbf24",
                  }}
                >
                  {selectedMerchant.isAdmin
                    ? <><UserX className="w-4 h-4" /> سحب صلاحية المشرف</>
                    : <><Crown className="w-4 h-4" /> منح صلاحية المشرف</>}
                </button>

                <Link
                  href={`/admin/merchants/${selectedMerchant.id}`}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition"
                  style={{
                    background: "rgba(59,130,246,.08)",
                    border: "1px solid rgba(59,130,246,.2)",
                    color: "#60a5fa",
                  }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  عرض الملف الكامل
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
