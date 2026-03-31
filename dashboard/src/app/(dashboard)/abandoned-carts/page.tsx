"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Phone, Mail, Send, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface AbandonedCart {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  cartData: Array<{ name?: string; quantity?: number; price?: number }>;
  reminderSent: boolean;
  reminderSentAt: string | null;
  recoveredAt: string | null;
  createdAt: string;
}

interface CartsResponse {
  carts: AbandonedCart[];
  total: number;
  recovered: number;
  page: number;
  pages: number;
}

export default function AbandonedCartsPage() {
  const { store } = useAuthStore();
  const [data, setData] = useState<CartsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [recoveryMsg, setRecoveryMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [page, setPage] = useState(1);

  async function fetchCarts(p = 1) {
    if (!store?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/whatsapp/abandoned-carts?storeId=${store.id}&page=${p}&limit=20`);
      setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (store?.id) fetchCarts(page);
  }, [store?.id, page]);

  async function sendReminder(cartId: string) {
    setRecovering(cartId);
    setRecoveryMsg(null);
    try {
      // Trigger bulk recovery for just that store; backend selects eligible carts
      await api.post("/whatsapp/recover-carts", { storeId: store?.id, hoursAgo: 0.01 });
      setRecoveryMsg({ id: cartId, ok: true, text: "تم إرسال رسالة الواتساب ✅" });
      fetchCarts(page);
    } catch {
      setRecoveryMsg({ id: cartId, ok: false, text: "فشل الإرسال — تحقق من إعدادات WhatsApp" });
    } finally {
      setRecovering(null);
    }
  }

  function cartTotal(cart: AbandonedCart) {
    if (!Array.isArray(cart.cartData)) return null;
    const total = cart.cartData.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);
    return total > 0 ? total.toFixed(3) : null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">العربات المتروكة</h1>
          <p className="text-slate-500 mt-1">العملاء الذين أضافوا منتجات ولم يكملوا الطلب</p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchCarts(page)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">إجمالي المتروكة</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">المستردة</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{data.recovered}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">تم إرسال تذكير</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {data.carts.filter(c => c.reminderSent).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">في انتظار التذكير</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {data.carts.filter(c => !c.reminderSent).length}
            </p>
          </div>
        </div>
      )}

      {/* Bulk Recover */}
      <Card>
        <CardHeader
          title="إرسال تذكيرات جماعية"
          subtitle="أرسل WhatsApp لجميع العربات التي مضى عليها أكثر من ساعتين"
          action={
            <Button
              onClick={() => {
                setRecovering("bulk");
                api.post("/whatsapp/recover-carts", { storeId: store?.id, hoursAgo: 2 })
                  .then(() => {
                    setRecoveryMsg({ id: "bulk", ok: true, text: "تم الإرسال لجميع العربات المؤهلة" });
                    fetchCarts(page);
                  })
                  .catch(() => setRecoveryMsg({ id: "bulk", ok: false, text: "فشل — تحقق من إعدادات WhatsApp" }))
                  .finally(() => setRecovering(null));
              }}
              disabled={recovering === "bulk"}
            >
              <Send className="h-4 w-4 ml-2" />
              {recovering === "bulk" ? "جارٍ الإرسال..." : "إرسال للجميع"}
            </Button>
          }
        />
        {recoveryMsg?.id === "bulk" && (
          <CardBody>
            <div className={`flex items-center gap-2 text-sm ${recoveryMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
              {recoveryMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {recoveryMsg.text}
            </div>
          </CardBody>
        )}
      </Card>

      {/* Carts Table */}
      <Card>
        <CardHeader
          title={`العربات المتروكة (${data?.total ?? 0})`}
          subtitle="العملاء الذين لديهم أرقام هاتف يمكن إرسال واتساب لهم"
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              <span className="mr-2 text-slate-500">جارٍ التحميل...</span>
            </div>
          ) : !data?.carts.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingBag className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">لا توجد عربات متروكة</p>
              <p className="text-sm mt-1">ستظهر هنا عندما يبدأ العملاء في التسوق</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-right">
                    <th className="px-4 py-3 font-medium text-slate-600">العميل</th>
                    <th className="px-4 py-3 font-medium text-slate-600">المنتجات</th>
                    <th className="px-4 py-3 font-medium text-slate-600">الإجمالي</th>
                    <th className="px-4 py-3 font-medium text-slate-600">الحالة</th>
                    <th className="px-4 py-3 font-medium text-slate-600">التاريخ</th>
                    <th className="px-4 py-3 font-medium text-slate-600">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.carts.map((cart) => {
                    const itemCount = Array.isArray(cart.cartData) ? cart.cartData.length : 0;
                    const total = cartTotal(cart);
                    const hasPhone = Boolean(cart.phone);
                    const date = new Date(cart.createdAt).toLocaleDateString("ar-BH", { day: "numeric", month: "short", year: "numeric" });
                    const isRecovering = recovering === cart.id;

                    return (
                      <tr key={cart.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        {/* Customer */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{cart.firstName ?? "زائر"}</p>
                          {cart.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                              <Phone className="h-3 w-3" />{cart.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Mail className="h-3 w-3" />{cart.email}
                          </span>
                        </td>

                        {/* Items */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            <ShoppingBag className="h-3 w-3" />{itemCount} منتج
                          </span>
                          {Array.isArray(cart.cartData) && cart.cartData[0]?.name && (
                            <p className="text-xs text-slate-400 mt-1 truncate max-w-[140px]">{cart.cartData[0].name}...</p>
                          )}
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {total ? `${total} BD` : "—"}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {cart.reminderSent ? (
                            <Badge variant="success">تم الإرسال</Badge>
                          ) : (
                            <Badge variant="warning">لم يُرسل</Badge>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-slate-500 text-xs">{date}</td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          {hasPhone ? (
                            <Button
                              variant="outline"
                              className="text-xs h-8 px-3"
                              disabled={isRecovering || cart.reminderSent}
                              onClick={() => sendReminder(cart.id)}
                            >
                              <Send className="h-3 w-3 ml-1" />
                              {isRecovering ? "..." : cart.reminderSent ? "أُرسل" : "WhatsApp"}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">لا يوجد هاتف</span>
                          )}
                          {recoveryMsg?.id === cart.id && (
                            <p className={`text-xs mt-1 ${recoveryMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                              {recoveryMsg.text}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            السابق
          </Button>
          <span className="text-sm text-slate-600">صفحة {page} من {data.pages}</span>
          <Button variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
