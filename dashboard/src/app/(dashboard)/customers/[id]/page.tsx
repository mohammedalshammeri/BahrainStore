"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, orderStatusBadge } from "@/components/ui/badge";
import { formatBHD, formatDate, formatDateTime, getInitials } from "@/lib/utils";
import {
  ArrowRight, Phone, Mail, MapPin, ShoppingBag,
  TrendingUp, Calendar, Hash,
} from "lucide-react";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`);
      return res.data.customer;
    },
    enabled: !!id,
  });

  const customer = data;

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header title="تفاصيل العميل" />
        <div className="p-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="lg:col-span-2 h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col">
        <Header title="العميل غير موجود" />
        <div className="p-6 text-center">
          <p className="text-slate-500">لم يتم العثور على العميل</p>
          <Link href="/customers" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
            العودة للعملاء
          </Link>
        </div>
      </div>
    );
  }

  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <div className="flex flex-col">
      <Header title={fullName} subtitle={`${customer.totalOrders} طلب`} />

      <div className="p-6 space-y-4">
        {/* Back */}
        <Link
          href="/customers"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 w-fit"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للعملاء
        </Link>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left — Profile & Stats */}
          <div className="space-y-4">
            {/* Profile Card */}
            <Card>
              <CardBody className="text-center py-6">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
                  {getInitials(fullName)}
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fullName}</h2>
                {customer.email && (
                  <p className="text-sm text-slate-500 mt-1">{customer.email}</p>
                )}
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="font-mono">{customer.phone}</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>عميل منذ {formatDate(customer.createdAt)}</span>
                </div>
                {customer.isGuest && (
                  <Badge variant="warning" className="mt-3">زائر (Guest)</Badge>
                )}
              </CardBody>
            </Card>

            {/* KPIs */}
            <Card>
              <CardHeader title="الإحصائيات" />
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <ShoppingBag className="h-4 w-4 text-indigo-400" />
                    إجمالي الطلبات
                  </div>
                  <span className="font-bold text-slate-900">
                    {customer.totalOrders.toLocaleString("ar")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    إجمالي الإنفاق
                  </div>
                  <span className="font-bold text-emerald-700">
                    {formatBHD(Number(customer.totalSpent))}
                  </span>
                </div>
                {customer.totalOrders > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Hash className="h-4 w-4 text-amber-400" />
                      متوسط قيمة الطلب
                    </div>
                    <span className="font-semibold text-slate-700">
                      {formatBHD(Number(customer.totalSpent) / customer.totalOrders)}
                    </span>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Addresses */}
            {customer.addresses?.length > 0 && (
              <Card>
                <CardHeader title="العناوين المحفوظة" />
                <CardBody className="space-y-3">
                  {customer.addresses.map((addr: any) => (
                    <div
                      key={addr.id}
                      className="rounded-lg border border-slate-100 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{addr.label}</span>
                        {addr.isDefault && (
                          <Badge variant="success" className="text-xs">افتراضي</Badge>
                        )}
                      </div>
                      <p className="text-slate-600">
                        {addr.block && `ق${addr.block} `}
                        {addr.road && `ش${addr.road} `}
                        {addr.building && `م${addr.building} `}
                        {addr.flat && `ش${addr.flat}`}
                      </p>
                      <p className="text-slate-500">{addr.area}، {addr.city}</p>
                      <p className="text-slate-400 font-mono text-xs mt-1">{addr.phone}</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right — Order History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader title="آخر الطلبات" />
              {customer.orders?.length === 0 ? (
                <CardBody>
                  <p className="text-center text-slate-400 py-8">لا توجد طلبات بعد</p>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-right">
                        <th className="px-4 py-3 font-medium text-slate-500">رقم الطلب</th>
                        <th className="px-4 py-3 font-medium text-slate-500">المبلغ</th>
                        <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                        <th className="px-4 py-3 font-medium text-slate-500">التاريخ</th>
                        <th className="px-4 py-3 font-medium text-slate-500 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders?.map((order: any) => (
                        <tr
                          key={order.id}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-indigo-600">
                              #{order.orderNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {formatBHD(Number(order.total))}
                          </td>
                          <td className="px-4 py-3">
                            {orderStatusBadge(order.status)}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {formatDateTime(order.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              عرض
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
