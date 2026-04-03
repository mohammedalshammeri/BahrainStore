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
import { Plus, CreditCard, RefreshCw, Calendar, Users } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "نشط",
  PAUSED: "موقوف",
  CANCELLED: "ملغى",
  EXPIRED: "منتهي",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export default function SubscriptionsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"plans" | "subscribers">("plans");
  const [showAdd, setShowAdd] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", nameAr: "", price: "", interval: "MONTHLY", intervalCount: "1", description: "" });

  const { data: plansData, isLoading } = useQuery({
    queryKey: ["subscription-plans", store?.id],
    queryFn: async () => {
      const res = await api.get(`/subscription-products/store/${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const addPlanMutation = useMutation({
    mutationFn: async () => {
      await api.post("/subscription-products", {
        storeId: store!.id,
        name: newPlan.name,
        nameAr: newPlan.nameAr,
        price: parseFloat(newPlan.price),
        interval: newPlan.interval,
        intervalCount: parseInt(newPlan.intervalCount),
        description: newPlan.description || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      setShowAdd(false);
      setNewPlan({ name: "", nameAr: "", price: "", interval: "MONTHLY", intervalCount: "1", description: "" });
    },
  });

  const plans = plansData?.plans || [];
  const subscribers = plansData?.subscriptions || [];

  const INTERVAL_LABELS: Record<string, string> = {
    DAILY: "يومي", WEEKLY: "أسبوعي", MONTHLY: "شهري",
    QUARTERLY: "ربع سنوي", YEARLY: "سنوي",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="الاشتراكات" subtitle="إدارة خطط الاشتراك والمشتركين" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{plans.length}</div>
            <div className="text-sm text-gray-500">خطط الاشتراك</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{subscribers.filter((s: any) => s.status === "ACTIVE").length}</div>
            <div className="text-sm text-gray-500">مشتركون نشطون</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {subscribers.filter((s: any) => s.status === "ACTIVE").reduce((sum: number, s: any) => sum + (s.plan?.price || 0), 0).toFixed(3)} BHD
            </div>
            <div className="text-sm text-gray-500">إيرادات شهرية</div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "plans" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`} onClick={() => setTab("plans")}>
            خطط الاشتراك
          </button>
          <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "subscribers" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`} onClick={() => setTab("subscribers")}>
            المشتركون ({subscribers.length})
          </button>
        </div>

        {tab === "plans" && (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-1" /> خطة جديدة
              </Button>
            </div>

            {showAdd && (
              <Card className="p-4 border-blue-200 bg-blue-50">
                <h4 className="font-medium mb-3">إضافة خطة اشتراك</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input placeholder="الاسم بالإنجليزية" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="الاسم بالعربية" value={newPlan.nameAr} onChange={e => setNewPlan(p => ({ ...p, nameAr: e.target.value }))} />
                  <Input placeholder="السعر (BHD)" type="number" value={newPlan.price} onChange={e => setNewPlan(p => ({ ...p, price: e.target.value }))} />
                  <select className="border rounded-md px-3 py-2 text-sm" value={newPlan.interval} onChange={e => setNewPlan(p => ({ ...p, interval: e.target.value }))}>
                    <option value="DAILY">يومي</option>
                    <option value="WEEKLY">أسبوعي</option>
                    <option value="MONTHLY">شهري</option>
                    <option value="QUARTERLY">ربع سنوي</option>
                    <option value="YEARLY">سنوي</option>
                  </select>
                </div>
                <Input placeholder="وصف الخطة (اختياري)" value={newPlan.description} onChange={e => setNewPlan(p => ({ ...p, description: e.target.value }))} className="mb-3" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addPlanMutation.mutate()} disabled={!newPlan.name || !newPlan.price}>إضافة</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
                </div>
              </Card>
            )}

            <div className="grid gap-3">
              {plans.map((plan: any) => (
                <Card key={plan.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{plan.nameAr || plan.name}</div>
                      <div className="text-xs text-gray-400">{INTERVAL_LABELS[plan.interval]}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">{plan.price} BHD</div>
                      <div className="text-xs text-gray-400">{plan._count?.subscriptions || 0} مشترك</div>
                    </div>
                    <Badge className={plan.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {plan.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </div>
                </Card>
              ))}
              {plans.length === 0 && !isLoading && (
                <div className="text-center py-10 text-gray-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  لا توجد خطط اشتراك بعد
                </div>
              )}
            </div>
          </>
        )}

        {tab === "subscribers" && (
          <div className="grid gap-3">
            {subscribers.map((sub: any) => (
              <Card key={sub.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{sub.customer?.name || "عميل"}</div>
                    <div className="text-xs text-gray-400">{sub.plan?.nameAr || sub.plan?.name}</div>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString("ar-BH") : "—"}
                  </div>
                  <Badge className={STATUS_COLORS[sub.status] || "bg-gray-100 text-gray-600"}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </Badge>
                </div>
              </Card>
            ))}
            {subscribers.length === 0 && (
              <div className="text-center py-10 text-gray-400">لا يوجد مشتركون بعد</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
