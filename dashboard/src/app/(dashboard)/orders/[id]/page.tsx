"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, orderStatusBadge, paymentStatusBadge } from "@/components/ui/badge";
import { formatBHD, formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import {
  ArrowRight,
  MapPin,
  Phone,
  User,
  Package,
  CreditCard,
  Truck,
  CheckCircle,
  Clock,
} from "lucide-react";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "معلّق" },
  { value: "CONFIRMED", label: "مؤكّد" },
  { value: "PROCESSING", label: "قيد التجهيز" },
  { value: "SHIPPED", label: "تم الشحن" },
  { value: "DELIVERED", label: "مُسلَّم" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "REFUNDED", label: "مُسترد" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BENEFIT_PAY: "BenefitPay",
  CREDIMAX: "Credimax",
  VISA_MASTERCARD: "Visa / Mastercard",
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
  CASH_ON_DELIVERY: "الدفع عند الاستلام",
  BANK_TRANSFER: "تحويل بنكي",
  TABBY: "Tabby",
  TAMARA: "Tamara",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  async function downloadInvoice() {
    try {
      setDownloadingInvoice(true);
      const res = await api.get(`/orders/${id}/invoice`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order?.orderNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("تعذّر تحميل الفاتورة");
    } finally {
      setDownloadingInvoice(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const res = await api.get(`/orders/${id}`);
      return res.data.order;
    },
    enabled: !!id,
  });

  const order = data;

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      api.patch(`/orders/${id}/status`, {
        status: newStatus,
        trackingNumber: trackingNumber || undefined,
        shippingCompany: shippingCompany || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setStatusMsg("تم تحديث الحالة بنجاح");
      setTimeout(() => setStatusMsg(""), 3000);
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: () => api.patch(`/orders/${id}/payment`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setStatusMsg("تم تأكيد الدفع بنجاح");
      setTimeout(() => setStatusMsg(""), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header title="تفاصيل الطلب" />
        <div className="p-6 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col">
        <Header title="الطلب غير موجود" />
        <div className="p-6 text-center">
          <p className="text-slate-500">لم يتم العثور على الطلب</p>
          <Link href="/orders" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
            العودة للطلبات
          </Link>
        </div>
      </div>
    );
  }

  const customerName =
    order.customer?.firstName && order.customer?.lastName
      ? `${order.customer.firstName} ${order.customer.lastName}`
      : order.customer?.name ?? "—";

  return (
    <div className="flex flex-col">
      <Header
        title={`طلب #${order.orderNumber}`}
        subtitle={formatDateTime(order.createdAt)}
      />

      <div className="p-6 space-y-4">
        {/* Back + Invoice actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/orders"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للطلبات
          </Link>
          <button
            onClick={downloadInvoice}
            disabled={downloadingInvoice || !order}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            {downloadingInvoice ? "جارٍ التحميل..." : "تحميل الفاتورة PDF"}
          </button>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4" />
            {statusMsg}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column — order details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Items */}
            <Card>
              <CardHeader title="منتجات الطلب" />
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-right">
                      <th className="px-4 py-3 font-medium text-slate-500">المنتج</th>
                      <th className="px-4 py-3 font-medium text-slate-500">الكمية</th>
                      <th className="px-4 py-3 font-medium text-slate-500">سعر الوحدة</th>
                      <th className="px-4 py-3 font-medium text-slate-500">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map((item: any) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.product?.images?.[0]?.url ? (
                              <img
                                src={item.product.images[0].url}
                                alt={item.nameAr ?? item.name}
                                className="h-10 w-10 rounded-lg object-cover bg-slate-100"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                <Package className="h-5 w-5 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-slate-900">{item.nameAr ?? item.name}</p>
                              {item.variant && (
                                <p className="text-xs text-slate-500">{item.variant.nameAr ?? item.variant.name}</p>
                              )}
                              {item.sku && (
                                <p className="text-xs text-slate-400 font-mono">SKU: {item.sku}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          × {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatBHD(Number(item.price))}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatBHD(Number(item.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-slate-100 px-4 py-4 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>المجموع الفرعي</span>
                    <span>{formatBHD(Number(order.subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>الشحن</span>
                    <span>{formatBHD(Number(order.shippingCost))}</span>
                  </div>
                  {Number(order.discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>الخصم{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                      <span>- {formatBHD(Number(order.discountAmount))}</span>
                    </div>
                  )}
                  {Number(order.vatAmount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>ضريبة القيمة المضافة</span>
                      <span>{formatBHD(Number(order.vatAmount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-100 pt-2">
                    <span>الإجمالي</span>
                    <span>{formatBHD(Number(order.total))}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Shipping address */}
            {order.address && (
              <Card>
                <CardHeader title="عنوان الشحن" />
                <CardBody>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-700 space-y-1">
                      <p className="font-medium">
                        {order.address.firstName} {order.address.lastName}
                      </p>
                      <p>{order.address.label}</p>
                      {order.address.block && <p>قطعة {order.address.block}، شارع {order.address.road}</p>}
                      {order.address.building && <p>مبنى {order.address.building}{order.address.flat ? `، شقة ${order.address.flat}` : ""}</p>}
                      <p>{order.address.area}، {order.address.city}</p>
                      <p className="flex items-center gap-1 text-slate-500">
                        <Phone className="h-3.5 w-3.5" />
                        {order.address.phone}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right column — status + customer */}
          <div className="space-y-4">
            {/* Order Status */}
            <Card>
              <CardHeader title="حالة الطلب" />
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">حالة الطلب</span>
                  {orderStatusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">حالة الدفع</span>
                  {paymentStatusBadge(order.paymentStatus)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">طريقة الدفع</span>
                  <span className="text-sm font-medium text-slate-900">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod ?? "—"}
                  </span>
                </div>

                {/* Tracking */}
                {(order.status === "SHIPPED" || order.trackingNumber) && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">شركة الشحن</label>
                    <input
                      value={shippingCompany || order.shippingCompany || ""}
                      onChange={(e) => setShippingCompany(e.target.value)}
                      placeholder="مثال: Aramex"
                      className="h-8 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <label className="text-xs font-medium text-slate-500">رقم التتبع</label>
                    <input
                      value={trackingNumber || order.trackingNumber || ""}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="رقم التتبع"
                      className="h-8 w-full rounded-lg border border-slate-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* Update status */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-medium text-slate-500">تغيير الحالة</label>
                  <select
                    defaultValue={order.status}
                    onChange={(e) =>
                      updateStatusMutation.mutate(e.target.value as OrderStatus)
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Confirm payment button */}
                {order.paymentStatus === "PENDING" && (
                  <Button
                    className="w-full"
                    onClick={() => confirmPaymentMutation.mutate()}
                    disabled={confirmPaymentMutation.isPending}
                  >
                    <CreditCard className="h-4 w-4" />
                    {confirmPaymentMutation.isPending ? "جاري التأكيد..." : "تأكيد استلام الدفع"}
                  </Button>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1">ملاحظة العميل</p>
                    <p className="text-sm text-amber-800">{order.notes}</p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader title="معلومات العميل" />
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{customerName}</p>
                    {order.customer?.email && (
                      <p className="text-xs text-slate-500">{order.customer.email}</p>
                    )}
                  </div>
                </div>
                {order.customer?.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="font-mono">{order.customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{formatDateTime(order.createdAt)}</span>
                </div>
                <Link
                  href={`/customers/${order.customer?.id}`}
                  className="block text-center text-xs text-indigo-600 hover:underline pt-1"
                >
                  عرض ملف العميل الكامل
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
