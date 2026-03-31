"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { HeadphonesIcon, Plus, Send, X, ChevronLeft } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_MERCHANT" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category: string | null;
  createdAt: string;
  messages: { id: string; senderType: string; body: string; createdAt: string }[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  OPEN: { label: "مفتوح", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "قيد المعالجة", color: "bg-yellow-100 text-yellow-700" },
  WAITING_MERCHANT: { label: "بانتظار ردك", color: "bg-orange-100 text-orange-700" },
  RESOLVED: { label: "محلول", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "مغلق", color: "bg-gray-100 text-gray-600" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  LOW: { label: "منخفض", color: "text-gray-500" },
  MEDIUM: { label: "متوسط", color: "text-blue-600" },
  HIGH: { label: "عالي", color: "text-orange-600" },
  URGENT: { label: "عاجل", color: "text-red-600" },
};

export default function SupportPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reply, setReply] = useState("");
  const [newForm, setNewForm] = useState({ subject: "", category: "", body: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets", store?.id],
    queryFn: async () => {
      const res = await api.get(`/support?storeId=${store?.id}`);
      return res.data as { tickets: Ticket[]; total: number };
    },
    enabled: !!store?.id,
  });

  const { data: ticketDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["ticket-detail", selected?.id],
    queryFn: async () => {
      const res = await api.get(`/support/${selected?.id}`);
      return res.data as Ticket;
    },
    enabled: !!selected?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/support", { storeId: store?.id, ...newForm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      setShowCreate(false);
      setNewForm({ subject: "", category: "", body: "" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: () => api.post(`/support/${selected?.id}/messages`, { body: reply, storeId: store?.id }),
    onSuccess: () => { refetchDetail(); setReply(""); },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/support/${id}/close`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-tickets"] }); setSelected(null); },
  });

  const tickets = data?.tickets ?? [];
  const detail = ticketDetail ?? selected;

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* List View */}
      {!selected ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <HeadphonesIcon className="h-6 w-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">الدعم الفني</h1>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
              <Plus className="h-4 w-4" />
              تذكرة جديدة
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <HeadphonesIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد تذاكر دعم</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y">
              {tickets.map((ticket) => (
                <button key={ticket.id} onClick={() => setSelected(ticket)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition text-right">
                  <div>
                    <p className="font-semibold text-gray-900">{ticket.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {ticket.category && <span className="text-xs text-gray-500">{ticket.category}</span>}
                      <span className={`text-xs font-medium ${PRIORITY_MAP[ticket.priority]?.color}`}>
                        {PRIORITY_MAP[ticket.priority]?.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_MAP[ticket.status]?.color}`}>
                      {STATUS_MAP[ticket.status]?.label}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(ticket.createdAt).toLocaleDateString("ar-BH")}</span>
                    <ChevronLeft className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Detail View */
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition">
              <ChevronLeft className="h-4 w-4 rotate-180" />
              رجوع
            </button>
            <h1 className="text-xl font-bold text-gray-900">{detail?.subject}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_MAP[detail?.status ?? "OPEN"]?.color}`}>
              {STATUS_MAP[detail?.status ?? "OPEN"]?.label}
            </span>
            {detail?.status !== "CLOSED" && (
              <button onClick={() => closeMutation.mutate(detail!.id)} className="mr-auto text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1 rounded-lg">
                إغلاق التذكرة
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-gray-200 mb-4 max-h-[50vh] overflow-y-auto p-4 space-y-3">
            {(detail?.messages ?? []).length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">لا توجد رسائل بعد</p>
            ) : (
              (detail?.messages ?? []).map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderType === "MERCHANT" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm ${msg.senderType === "MERCHANT" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                    <p>{msg.body}</p>
                    <p className={`text-xs mt-1 ${msg.senderType === "MERCHANT" ? "text-indigo-200" : "text-gray-400"}`}>
                      {new Date(msg.createdAt).toLocaleString("ar-BH")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply Box */}
          {detail?.status !== "CLOSED" && (
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="اكتب ردك هنا..."
                rows={2}
                className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none"
              />
              <button
                onClick={() => replyMutation.mutate()}
                disabled={replyMutation.isPending || !reply.trim()}
                className="bg-indigo-600 text-white px-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">تذكرة دعم جديدة</h2>
              <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الموضوع *</label>
                <input value={newForm.subject} onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">التصنيف (اختياري)</label>
                <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                  <option value="">اختر تصنيفًا</option>
                  <option value="TECHNICAL">مشكلة تقنية</option>
                  <option value="BILLING">فوترة ودفع</option>
                  <option value="FEATURE">طلب ميزة</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">تفاصيل المشكلة *</label>
                <textarea rows={4} value={newForm.body} onChange={e => setNewForm(f => ({ ...f, body: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newForm.subject || !newForm.body}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                {createMutation.isPending ? "جاري الإرسال..." : "إرسال"}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
