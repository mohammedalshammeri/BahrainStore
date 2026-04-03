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
import { Warehouse, Plus, Package, TrendingUp, MapPin, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function WarehousesPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", nameAr: "", city: "", address: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["warehouses", store?.id],
    queryFn: async () => {
      const res = await api.get(`/warehouses?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/warehouses", { storeId: store!.id, ...form });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setShowForm(false);
      setForm({ name: "", nameAr: "", city: "", address: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/warehouses/${id}/set-default`, { storeId: store!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="المستودعات"
        subtitle="إدارة مواقع المخزون المتعددة"
        action={
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            مستودع جديد
          </Button>
        }
      />
      <div className="p-6 max-w-5xl mx-auto space-y-4">

        {showForm && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">إضافة مستودع</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Input placeholder="اسم المستودع" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="الاسم بالعربية" value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} />
              <Input placeholder="المدينة" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              <Input placeholder="العنوان التفصيلي" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                حفظ
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">جارٍ التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.warehouses || []).map((wh: any) => (
              <Card key={wh.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-bold">{wh.name}</div>
                      <div className="text-sm text-gray-500">{wh.nameAr || wh.city}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {wh.isDefault && <Badge className="bg-blue-100 text-blue-700">افتراضي</Badge>}
                    {!wh.isDefault && (
                      <Button size="sm" variant="ghost" onClick={() => setDefaultMutation.mutate(wh.id)}>
                        تعيين افتراضي
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(wh.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                  <MapPin className="w-3 h-3" />
                  {wh.city}{wh.address ? ` — ${wh.address}` : ""}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{wh._count?.stocks || 0}</div>
                    <div className="text-xs text-gray-500">منتج</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-600">
                      {wh.isActive ? "نشط" : "معطّل"}
                    </div>
                    <div className="text-xs text-gray-500">الحالة</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && (!data?.warehouses || data.warehouses.length === 0) && (
          <div className="text-center py-16">
            <Warehouse className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">لا توجد مستودعات بعد</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              أضف أول مستودع
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
