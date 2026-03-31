"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { BellRing, Mail, Package, Users } from "lucide-react";

interface Subscription {
  id: string;
  email: string;
  phone: string | null;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
  product: { id: string; nameAr: string; stock: number };
  variantId: string | null;
}

interface GroupedProduct {
  productId: string;
  product: { id: string; nameAr: string; stock: number };
  subscriptions: Subscription[];
}

export default function BackInStockPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["back-in-stock", store?.id],
    queryFn: async () => {
      const res = await api.get(`/back-in-stock?storeId=${store?.id}`);
      return res.data as { subscriptions: Subscription[]; total: number };
    },
    enabled: !!store?.id,
  });

  const notifyMutation = useMutation({
    mutationFn: (productId: string) => api.post(`/back-in-stock/notify/${productId}`, { storeId: store?.id }),
    onSuccess: (_, productId) => {
      qc.invalidateQueries({ queryKey: ["back-in-stock"] });
      setSuccessId(productId);
      setTimeout(() => setSuccessId(null), 3000);
    },
    onSettled: () => setNotifyingId(null),
  });

  const subscriptions = data?.subscriptions ?? [];

  // Group by product
  const grouped: GroupedProduct[] = subscriptions.reduce((acc: GroupedProduct[], sub) => {
    const existing = acc.find(g => g.productId === sub.product.id);
    if (existing) {
      existing.subscriptions.push(sub);
    } else {
      acc.push({ productId: sub.product.id, product: sub.product, subscriptions: [sub] });
    }
    return acc;
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 mb-6">
        <BellRing className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">إشعارات توفر المخزون</h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{data?.total ?? 0}</p>
            <p className="text-xs text-gray-500">إجمالي المشتركين</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-green-50 p-2.5 rounded-lg"><Mail className="h-5 w-5 text-green-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{subscriptions.filter(s => s.notified).length}</p>
            <p className="text-xs text-gray-500">تم الإخطار</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="bg-orange-50 p-2.5 rounded-lg"><Package className="h-5 w-5 text-orange-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{grouped.length}</p>
            <p className="text-xs text-gray-500">منتجات بقوائم انتظار</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BellRing className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد اشتراكات بعد</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.productId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Product Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                <div>
                  <h3 className="font-semibold text-gray-900">{group.product.nameAr}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${group.product.stock === 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {group.product.stock === 0 ? "نفد المخزون" : `مخزون: ${group.product.stock}`}
                    </span>
                    <span className="text-xs text-gray-500">{group.subscriptions.filter(s => !s.notified).length} بانتظار الإشعار</span>
                  </div>
                </div>
                <button
                  disabled={notifyingId === group.productId || group.subscriptions.filter(s => !s.notified).length === 0}
                  onClick={() => { setNotifyingId(group.productId); notifyMutation.mutate(group.productId); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    successId === group.productId
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  {notifyingId === group.productId ? "جاري الإرسال..." : successId === group.productId ? "✓ تم الإرسال" : "إرسال إشعارات"}
                </button>
              </div>

              {/* Subscribers List */}
              <div className="divide-y divide-gray-50">
                {group.subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{sub.email}</p>
                      {sub.phone && <p className="text-xs text-gray-400">{sub.phone}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {sub.notified && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          تم الإخطار {sub.notifiedAt ? `• ${new Date(sub.notifiedAt).toLocaleDateString("ar-BH")}` : ""}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(sub.createdAt).toLocaleDateString("ar-BH")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
