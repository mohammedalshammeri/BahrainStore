"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Webhook, Plus, Trash2, RotateCcw, Play, ChevronDown, ChevronUp, Copy, CheckCircle2, XCircle } from "lucide-react";

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastCalledAt: string | null;
  failureCount: number;
  _count: { logs: number };
}

interface WebhookLog {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  createdAt: string;
}

const ALL_EVENTS = [
  "ORDER_CREATED", "ORDER_UPDATED", "ORDER_CANCELLED", "PAYMENT_COMPLETED",
  "PRODUCT_CREATED", "PRODUCT_UPDATED", "PRODUCT_DELETED",
  "CUSTOMER_CREATED", "REVIEW_SUBMITTED"
];

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "إنشاء طلب", ORDER_UPDATED: "تحديث طلب", ORDER_CANCELLED: "إلغاء طلب",
  PAYMENT_COMPLETED: "إتمام الدفع", PRODUCT_CREATED: "إنشاء منتج", PRODUCT_UPDATED: "تحديث منتج",
  PRODUCT_DELETED: "حذف منتج", CUSTOMER_CREATED: "عميل جديد", REVIEW_SUBMITTED: "تقييم جديد",
};

export default function WebhooksPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["ORDER_CREATED"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks", store?.id],
    queryFn: async () => {
      const res = await api.get(`/webhooks?storeId=${store?.id}`);
      return res.data as { webhooks: WebhookItem[]; total: number };
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/webhooks", { storeId: store?.id, url: newUrl, events: newEvents }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      setNewSecret((res.data as { secret: string }).secret);
      setShowCreate(false);
      setNewUrl("");
      setNewEvents(["ORDER_CREATED"]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`, {}),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/rotate-secret`, {}),
    onSuccess: (res) => setNewSecret((res.data as { secret: string }).secret),
  });

  const toggleEvent = (event: string) => setNewEvents(prev =>
    prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
  );

  const loadLogs = async (id: string) => {
    if (expandedLogs === id) { setExpandedLogs(null); return; }
    const res = await api.get(`/webhooks/${id}/logs`);
    setLogs((res.data as { logs: WebhookLog[] }).logs);
    setExpandedLogs(id);
  };

  const webhooks = data?.webhooks ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Webhook className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus className="h-4 w-4" />
          إضافة Webhook
        </button>
      </div>

      {/* Secret Display */}
      {newSecret && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-yellow-800 mb-2">احفظ هذا السر الآن — لن يُعرض مرة أخرى!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-yellow-100 px-3 py-2 rounded-lg break-all" dir="ltr">{newSecret}</code>
            <button onClick={() => { navigator.clipboard.writeText(newSecret); }} className="shrink-0 text-yellow-700 hover:text-yellow-900">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-2 text-xs text-yellow-700 hover:text-yellow-900">إغلاق</button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Webhook className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد Webhooks بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate text-gray-800" dir="ltr">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {wh.events.map(e => (
                      <span key={e} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{EVENT_LABELS[e] ?? e}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {wh.failureCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{wh.failureCount} فشل</span>
                  )}
                  <button onClick={() => testMutation.mutate(wh.id)} title="اختبار" className="p-1.5 text-gray-400 hover:text-indigo-600 transition">
                    <Play className="h-4 w-4" />
                  </button>
                  <button onClick={() => rotateMutation.mutate(wh.id)} title="تجديد السر" className="p-1.5 text-gray-400 hover:text-yellow-600 transition">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button onClick={() => loadLogs(wh.id)} title="السجلات" className="p-1.5 text-gray-400 hover:text-gray-700 transition">
                    {expandedLogs === wh.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { if (confirm("حذف هذا Webhook؟")) deleteMutation.mutate(wh.id); }} className="p-1.5 text-gray-400 hover:text-red-600 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Logs */}
              {expandedLogs === wh.id && (
                <div className="border-t">
                  {logs.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">لا توجد سجلات</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {logs.map(log => (
                        <div key={log.id} className="flex items-center justify-between px-5 py-2.5 text-xs">
                          <div className="flex items-center gap-2">
                            {log.success
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                            <span className="text-gray-600">{EVENT_LABELS[log.event] ?? log.event}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-400">
                            <span>{log.statusCode ?? "—"}</span>
                            <span>{new Date(log.createdAt).toLocaleString("ar-BH")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Webhook جديد</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">URL الوجهة *</label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} dir="ltr"
                  placeholder="https://your-server.com/webhook"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">الأحداث *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_EVENTS.map(event => (
                    <label key={event} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-gray-50">
                      <input type="checkbox" checked={newEvents.includes(event)} onChange={() => toggleEvent(event)} className="rounded" />
                      {EVENT_LABELS[event]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newUrl || newEvents.length === 0}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
