"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { formatBHD, formatDate } from "@/lib/utils";
import { useParams } from "next/navigation";
import {
  Phone, User, ShoppingBag, ChevronRight,
  LogIn, Package, Clock, CheckCircle, Truck, XCircle, Star,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING:    "في الانتظار",
  CONFIRMED:  "تم التأكيد",
  PROCESSING: "قيد التجهيز",
  SHIPPED:    "تم الشحن",
  DELIVERED:  "تم التوصيل",
  CANCELLED:  "ملغي",
  RETURNED:   "مُعاد",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING:    "bg-yellow-50 text-yellow-700 border-yellow-200",
  CONFIRMED:  "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSING: "bg-indigo-50 text-indigo-700 border-indigo-200",
  SHIPPED:    "bg-orange-50 text-orange-700 border-orange-200",
  DELIVERED:  "bg-green-50 text-green-700 border-green-200",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200",
  RETURNED:   "bg-gray-50 text-gray-700 border-gray-200",
};

export default function AccountPage() {
  const params = useParams() as { subdomain: string };
  const { subdomain } = params;

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<{ id: string; firstName: string; lastName: string; loyaltyPoints?: number } | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loyaltyBDValue, setLoyaltyBDValue] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>("");

  async function fetchData() {
    const cleaned = phone.trim();
    if (!cleaned) return;
    setLoading(true);
    setError("");
    try {
      // Get storeId first
      const storeRes = await api.get(`/stores/s/${subdomain}`);
      const sid = storeRes.data.store.id;
      setStoreId(sid);

      const res = await api.post("/orders/by-phone", { storeId: sid, phone: cleaned });
      setCustomer(res.data.customer);
      setOrders(res.data.orders);

      // Fetch loyalty points (best-effort)
      try {
        const loyaltyRes = await api.get(`/loyalty/customer?customerId=${res.data.customer.id}&storeId=${sid}`);
        if (loyaltyRes.data.loyaltyEnabled) {
          setLoyaltyBDValue(loyaltyRes.data.bdValue ?? null);
        }
      } catch { /* ignore */ }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? "حدث خطأ، تحقق من الرقم وحاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href={`/${subdomain}`} className="hover:text-gray-800">الرئيسية</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">حسابي</span>
      </nav>

      {/* Login by phone */}
      {!customer && (
        <div className="bg-white rounded-2xl border border-gray-200 p-7 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">حسابي</h1>
          <p className="text-sm text-gray-500 mb-6">أدخل رقم جوالك لعرض طلباتك</p>

          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 mb-3">
            <span className="bg-gray-50 px-3 py-3 text-sm text-gray-500 border-l border-gray-200">🇧🇭 +973</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
              placeholder="3XXXXXXX"
              className="flex-1 px-3 py-3 text-sm outline-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-3">{error}</p>
          )}

          <button
            onClick={fetchData}
            disabled={loading || !phone.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:opacity-80 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <><LogIn className="w-4 h-4" /> عرض طلباتي</>
            )}
          </button>
        </div>
      )}

      {/* Orders list */}
      {customer && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                أهلاً، {customer.firstName} 👋
              </h1>
              <p className="text-sm text-gray-500">{orders.length} طلب حتى الآن</p>
            </div>
            <button
              onClick={() => { setCustomer(null); setOrders([]); setPhone(""); setLoyaltyBDValue(null); }}
              className="text-sm text-gray-400 hover:text-gray-700 underline"
            >
              تسجيل الخروج
            </button>
          </div>

          {/* Loyalty Points Card */}
          {loyaltyBDValue !== null && customer.loyaltyPoints !== undefined && customer.loyaltyPoints > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 mb-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-700 mb-0.5">نقاط الولاء</p>
                <p className="text-2xl font-bold text-amber-800">{customer.loyaltyPoints.toLocaleString("ar-BH")} نقطة</p>
                <p className="text-xs text-amber-600">تعادل <span className="font-semibold">{loyaltyBDValue} دينار بحريني</span> خصم عند الطلب القادم</p>
              </div>
              <Link
                href={`/${subdomain}/products`}
                className="flex-shrink-0 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-amber-600 transition"
              >
                تسوق الآن
              </Link>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>لا توجد طلبات بعد</p>
              <Link href={`/${subdomain}/products`} className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                تسوق الآن
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order: any) => (
                <Link
                  key={order.id}
                  href={`/${subdomain}/orders/${order.orderNumber}`}
                  className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition"
                >
                  {/* Icon */}
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{order.orderNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[order.status] ?? STATUS_COLOR.PENDING}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.createdAt)}</p>
                    {order.items?.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        {order.items.map((i: any) => `${i.nameAr ?? i.name} ×${i.quantity}`).join("، ")}
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 text-sm">{formatBHD(order.total)}</p>
                    <ChevronRight className="w-4 h-4 text-gray-300 mt-1 mr-auto" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
