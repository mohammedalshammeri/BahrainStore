"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBHD, formatDate } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  Package, CheckCircle, Truck, Clock, XCircle,
  MapPin, ChevronRight, AlertCircle, ShoppingBag,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING:    { label: "في الانتظار",      icon: <Clock className="w-5 h-5" />,      color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  CONFIRMED:  { label: "تم التأكيد",       icon: <CheckCircle className="w-5 h-5" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  PROCESSING: { label: "قيد التجهيز",      icon: <Package className="w-5 h-5" />,    color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  SHIPPED:    { label: "تم الشحن",         icon: <Truck className="w-5 h-5" />,       color: "text-orange-600 bg-orange-50 border-orange-200" },
  DELIVERED:  { label: "تم التوصيل ✓",     icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600 bg-green-50 border-green-200" },
  CANCELLED:  { label: "ملغي",             icon: <XCircle className="w-5 h-5" />,     color: "text-red-600 bg-red-50 border-red-200" },
  RETURNED:   { label: "مُعاد",            icon: <XCircle className="w-5 h-5" />,     color: "text-gray-600 bg-gray-50 border-gray-200" },
};

const STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export default function OrderTrackingPage() {
  const params = useParams() as { subdomain: string; orderNumber: string };
  const { subdomain, orderNumber } = params;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-track", orderNumber],
    queryFn: async () => {
      const res = await api.get(`/orders/track/${orderNumber}`);
      return res.data.order;
    },
    enabled: !!orderNumber,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once order is in a terminal state
      if (status === "DELIVERED" || status === "CANCELLED" || status === "RETURNED") return false;
      return 30_000; // Poll every 30 seconds for live updates
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-1/2" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-16 h-16 mx-auto text-gray-200 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">الطلب غير موجود</h1>
        <p className="text-gray-500 mb-6">تحقق من رقم الطلب وحاول مرة أخرى</p>
        <Link href={`/${subdomain}`} className="text-blue-600 hover:underline">العودة للمتجر</Link>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[data.status] ?? STATUS_MAP.PENDING;
  const stepIdx = STEPS.indexOf(data.status);
  const isCancelled = data.status === "CANCELLED" || data.status === "RETURNED";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href={`/${subdomain}`} className="hover:text-gray-800">الرئيسية</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">تتبع الطلب</span>
      </nav>

      {/* Order header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">طلب رقم: {data.orderNumber}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(data.createdAt)} — {data.customer?.firstName} {data.customer?.lastName}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.icon}
            {statusInfo.label}
          </div>
        </div>

        {/* Progress bar */}
        {!isCancelled && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((s, i) => {
                const info = STATUS_MAP[s];
                const done = i <= stepIdx;
                const active = i === stepIdx;
                return (
                  <div key={s} className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition
                      ${done ? "bg-green-500 border-green-500 text-white" : "bg-white border-gray-200 text-gray-300"}`}>
                      {done ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs">{i + 1}</span>}
                    </div>
                    <span className={`text-[10px] text-center leading-tight hidden sm:block
                      ${active ? "text-gray-900 font-semibold" : done ? "text-green-600" : "text-gray-400"}`}>
                      {info.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className={`absolute h-0.5 w-full mt-4 ${done && i < stepIdx ? "bg-green-400" : "bg-gray-100"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tracking number */}
        {data.trackingNumber && (
          <div className="mt-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm">
            <Truck className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-blue-700">
              رقم الشحنة: <strong className="font-mono">{data.trackingNumber}</strong>
              {data.shippingCompany && <span className="text-blue-500 mr-1">({data.shippingCompany})</span>}
            </span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="font-bold text-gray-900 mb-4">المنتجات</h2>
        <div className="space-y-3">
          {data.items.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
                {item.product?.images?.[0]?.url ? (
                  <Image src={item.product.images[0].url} alt={item.nameAr} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.nameAr || item.name}</p>
                {item.variant?.name && <p className="text-xs text-gray-500">{item.variant.name}</p>}
                <p className="text-xs text-gray-500">الكمية: {item.quantity}</p>
              </div>
              <span className="font-semibold text-sm">{formatBHD(item.total)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 mt-4 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>المجموع الفرعي</span><span>{formatBHD(data.subtotal)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>الخصم</span><span>- {formatBHD(data.discountAmount)}</span>
            </div>
          )}
          {data.vatAmount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>ضريبة القيمة المضافة</span><span>{formatBHD(data.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
            <span>الإجمالي</span><span>{formatBHD(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Address */}
      {data.address && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> عنوان التوصيل
          </h2>
          <p className="text-sm text-gray-700">
            {data.address.area}
            {data.address.block && ` — بلوك ${data.address.block}`}
            {data.address.road && `، شارع ${data.address.road}`}
            {data.address.building && `، مبنى ${data.address.building}`}
            {data.address.flat && `، شقة ${data.address.flat}`}
          </p>
        </div>
      )}
    </div>
  );
}
