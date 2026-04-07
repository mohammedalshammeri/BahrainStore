"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";

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
  response: string | null;
  success: boolean;
  createdAt: string;
  deliveryId: string;
  timestamp: string;
  test: boolean;
  payload: unknown;
}

interface WebhookContract {
  headers: Record<string, string>;
  signature: { algorithm: string; format: string; signedPayload: string };
  events: Array<{ key: string; label: string; description: string }>;
  retryRoute: string;
}

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "إنشاء طلب",
  ORDER_UPDATED: "تحديث طلب",
  ORDER_CANCELLED: "إلغاء طلب",
  PAYMENT_COMPLETED: "إتمام الدفع",
  PRODUCT_CREATED: "إنشاء منتج",
  PRODUCT_UPDATED: "تحديث منتج",
  PRODUCT_DELETED: "حذف منتج",
  CUSTOMER_CREATED: "عميل جديد",
  REVIEW_SUBMITTED: "تقييم جديد",
};

export default function WebhooksPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newEvents, setNewEvents] = useState<string[]>(["ORDER_CREATED"]);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logsByWebhook, setLogsByWebhook] = useState<Record<string, WebhookLog[]>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks", store?.id],
    queryFn: async () => {
      const res = await api.get(`/webhooks?storeId=${store?.id}`);
      return res.data as { webhooks: WebhookItem[]; total: number };
    },
    enabled: !!store?.id,
  });

  const { data: contract } = useQuery({
    queryKey: ["webhook-contract"],
    queryFn: async () => {
      const res = await api.get("/webhooks/contract");
      return res.data as WebhookContract;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/webhooks", { storeId: store?.id, url: newUrl, events: newEvents }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      setNewSecret((res.data as { secret: string }).secret);
      setShowCreate(false);
      setNewUrl("");
      setNewEvents([contract?.events[0]?.key ?? "ORDER_CREATED"]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`, {}),
    onSuccess: (_, id) => loadLogs(id, true),
  });

  const retryMutation = useMutation({
    mutationFn: ({ webhookId, logId }: { webhookId: string; logId: string }) => api.post(`/webhooks/${webhookId}/logs/${logId}/retry`, {}),
    onSuccess: (_, variables) => loadLogs(variables.webhookId, true),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/rotate-secret`, {}),
    onSuccess: (res) => setNewSecret((res.data as { secret: string }).secret),
  });

  const toggleEvent = (event: string) => setNewEvents((prev) =>
    prev.includes(event) ? prev.filter((item) => item !== event) : [...prev, event],
  );

  const loadLogs = async (id: string, force = false) => {
    if (!force && expandedLogs === id) {
      setExpandedLogs(null);
      return;
    }

    const res = await api.get(`/webhooks/${id}/logs`);
    setLogsByWebhook((prev) => ({ ...prev, [id]: (res.data as { logs: WebhookLog[] }).logs }));
    setExpandedLogs(id);
  };

  const eventOptions = contract?.events ?? Object.keys(EVENT_LABELS).map((key) => ({
    key,
    label: key,
    description: "",
  }));
  const webhooks = data?.webhooks ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

      {contract && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="font-bold text-gray-900 mb-3">Signature Contract</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(contract.headers).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-gray-500 mb-1">{key}</p>
                  <code className="font-mono text-gray-800" dir="ltr">{value}</code>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-slate-950 text-slate-100 p-3 text-xs font-mono overflow-x-auto" dir="ltr">
              {contract.signature.signedPayload}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="font-bold text-gray-900 mb-3">Events</h2>
            <div className="space-y-2">
              {eventOptions.map((event) => (
                <div key={event.key} className="rounded-xl border border-gray-100 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900">{EVENT_LABELS[event.key] ?? event.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {newSecret && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-2">احفظ هذا السر الآن لأنه لن يُعرض مرة أخرى.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-yellow-100 px-3 py-2 rounded-lg break-all" dir="ltr">{newSecret}</code>
            <button onClick={() => navigator.clipboard.writeText(newSecret)} className="shrink-0 text-yellow-700 hover:text-yellow-900">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-2xl">
          <Webhook className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد Webhooks بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const webhookLogs = logsByWebhook[wh.id] ?? [];

            return (
              <div key={wh.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium truncate text-gray-800" dir="ltr">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {wh.events.map((event) => (
                        <span key={event} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                          {EVENT_LABELS[event] ?? event}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      آخر استدعاء: {wh.lastCalledAt ? new Date(wh.lastCalledAt).toLocaleString("ar-BH") : "لم يرسل بعد"}
                    </p>
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

                {expandedLogs === wh.id && (
                  <div className="border-t bg-gray-50">
                    {webhookLogs.length === 0 ? (
                      <p className="text-center text-gray-400 py-4 text-sm">لا توجد سجلات</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {webhookLogs.map((log) => (
                          <div key={log.id} className="px-5 py-3 text-xs">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {log.success ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                                  <span className="text-gray-700">{EVENT_LABELS[log.event] ?? log.event}</span>
                                  {log.test && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">test</span>}
                                </div>
                                <p className="font-mono text-gray-500" dir="ltr">delivery: {log.deliveryId}</p>
                                {log.response && <p className="text-gray-500 line-clamp-2">{log.response}</p>}
                              </div>
                              <div className="text-left flex flex-col items-end gap-2">
                                <span className="text-gray-500">{log.statusCode ?? "—"}</span>
                                <span className="text-gray-400">{new Date(log.timestamp).toLocaleString("ar-BH")}</span>
                                {!log.success && (
                                  <button
                                    onClick={() => retryMutation.mutate({ webhookId: wh.id, logId: log.id })}
                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 text-indigo-700 px-2 py-1 hover:bg-indigo-100"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    إعادة المحاولة
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Webhook جديد</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">URL الوجهة *</label>
                <input
                  value={newUrl}
                  onChange={(event) => setNewUrl(event.target.value)}
                  dir="ltr"
                  placeholder="https://your-server.com/webhook"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">الأحداث *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {eventOptions.map((event) => (
                    <label key={event.key} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-gray-50">
                      <input type="checkbox" checked={newEvents.includes(event.key)} onChange={() => toggleEvent(event.key)} className="rounded" />
                      {EVENT_LABELS[event.key] ?? event.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newUrl || newEvents.length === 0}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
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
