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
import { RotateCcw, ArrowRight, Plus, CheckCircle, XCircle, RefreshCw } from "lucide-react";
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

  const createReturnMutation = useMutation({
    mutationFn: () =>
      api.post(`/orders/${orderId}/returns`, {
        reason,
        refundAmount: parseFloat(refundAmount) || 0,
        refundMethod,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setShowNewForm(false);
      setReason("");
      setRefundAmount("");
      setNotes("");
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

  const returns = returnsData ?? [];

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
                  onClick={() => createReturnMutation.mutate()}
                  loading={createReturnMutation.isPending}
                  disabled={!reason.trim()}
                >
                  تسجيل المرتجع
                </Button>
                <Button variant="outline" onClick={() => { setShowNewForm(false); setFormError(""); }}>
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
                      <button
                        onClick={() => updateStatusMutation.mutate({ returnId: ret.id, status: "REFUNDED" })}
                        className="flex items-center gap-1 text-xs rounded-lg bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 transition"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        تأكيد الاسترداد
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
