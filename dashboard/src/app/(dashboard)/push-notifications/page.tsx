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
import { Bell, Plus, Send, Users, Smartphone } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function PushNotificationsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", url: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["push-campaigns", store?.id],
    queryFn: async () => {
      const res = await api.get(`/push/campaigns?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const { data: subData } = useQuery({
    queryKey: ["push-subscribers", store?.id],
    queryFn: async () => {
      const res = await api.get(`/push/subscribers?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/push/campaigns", { storeId: store!.id, ...form });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-campaigns"] });
      setShowForm(false);
      setForm({ title: "", body: "", url: "" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/push/campaigns/${id}/send`, { storeId: store!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push-campaigns"] }),
  });

  const campaigns = data?.campaigns || [];
  const subscriberCount = subData?.total || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="إشعارات الدفع"
        subtitle="إرسال إشعارات فورية لزوار متجرك"
        action={
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            إشعار جديد
          </Button>
        }
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Subscriber count */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{subscriberCount}</div>
            <div className="text-sm text-gray-500">مشترك نشط في إشعارات الدفع</div>
          </div>
        </Card>

        {/* Create form */}
        {showForm && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">إنشاء إشعار جديد</h3>
            <div className="space-y-3">
              <Input placeholder="عنوان الإشعار" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              <Input placeholder="نص الإشعار" value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
              <Input placeholder="الرابط عند الضغط (اختياري)" value={form.url} dir="ltr" onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />

              {/* Preview */}
              {form.title && (
                <div className="bg-gray-100 rounded-xl p-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    B
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{form.title}</div>
                    <div className="text-xs text-gray-600">{form.body}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.body || createMutation.isPending}>
                <Send className="w-4 h-4 mr-2" />
                إرسال الآن
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {/* Campaigns */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b font-semibold">سجل الإشعارات</div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              لم تُرسل أي إشعارات بعد
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right">العنوان</th>
                  <th className="p-3 text-right">المستلمون</th>
                  <th className="p-3 text-right">نُقر</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-gray-500 text-xs truncate max-w-[200px]">{c.body}</div>
                    </td>
                    <td className="p-3">{c.sentCount || 0}</td>
                    <td className="p-3 text-blue-600">{c.clickCount || 0}</td>
                    <td className="p-3">
                      <Badge className={c.sentAt ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                        {c.sentAt ? "أُرسل" : "مسودة"}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-500">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

      </div>
    </div>
  );
}
