"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Headphones, Search, MessageSquare, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, XCircle, AlertTriangle, Send, X, UserCheck,
  RefreshCw, Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketStats {
  open: number;
  inProgress: number;
  resolved: number;
  todayCount: number;
  urgent: number;
  avgResolveHours: number;
}

interface TicketMessage {
  id: string;
  senderType: string; // MERCHANT | ADMIN
  senderId: string;
  body: string;
  attachments: string[];
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  store: { name: string; subdomain: string } | null;
  messages: TicketMessage[];
  _count?: { messages: number };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  OPEN:             { label: "مفتوحة",        bg: "rgba(239,68,68,.12)",    color: "#f87171" },
  IN_PROGRESS:      { label: "قيد المعالجة",  bg: "rgba(245,158,11,.12)",   color: "#fbbf24" },
  WAITING_MERCHANT: { label: "انتظار التاجر", bg: "rgba(96,165,250,.12)",   color: "#60a5fa" },
  RESOLVED:         { label: "محلولة",        bg: "rgba(16,185,129,.12)",   color: "#34d399" },
  CLOSED:           { label: "مغلقة",         bg: "rgba(100,116,139,.12)",  color: "#94a3b8" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  URGENT: { label: "عاجل",    color: "#f87171" },
  HIGH:   { label: "عالية",   color: "#fb923c" },
  MEDIUM: { label: "متوسطة",  color: "#fbbf24" },
  LOW:    { label: "منخفضة",  color: "#94a3b8" },
};

const STATUS_OPTS = ["ALL", "OPEN", "IN_PROGRESS", "WAITING_MERCHANT", "RESOLVED", "CLOSED"];
const PRIORITY_OPTS = ["ALL", "URGENT", "HIGH", "MEDIUM", "LOW"];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [assignName, setAssignName] = useState("");
  const [showAssign, setShowAssign] = useState(false);

  // Stats
  const { data: stats } = useQuery<TicketStats>({
    queryKey: ["support-stats"],
    queryFn: () => api.get("/admin/support/stats").then((r) => r.data),
    refetchInterval: 30000,
  });

