"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBHD, formatDateTime } from "@/lib/utils";
import { RotateCcw, ArrowRight, Plus, CheckCircle, XCircle, RefreshCw, AlertTriangle, MessageSquare } from "lucide-react";
import Link from "next/link";

const RETURN_STATUS_LABELS: Record<string, string> = {
  PENDING: "معلّق",
  APPROVED: "موافق",
  REJECTED: "مرفوض",
  REFUNDED: "مسترد",
};

const RETURN_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  REFUNDED: "bg-green-100 text-green-700",
};

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح",
  IN_PROGRESS: "قيد المعالجة",
  WAITING_MERCHANT: "بانتظار التاجر",
  RESOLVED: "محلول",
  CLOSED: "مغلق",
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  WAITING_MERCHANT: "bg-fuchsia-100 text-fuchsia-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-700",
};

export default function OrderReturnsPage() {
  const params = useParams() as { id: string };
  const orderId = params.id;
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("original_payment");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, string>>({});
  const [refundModal, setRefundModal] = useState<any | null>(null);
  const [executeRefundAmount, setExecuteRefundAmount] = useState("");
  const [executeRefundMethod, setExecuteRefundMethod] = useState("original_payment");
  const [executeRefundNote, setExecuteRefundNote] = useState("");
  const [executeRefundReference, setExecuteRefundReference] = useState("");
  const [executeRefundError, setExecuteRefundError] = useState("");
  const [disputeModal, setDisputeModal] = useState<any | null>(null);
  const [disputeTitle, setDisputeTitle] = useState("");
  const [disputeBody, setDisputeBody] = useState("");
  const [disputePriority, setDisputePriority] = useState("HIGH");
  const [disputeError, setDisputeError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const { data: orderData } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}`);
      return res.data.order;
    },
    enabled: !!orderId,
  });

  const { data: returnsData, isLoading } = useQuery({
    queryKey: ["returns", orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}/returns`);
      return res.data.returns;
    },
    enabled: !!orderId,
  });

  const { data: disputesData } = useQuery({
    queryKey: ["order-disputes", orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}/disputes`);
      return res.data.disputes;
    },
    enabled: !!orderId,
  });

  const createReturnMutation = useMutation({
    mutationFn: () =>
      api.post(`/orders/${orderId}/returns`, {
        reason,
        refundAmount: parseFloat(refundAmount) || 0,
        refundMethod,
        notes: notes || undefined,
        items: Object.entries(selectedItems)
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity: Number(quantity),
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setShowNewForm(false);
      setReason("");
      setRefundAmount("");
      setNotes("");
      setSelectedItems({});
      setFormError("");
    },
    onError: (err: any) => setFormError(err?.response?.data?.error ?? "حدث خطأ"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ returnId, status }: { returnId: string; status: string }) =>
      api.patch(`/orders/${orderId}/returns/${returnId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  const executeRefundMutation = useMutation({
    mutationFn: () =>
      api.post(`/orders/${orderId}/returns/${refundModal.id}/refund`, {
        refundAmount: parseFloat(executeRefundAmount),
        refundMethod: executeRefundMethod,
        note: executeRefundNote || undefined,
        reference: executeRefundReference || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setRefundModal(null);
      setExecuteRefundAmount("");
      setExecuteRefundMethod("original_payment");
      setExecuteRefundNote("");
      setExecuteRefundReference("");
      setExecuteRefundError("");
    },
    onError: (err: any) => setExecuteRefundError(err?.response?.data?.error ?? "تعذر تنفيذ الاسترداد"),
  });

  const createDisputeMutation = useMutation({
    mutationFn: () =>
      api.post(`/orders/${orderId}/disputes`, {
        title: disputeTitle,
        body: disputeBody,
        priority: disputePriority,
        returnId: disputeModal?.id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-disputes", orderId] });
      setDisputeModal(null);
      setDisputeTitle("");
      setDisputeBody("");
      setDisputePriority("HIGH");
      setDisputeError("");
    },
    onError: (err: any) => setDisputeError(err?.response?.data?.error ?? "تعذر فتح النزاع"),
  });

  const replyDisputeMutation = useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
      api.post(`/orders/${orderId}/disputes/${ticketId}/messages`, { body }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order-disputes", orderId] });
      setReplyDrafts((current) => ({ ...current, [variables.ticketId]: "" }));
    },
  });

  const closeDisputeMutation = useMutation({
    mutationFn: (ticketId: string) => api.patch(`/orders/${orderId}/disputes/${ticketId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-disputes", orderId] });
    },
  });

  const returns = returnsData ?? [];
  const disputes = disputesData ?? [];
  const orderItems = orderData?.items ?? [];

  function setItemQuantity(orderItemId: string, quantity: string) {
    setSelectedItems((prev) => {
      if (!quantity || Number(quantity) <= 0) {
        const next = { ...prev };
        delete next[orderItemId];
        return next;
      }

      return { ...prev, [orderItemId]: quantity };
    });
  }

  function submitReturn() {
    if (!reason.trim()) {
      setFormError("سبب المرتجع مطلوب");
      return;
    }

    const hasSelectedItems = Object.values(selectedItems).some((quantity) => Number(quantity) > 0);
    if (!hasSelectedItems) {
      setFormError("يجب اختيار عنصر واحد على الأقل للمرتجع");
      return;
    }

    setFormError("");
    createReturnMutation.mutate();
  }

  function openRefundModal(ret: any) {
    setRefundModal(ret);
    setExecuteRefundAmount(String(ret.refundAmount ?? ""));
    setExecuteRefundMethod(ret.refundMethod ?? "original_payment");
    setExecuteRefundNote("");
    setExecuteRefundReference("");
    setExecuteRefundError("");
  }

  function submitRefundExecution() {
    if (!executeRefundAmount || Number(executeRefundAmount) <= 0) {
      setExecuteRefundError("أدخل مبلغ استرداد صالحاً");
      return;
    }

    setExecuteRefundError("");
    executeRefundMutation.mutate();
  }

  function openDisputeModal(ret: any) {
    setDisputeModal(ret);
    setDisputeTitle(ret ? `اعتراض على المرتجع #${ret.returnNumber}` : `نزاع على الطلب #${orderData?.orderNumber}`);
    setDisputeBody("");
    setDisputePriority("HIGH");
    setDisputeError("");
  }

  function submitDispute() {
    if (!disputeTitle.trim() || disputeBody.trim().length < 10) {
      setDisputeError("أدخل عنواناً واضحاً ووصفاً لا يقل عن 10 أحرف");
      return;
    }

    setDisputeError("");
    createDisputeMutation.mutate();
  }

  function submitDisputeReply(ticketId: string) {
    const body = (replyDrafts[ticketId] || "").trim();
    if (!body) return;
    replyDisputeMutation.mutate({ ticketId, body });
  }

  return (
    <div className="flex flex-col">
      <Header
        title="إدارة المرتجعات"
        subtitle={orderData ? `طلب #${orderData.orderNumber}` : ""}
      />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/orders"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للطلبات
          </Link>
          <Button size="sm" onClick={() => setShowNewForm(true)}>
            <Plus className="h-4 w-4" />
            طلب مرتجع جديد
          </Button>
        </div>

        {/* Order Summary */}
        {orderData && (
          <Card className="mb-6">
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">رقم الطلب</p>
                  <p className="font-bold">#{orderData.orderNumber}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">الإجمالي</p>
                  <p className="font-bold text-indigo-600">{formatBHD(orderData.total)}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">العميل</p>
                  <p className="font-medium">
                    {orderData.customer?.firstName} {orderData.customer?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">التاريخ</p>
                  <p className="font-medium">{formatDateTime(orderData.createdAt)}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* New Return Form */}
        {showNewForm && (
          <Card className="mb-6 border-indigo-200 bg-indigo-50">
            <CardHeader title="طلب مرتجع جديد" />
            <CardBody className="space-y-4">
              {formError && (
                <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">سبب المرتجع *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="اذكر سبب طلب الإرجاع..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">العناصر المطلوب إرجاعها *</label>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-slate-500">لا توجد عناصر متاحة في هذا الطلب.</p>
                  ) : (
                    orderItems.map((item: any) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3 items-center border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                        <div>
                          <p className="font-medium text-slate-800">{item.nameAr || item.name}</p>
                          <p className="text-xs text-slate-500">
                            الكمية في الطلب: {item.quantity}
                            {item.variant?.name ? ` • ${item.variant.name}` : ""}
                          </p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={selectedItems[item.id] ?? ""}
                          onChange={(e) => setItemQuantity(item.id, e.target.value)}
                          placeholder="كمية الإرجاع"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">مبلغ الاسترداد (BHD)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">طريقة الاسترداد</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="original_payment">نفس طريقة الدفع</option>
                    <option value="store_credit">رصيد في المتجر</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">ملاحظات</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={submitReturn}
                  loading={createReturnMutation.isPending}
                  disabled={orderItems.length === 0}
                >
                  تسجيل المرتجع
                </Button>
                <Button variant="outline" onClick={() => { setShowNewForm(false); setFormError(""); setSelectedItems({}); }}>
                  إلغاء
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Returns List */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">جارٍ التحميل...</div>
        ) : returns.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-10">
                <RotateCcw className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">لا توجد مرتجعات لهذا الطلب</p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {returns.map((ret: any) => (
              <Card key={ret.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">#{ret.returnNumber}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${RETURN_STATUS_COLORS[ret.status]}`}
                        >
                          {RETURN_STATUS_LABELS[ret.status]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{ret.reason}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>مبلغ الاسترداد: <b>{formatBHD(ret.refundAmount)}</b></span>
                        <span>طريقة: {ret.refundMethod}</span>
                        <span>{formatDateTime(ret.createdAt)}</span>
                      </div>
                      {Array.isArray(ret.items) && ret.items.length > 0 && (
                        <p className="text-xs text-slate-500">عدد عناصر المرتجع: {ret.items.length}</p>
                      )}
                      {ret.notes && <p className="text-xs text-slate-500 italic">{ret.notes}</p>}
                    </div>

                    {ret.status === "PENDING" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => updateStatusMutation.mutate({ returnId: ret.id, status: "APPROVED" })}
                          className="flex items-center gap-1 text-xs rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 transition"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          موافقة
                        </button>
                        <button
                          onClick={() => updateStatusMutation.mutate({ returnId: ret.id, status: "REJECTED" })}
                          className="flex items-center gap-1 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </button>
                      </div>
                    )}
                    {ret.status === "APPROVED" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openRefundModal(ret)}
                          className="flex items-center gap-1 text-xs rounded-lg bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 transition"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          تنفيذ الاسترداد
                        </button>
                        <button
                          onClick={() => openDisputeModal(ret)}
                          className="flex items-center gap-1 text-xs rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 transition"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          فتح نزاع
                        </button>
                      </div>
                    )}
                    {ret.status === "REFUNDED" && (
                      <button
                        onClick={() => openDisputeModal(ret)}
                        className="flex items-center gap-1 text-xs rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 transition"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        فتح نزاع
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader title="نزاعات المرتجعات والدفع" />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">إذا كان هناك اعتراض على قرار المرتجع أو مبلغ الاسترداد، افتح نزاعاً تشغيلياً من هنا.</p>
              <Button size="sm" variant="outline" onClick={() => openDisputeModal(null)}>
                <AlertTriangle className="h-4 w-4" />
                نزاع عام على الطلب
              </Button>
            </div>

            {disputes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                لا توجد نزاعات مفتوحة أو سابقة على هذا الطلب.
              </div>
            ) : (
              <div className="space-y-4">
                {disputes.map((dispute: any) => (
                  <div key={dispute.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{dispute.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DISPUTE_STATUS_COLORS[dispute.status] || "bg-slate-200 text-slate-700"}`}>
                            {DISPUTE_STATUS_LABELS[dispute.status] || dispute.status}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-3">
                          <span>الأولوية: {dispute.priority}</span>
                          {dispute.returnNumber && <span>مرتبط بـ {dispute.returnNumber}</span>}
                          <span>{formatDateTime(dispute.createdAt)}</span>
                        </div>
                      </div>

                      {dispute.status !== "CLOSED" && (
                        <Button size="sm" variant="outline" onClick={() => closeDisputeMutation.mutate(dispute.id)}>
                          إغلاق النزاع
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {dispute.messages.map((message: any) => (
                        <div key={message.id} className={`rounded-lg px-3 py-2 text-sm ${message.senderType === "MERCHANT" ? "bg-white border border-slate-200" : "bg-blue-50 border border-blue-100"}`}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span>{message.senderType === "MERCHANT" ? "أنت" : "الدعم"}</span>
                            <span>{formatDateTime(message.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-line text-slate-700">{message.body}</p>
                        </div>
                      ))}
                    </div>

                    {dispute.status !== "CLOSED" && (
                      <div className="flex gap-2">
                        <input
                          value={replyDrafts[dispute.id] ?? ""}
                          onChange={(event) => setReplyDrafts((current) => ({ ...current, [dispute.id]: event.target.value }))}
                          placeholder="أضف تحديثاً أو رداً جديداً على النزاع"
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <Button size="sm" onClick={() => submitDisputeReply(dispute.id)} disabled={replyDisputeMutation.isPending}>
                          <MessageSquare className="h-4 w-4" />
                          إرسال
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {refundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">تنفيذ الاسترداد</h3>
                <p className="text-sm text-slate-500 mt-1">#{refundModal.returnNumber} • {refundModal.reason}</p>
              </div>

              {executeRefundError && (
                <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {executeRefundError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">مبلغ الاسترداد</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={executeRefundAmount}
                    onChange={(e) => setExecuteRefundAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">طريقة الاسترداد</label>
                  <select
                    value={executeRefundMethod}
                    onChange={(e) => setExecuteRefundMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="original_payment">نفس طريقة الدفع</option>
                    <option value="store_credit">رصيد في المتجر</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="manual">يدوي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">مرجع العملية</label>
                <input
                  value={executeRefundReference}
                  onChange={(e) => setExecuteRefundReference(e.target.value)}
                  placeholder="اختياري"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">ملاحظات التنفيذ</label>
                <textarea
                  value={executeRefundNote}
                  onChange={(e) => setExecuteRefundNote(e.target.value)}
                  rows={3}
                  placeholder="ملاحظات اختيارية حول تنفيذ الاسترداد"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setRefundModal(null)}>إلغاء</Button>
                <Button onClick={submitRefundExecution} loading={executeRefundMutation.isPending}>
                  تنفيذ الاسترداد
                </Button>
              </div>
            </div>
          </div>
        )}

        {disputeModal !== undefined && disputeModal !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">فتح نزاع</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {disputeModal ? `مرتبط بالمرتجع #${disputeModal.returnNumber}` : `مرتبط بالطلب #${orderData?.orderNumber}`}
                </p>
              </div>

              {disputeError && (
                <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {disputeError}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">عنوان النزاع</label>
                <input
                  value={disputeTitle}
                  onChange={(event) => setDisputeTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">الأولوية</label>
                <select
                  value={disputePriority}
                  onChange={(event) => setDisputePriority(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MEDIUM">متوسطة</option>
                  <option value="HIGH">عالية</option>
                  <option value="URGENT">عاجلة</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">تفاصيل النزاع</label>
                <textarea
                  value={disputeBody}
                  onChange={(event) => setDisputeBody(event.target.value)}
                  rows={5}
                  placeholder="اشرح بالتفصيل سبب الاعتراض وما الذي تحتاج معالجته"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setDisputeModal(null)}>إلغاء</Button>
                <Button onClick={submitDispute} loading={createDisputeMutation.isPending}>
                  فتح النزاع
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
