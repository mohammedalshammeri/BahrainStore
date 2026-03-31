"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { orderStatusBadge, paymentStatusBadge } from "@/components/ui/badge";
import { formatBHD, formatDateTime } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";
import { ShoppingCart, Search, Eye, Filter, Printer, Truck, Plus, RotateCcw } from "lucide-react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "كل الطلبات" },
  { value: "DRAFT", label: "مسودة" },
  { value: "PENDING", label: "معلّق" },
  { value: "CONFIRMED", label: "مؤكّد" },
  { value: "PROCESSING", label: "قيد التجهيز" },
  { value: "SHIPPED", label: "تم الشحن" },
  { value: "DELIVERED", label: "مُسلّم" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "REFUNDED", label: "مسترد" },
];

export default function OrdersPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", store?.id, search, status, page],
    queryFn: async () => {
      const res = await api.get(`/orders`, {
        params: { storeId: store!.id, search, status: status || undefined, page, limit: 20 },
      });
      return res.data;
    },
    enabled: !!store?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: OrderStatus }) =>
      api.patch(`/orders/${id}/status`, { status: newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const createShipmentMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.post(`/orders/${orderId}/shipment`, { carrier: "aramex", weightKg: 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const orders: Order[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="flex flex-col">
      <Header title="الطلبات" subtitle={`${total.toLocaleString("ar")} طلب`} />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="رقم الطلب أو اسم العميل..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Link
            href="/orders/draft"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition"
          >
            <Plus className="h-4 w-4" />
            طلب يدوي جديد
          </Link>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500">رقم الطلب</th>
                  <th className="px-4 py-3 font-medium text-slate-500">العميل</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الإجمالي</th>
                  <th className="px-4 py-3 font-medium text-slate-500">حالة الطلب</th>
                  <th className="px-4 py-3 font-medium text-slate-500">حالة الدفع</th>
                  <th className="px-4 py-3 font-medium text-slate-500">طريقة الدفع</th>
                  <th className="px-4 py-3 font-medium text-slate-500">التاريخ</th>
                  <th className="px-4 py-3 font-medium text-slate-500 w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !orders.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-2 text-slate-500">لا توجد طلبات بعد</p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-mono font-semibold text-indigo-600 hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{order.customer?.name}</p>
                        <p className="text-xs text-slate-500">{order.customer?.phone}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatBHD(order.total)}
                      </td>
                      <td className="px-4 py-3">{orderStatusBadge(order.status)}</td>
                      <td className="px-4 py-3">{paymentStatusBadge(order.paymentStatus)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {order.paymentMethod === "CASH_ON_DELIVERY"
                          ? "الدفع عند الاستلام"
                          : order.paymentMethod === "BENEFIT_PAY"
                          ? "BenefitPay"
                          : order.paymentMethod === "CREDIMAX"
                          ? "Credimax"
                          : order.paymentMethod ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/orders/${order.id}`}>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL}/orders/${order.id}/shipping-label`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            title="طباعة ملصق الشحن"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </a>
                          {!order.trackingNumber && (
                            <button
                              onClick={() => createShipmentMutation.mutate(order.id)}
                              disabled={createShipmentMutation.isPending}
                              className="flex h-8 px-2 items-center justify-center rounded-lg text-xs text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 transition-colors disabled:opacity-50"
                              title="إنشاء شحنة Aramex"
                            >
                              <Truck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {order.status === "DELIVERED" && (
                            <Link
                              href={`/orders/${order.id}/returns`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                              title="المرتجعات"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          <select
                            value={order.status}
                            onChange={(e) =>
                              updateStatusMutation.mutate({
                                id: order.id,
                                newStatus: e.target.value as OrderStatus,
                              })
                            }
                            className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {STATUS_OPTIONS.slice(1).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-500">
                صفحة {page} من {data.totalPages} — إجمالي {total} طلب
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
                >
                  السابق
                </button>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