  // Tickets list
  const { data, isLoading } = useQuery<{ tickets: Ticket[]; total: number; page: number; totalPages: number }>({
    queryKey: ["support-tickets", page, search, statusFilter, priorityFilter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) p.set("search", search);
      if (statusFilter !== "ALL") p.set("status", statusFilter);
      if (priorityFilter !== "ALL") p.set("priority", priorityFilter);
      return api.get(`/admin/support?${p}`).then((r) => r.data);
    },
  });

  const tickets = data?.tickets ?? [];

  // Reply mutation
  const replyMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.post(`/admin/support/${id}/reply`, { body }),
    onSuccess: async (_, { id }) => {
      const updated = await api.get(`/admin/support/${id}`).then((r) => r.data);
      setSelectedTicket(updated.ticket);
      setReplyBody("");
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-stats"] });
    },
  });

  // Status update mutation
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/support/${id}`, { status }),
    onSuccess: async (_, { id }) => {
      const updated = await api.get(`/admin/support/${id}`).then((r) => r.data);
      setSelectedTicket(updated.ticket);
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-stats"] });
    },
  });

  // Assign mutation
  const assignMut = useMutation({
    mutationFn: ({ id, assignedToName }: { id: string; assignedToName: string }) =>
      api.patch(`/admin/support/${id}/assign`, { assignedToName }),
    onSuccess: async (_, { id }) => {
      const updated = await api.get(`/admin/support/${id}`).then((r) => r.data);
      setSelectedTicket(updated.ticket);
      setShowAssign(false);
      setAssignName("");
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  async function openTicket(ticket: Ticket) {
    const full = await api.get(`/admin/support/${ticket.id}`).then((r) => r.data);
    setSelectedTicket(full.ticket);
    setReplyBody("");
    setShowAssign(false);
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        .row-hover:hover { background: rgba(255,255,255,.03) !important; cursor: pointer; }
        .msg-merchant { background: rgba(59,130,246,.1); border: 1px solid rgba(59,130,246,.15); }
        .msg-admin    { background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.15); }
      `}</style>

      <div className="flex h-screen overflow-hidden">
        {/* ── Main Panel ───────────────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selectedTicket ? "w-1/2 max-w-[600px]" : "w-full"}`}>
          <div className="overflow-y-auto p-6 space-y-5">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>تذاكر الدعم</h1>
              <p className="text-sm mt-0.5" style={{ color: "#3d5470" }}>متابعة وإدارة طلبات الدعم الواردة</p>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { label: "مفتوحة",        value: stats.open,                       color: "#f87171" },
                  { label: "قيد المعالجة",  value: stats.inProgress,                 color: "#fbbf24" },
                  { label: "محلولة",        value: stats.resolved,                   color: "#34d399" },
                  { label: "اليوم",         value: stats.todayCount,                 color: "#60a5fa"  },
                  { label: "عاجلة",         value: stats.urgent,                     color: "#f87171" },
                  { label: "متوسط الحل",    value: `${stats.avgResolveHours.toFixed(1)}h`, color: "#a78bfa" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center"
                    style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                    <p className="text-lg font-black" style={{ color }}>{value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#3d5470" }}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="flex-1 min-w-48 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#3d5470" }} />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="بحث في التذاكر..."
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl text-sm"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#dce8f5", outline: "none" }} />
              </div>

              {/* Status filter */}
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#8aa8c4" }}>
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>{s === "ALL" ? "كل الحالات" : (STATUS_MAP[s]?.label ?? s)}</option>
                ))}
              </select>

              {/* Priority filter */}
              <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#8aa8c4" }}>
                {PRIORITY_OPTS.map((p) => (
                  <option key={p} value={p}>{p === "ALL" ? "كل الأولويات" : (PRIORITY_MAP[p]?.label ?? p)}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              {isLoading ? (
                <div className="py-10 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-14 text-center">
                  <Headphones className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
                  <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد تذاكر</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1a2840" }}>
                      {["الموضوع", "المتجر", "الأولوية", "الحالة", "الرسائل", "التاريخ"].map((h) => (
                        <th key={h} className="text-right px-4 py-3 text-[10px] font-black uppercase"
                          style={{ color: "#2d4560" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const s = STATUS_MAP[t.status] ?? { label: t.status, bg: "#111", color: "#aaa" };
                      const pr = PRIORITY_MAP[t.priority] ?? { label: t.priority, color: "#aaa" };
                      const isActive = selectedTicket?.id === t.id;
                      return (
                        <tr key={t.id}
                          onClick={() => openTicket(t)}
                          className="row-hover transition"
                          style={{
                            borderBottom: "1px solid #0f1a2d",
                            background: isActive ? "rgba(59,130,246,.06)" : undefined,
                          }}>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold truncate max-w-[200px]" style={{ color: "#dce8f5" }}>
                              {t.subject}
                            </p>
                            {t.assignedToName && (
                              <p className="text-[10px] mt-0.5" style={{ color: "#3d5470" }}>
                                مُحالة إلى: {t.assignedToName}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs" style={{ color: "#8aa8c4" }}>{t.store?.name ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-black" style={{ color: pr.color }}>
                              {pr.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" style={{ color: "#3d5470" }} />
                              <span className="text-xs" style={{ color: "#8aa8c4" }}>
                                {t._count?.messages ?? t.messages?.length ?? 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[10px]" style={{ color: "#3d5470" }}>
                              {formatDate(t.createdAt)}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: "#3d5470" }}>
                  صفحة {page} من {totalPages} · {data?.total} تذكرة
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30"
                    style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa" }}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30"
                    style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa" }}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Ticket Drawer ──────────────────────────────────────────────────── */}
        {selectedTicket && (
          <div className="flex-1 flex flex-col border-r overflow-hidden"
            style={{ background: "#0a1220", borderColor: "#1a2840", maxWidth: "560px" }}>
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 shrink-0"
              style={{ borderBottom: "1px solid #1a2840" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate" style={{ color: "#dce8f5" }}>
                  {selectedTicket.subject}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: STATUS_MAP[selectedTicket.status]?.bg ?? "#111",
                      color: STATUS_MAP[selectedTicket.status]?.color ?? "#aaa",
                    }}>
                    {STATUS_MAP[selectedTicket.status]?.label ?? selectedTicket.status}
                  </span>
                  <span className="text-[10px] font-black"
                    style={{ color: PRIORITY_MAP[selectedTicket.priority]?.color ?? "#aaa" }}>
                    {PRIORITY_MAP[selectedTicket.priority]?.label ?? selectedTicket.priority}
                  </span>
                  {selectedTicket.store && (
                    <span className="text-[10px]" style={{ color: "#3d5470" }}>
                      {selectedTicket.store.name}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-2"
                style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.12)" }}>
                <X className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-1.5 px-4 py-2.5 shrink-0"
              style={{ borderBottom: "1px solid #1a2840" }}>
              {selectedTicket.status === "OPEN" && (
                <button onClick={() => statusMut.mutate({ id: selectedTicket.id, status: "IN_PROGRESS" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.15)", color: "#fbbf24" }}>
                  <Clock className="w-3 h-3" />
                  ابدأ المعالجة
                </button>
              )}
              {!["RESOLVED", "CLOSED"].includes(selectedTicket.status) && (
                <button onClick={() => statusMut.mutate({ id: selectedTicket.id, status: "RESOLVED" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.15)", color: "#34d399" }}>
                  <CheckCircle2 className="w-3 h-3" />
                  حُلّت
                </button>
              )}
              {selectedTicket.status !== "CLOSED" && (
                <button onClick={() => statusMut.mutate({ id: selectedTicket.id, status: "CLOSED" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background: "rgba(100,116,139,.1)", border: "1px solid rgba(100,116,139,.15)", color: "#94a3b8" }}>
                  <XCircle className="w-3 h-3" />
                  أغلق
                </button>
              )}
              <button onClick={() => setShowAssign(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.15)", color: "#60a5fa" }}>
                <UserCheck className="w-3 h-3" />
                {selectedTicket.assignedToName ? `مُحالة: ${selectedTicket.assignedToName}` : "إحالة"}
              </button>
            </div>

            {/* Assign mini form */}
            {showAssign && (
              <div className="flex items-center gap-2 px-4 py-2 shrink-0"
                style={{ borderBottom: "1px solid #1a2840", background: "rgba(59,130,246,.04)" }}>
                <input value={assignName} onChange={(e) => setAssignName(e.target.value)}
                  placeholder="اسم الموظف"
                  className="flex-1 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#dce8f5", outline: "none" }} />
                <button
                  onClick={() => assignName.trim() && assignMut.mutate({ id: selectedTicket.id, assignedToName: assignName.trim() })}
                  disabled={!assignName.trim() || assignMut.isPending}
                  className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}>
                  {assignMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "تأكيد"}
                </button>
                <button onClick={() => setShowAssign(false)}
                  className="px-3 py-2 rounded-xl text-xs"
                  style={{ color: "#3d5470" }}>إلغاء</button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedTicket.messages.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "#2d4560" }}>لا توجد رسائل</p>
              ) : (
                selectedTicket.messages.map((msg) => {
                  const isAdmin = msg.senderType === "ADMIN";
                  return (
                    <div key={msg.id} className={`rounded-xl p-3 text-xs ${isAdmin ? "msg-admin mr-6" : "msg-merchant ml-6"}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-black text-[10px]"
                          style={{ color: isAdmin ? "#34d399" : "#60a5fa" }}>
                          {isAdmin ? "الدعم الفني" : "التاجر"}
                        </span>
                        <span className="text-[10px]" style={{ color: "#3d5470" }}>
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p style={{ color: "#dce8f5", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                        {msg.body}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply box */}
            {!["RESOLVED", "CLOSED"].includes(selectedTicket.status) && (
              <div className="p-4 shrink-0" style={{ borderTop: "1px solid #1a2840" }}>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="اكتب ردك هنا..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                  style={{
                    background: "#0c1526", border: "1px solid #1a2840",
                    color: "#dce8f5", outline: "none", lineHeight: 1.6,
                  }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => replyBody.trim() && replyMut.mutate({ id: selectedTicket.id, body: replyBody.trim() })}
                    disabled={!replyBody.trim() || replyMut.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                    style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}>
                    {replyMut.isPending
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                    إرسال
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
