"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Gift, BarChart3, Trash2 } from "lucide-react";

const COUPON_TYPE_LABELS: Record<string, string> = {
  BOGO: "اشترِ 1 واحصل على 1",
  TIERED: "خصم متدرج",
  PERCENTAGE: "نسبة مئوية",
  FIXED: "مبلغ ثابت",
  FREE_SHIPPING: "شحن مجاني",
  BUY_X_GET_Y: "اشترِ X واحصل على Y",
};

export default function AdvancedCouponsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "", type: "BOGO", buyQty: "1", getQty: "1",
    tiers: [{ minAmount: "", discountPercent: "" }],
    description: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["advanced-coupons", store?.id],
    queryFn: async () => {
      const res = await api.get(`/advanced-coupons/list?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        storeId: store!.id,
        code: newCoupon.code,
        type: newCoupon.type,
        description: newCoupon.description || undefined,
      };
      if (newCoupon.type === "BOGO" || newCoupon.type === "BUY_X_GET_Y") {
        payload.buyQuantity = parseInt(newCoupon.buyQty);
        payload.getQuantity = parseInt(newCoupon.getQty);
      }
      if (newCoupon.type === "TIERED") {
        payload.tiers = newCoupon.tiers
          .filter(t => t.minAmount && t.discountPercent)
          .map(t => ({ minAmount: parseFloat(t.minAmount), discountPercent: parseFloat(t.discountPercent) }));
      }
      await api.post("/advanced-coupons", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advanced-coupons"] });
      setShowAdd(false);
      setNewCoupon({ code: "", type: "BOGO", buyQty: "1", getQty: "1", tiers: [{ minAmount: "", discountPercent: "" }], description: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/advanced-coupons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advanced-coupons"] }),
  });

  const coupons = data?.coupons || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="الكوبونات المتقدمة" subtitle="BOGO، خصومات متدرجة، وعروض معقدة" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{coupons.length}</div>
            <div className="text-sm text-gray-500">إجمالي الكوبونات</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{coupons.filter((c: any) => c.isActive).length}</div>
            <div className="text-sm text-gray-500">كوبونات نشطة</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {coupons.reduce((sum: number, c: any) => sum + (c.usageCount || 0), 0)}
            </div>
            <div className="text-sm text-gray-500">مرات الاستخدام</div>
          </Card>
        </div>

        {/* Add button */}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> كوبون جديد
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <Card className="p-5 border-blue-200 bg-blue-50">
            <h4 className="font-semibold mb-4">إنشاء كوبون متقدم</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Input
                placeholder="كود الكوبون (مثل: BOGO50)"
                value={newCoupon.code}
                onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
              <select
                className="border rounded-md px-3 py-2 text-sm bg-white"
                value={newCoupon.type}
                onChange={e => setNewCoupon(p => ({ ...p, type: e.target.value }))}
              >
                {Object.entries(COUPON_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {(newCoupon.type === "BOGO" || newCoupon.type === "BUY_X_GET_Y") && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">اشترِ كمية</label>
                  <Input type="number" min="1" value={newCoupon.buyQty} onChange={e => setNewCoupon(p => ({ ...p, buyQty: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">احصل على كمية مجاناً</label>
                  <Input type="number" min="1" value={newCoupon.getQty} onChange={e => setNewCoupon(p => ({ ...p, getQty: e.target.value }))} />
                </div>
              </div>
            )}

            {newCoupon.type === "TIERED" && (
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">مستويات الخصم</div>
                {newCoupon.tiers.map((tier, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="حد أدنى للإنفاق (BHD)" type="number" value={tier.minAmount} onChange={e => setNewCoupon(p => ({ ...p, tiers: p.tiers.map((t, j) => j === i ? { ...t, minAmount: e.target.value } : t) }))} />
                    <Input placeholder="نسبة الخصم (%)" type="number" value={tier.discountPercent} onChange={e => setNewCoupon(p => ({ ...p, tiers: p.tiers.map((t, j) => j === i ? { ...t, discountPercent: e.target.value } : t) }))} />
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setNewCoupon(p => ({ ...p, tiers: [...p.tiers, { minAmount: "", discountPercent: "" }] }))}>
                  <Plus className="w-3 h-3 mr-1" /> إضافة مستوى
                </Button>
              </div>
            )}

            <Input placeholder="وصف (اختياري)" value={newCoupon.description} onChange={e => setNewCoupon(p => ({ ...p, description: e.target.value }))} className="mb-4" />

            <div className="flex gap-2">
              <Button size="sm" onClick={() => addMutation.mutate()} disabled={!newCoupon.code || addMutation.isPending}>إنشاء</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {/* Coupons list */}
        {isLoading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : coupons.length === 0 ? (
          <Card className="p-10 text-center text-gray-400">
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-40" />
            لا توجد كوبونات متقدمة بعد
          </Card>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon: any) => (
              <Card key={coupon.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Tag className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono">{coupon.code}</span>
                      <Badge className="text-xs bg-purple-100 text-purple-800">
                        {COUPON_TYPE_LABELS[coupon.type] || coupon.type}
                      </Badge>
                    </div>
                    {coupon.description && <div className="text-xs text-gray-400">{coupon.description}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      {coupon.usageCount || 0} استخدام
                    </div>
                    <Badge className={coupon.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {coupon.isActive ? "نشط" : "معطّل"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(coupon.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
