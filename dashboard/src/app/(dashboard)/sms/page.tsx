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
import { MessageSquare, Plus, Send, Users, TrendingUp, CheckCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "مسودة", color: "bg-gray-100 text-gray-600" },
  SCHEDULED: { label: "مجدولة", color: "bg-blue-100 text-blue-600" },
  SENDING: { label: "يُرسَل", color: "bg-yellow-100 text-yellow-700" },
  SENT: { label: "أُرسل", color: "bg-green-100 text-green-700" },
  FAILED: { label: "فشل", color: "bg-red-100 text-red-700" },
};

export default function SmsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", message: "", segment: "ALL" });

  const { data, isLoading } = useQuery({
    queryKey: ["sms-campaigns", store?.id],
    queryFn: async () => {
      const res = await api.get(`/sms/campaigns?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/sms/campaigns", { storeId: store!.id, ...form });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-campaigns"] });
      setShowForm(false);
      setForm({ name: "", message: "", segment: "ALL" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/sms/campaigns/${id}/send`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sms-campaigns"] }),
  });

  const campaigns = data?.campaigns || [];
  const stats = {
    total: campaigns.length,
    sent: campaigns.filter((c: any) => c.status === "SENT").length,
    totalRecipients: campaigns.reduce((s: number, c: any) => s + (c.recipientCount || 0), 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="الرسائل القصيرة SMS"
        subtitle="إرسال حملات SMS تسويقية لعملائك"
        action={
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            حملة جديدة
          </Button>
        }
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "الحملات", value: stats.total, icon: MessageSquare, color: "bg-purple-50 text-purple-600" },
            { label: "أُرسلت", value: stats.sent, icon: CheckCircle, color: "bg-green-50 text-green-600" },
            { label: "إجمالي المستلمين", value: stats.totalRecipients, icon: Users, color: "bg-blue-50 text-blue-600" },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">إنشاء حملة SMS</h3>
            <div className="space-y-3">
              <Input placeholder="اسم الحملة" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.segment}
                onChange={e => setForm(p => ({ ...p, segment: e.target.value }))}
              >
                <option value="ALL">جميع العملاء</option>
                <option value="ACTIVE">العملاء النشطون (اشترى في آخر 30 يوم)</option>
                <option value="NEW">العملاء الجدد</option>
                <option value="VIP">العملاء VIP</option>
              </select>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px]"
                placeholder="نص الرسالة (160 حرف)"
                maxLength={160}
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              />
              <div className="text-xs text-gray-400">{form.message.length}/160 حرف</div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.message || createMutation.isPending}>
                حفظ كمسودة
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {/* Campaigns list */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b font-semibold">الحملات</div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-gray-400">لا توجد حملات بعد</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right">الاسم</th>
                  <th className="p-3 text-right">الجمهور</th>
                  <th className="p-3 text-right">المستلمون</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">التاريخ</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => {
                  const s = STATUS_LABELS[c.status] || STATUS_LABELS.DRAFT;
                  return (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-gray-500">{c.segment || "الجميع"}</td>
                      <td className="p-3">{c.recipientCount || 0}</td>
                      <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                      <td className="p-3 text-gray-500">{formatDate(c.createdAt)}</td>
                      <td className="p-3">
                        {c.status === "DRAFT" && (
                          <Button
                            size="sm"
                            onClick={() => sendMutation.mutate(c.id)}
                            disabled={sendMutation.isPending}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            إرسال
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

      </div>
    </div>
  );
}
