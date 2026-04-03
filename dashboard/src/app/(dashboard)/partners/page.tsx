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
import { Users, DollarSign, Link2, TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "مقبول",
  REJECTED: "مرفوض",
  SUSPENDED: "موقوف",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SUSPENDED: "bg-gray-100 text-gray-600",
};

export default function PartnersPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "partners" | "apply">("overview");
  const [applyForm, setApplyForm] = useState({ name: "", email: "", website: "", description: "" });

  const { data: partnersData, isLoading } = useQuery({
    queryKey: ["partners", store?.id],
    queryFn: async () => {
      const res = await api.get(`/partners?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      await api.post("/partners/apply", {
        storeId: store!.id,
        ...applyForm,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setApplyForm({ name: "", email: "", website: "", description: "" });
      setTab("partners");
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api.patch(`/partners/${id}/status`, { status: action === "approve" ? "APPROVED" : "REJECTED" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partners"] }),
  });

  const partners = partnersData?.partners || [];
  const stats = partnersData?.stats || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="برنامج الشركاء" subtitle="إدارة الشركاء والعمولات" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{partners.length}</div>
            <div className="text-sm text-gray-500">إجمالي الشركاء</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{partners.filter((p: any) => p.status === "APPROVED").length}</div>
            <div className="text-sm text-gray-500">شركاء نشطون</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{partners.filter((p: any) => p.status === "PENDING").length}</div>
            <div className="text-sm text-gray-500">طلبات معلقة</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{(stats.totalRevenue || 0).toFixed(3)} BHD</div>
            <div className="text-sm text-gray-500">إجمالي العمولات</div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: "overview", label: "نظرة عامة" },
            { id: "partners", label: "الشركاء" },
            { id: "apply", label: "تقديم طلب شراكة" },
          ].map(t => (
            <button
              key={t.id}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
              onClick={() => setTab(t.id as any)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                أداء الرابط التابع
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">إجمالي النقرات</span>
                  <span className="font-medium">{stats.totalClicks || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">الأوردرات المحوّلة</span>
                  <span className="font-medium">{stats.totalOrders || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">معدل التحويل</span>
                  <span className="font-medium text-green-600">
                    {stats.totalClicks ? ((stats.totalOrders / stats.totalClicks) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                العمولات
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">إجمالي مكتسب</span>
                  <span className="font-bold text-green-600">{(stats.totalRevenue || 0).toFixed(3)} BHD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">في الانتظار</span>
                  <span className="font-medium">{(stats.pendingRevenue || 0).toFixed(3)} BHD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">تم صرفه</span>
                  <span className="font-medium">{(stats.paidRevenue || 0).toFixed(3)} BHD</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "partners" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
            ) : partners.length === 0 ? (
              <Card className="p-10 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                لا يوجد شركاء بعد
              </Card>
            ) : (
              partners.map((partner: any) => (
                <Card key={partner.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{partner.name}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {partner.referralCode}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {partner._count?.referrals || 0} احالة
                    </div>
                    <Badge className={STATUS_COLORS[partner.status] || "bg-gray-100 text-gray-600"}>
                      {STATUS_LABELS[partner.status] || partner.status}
                    </Badge>
                    {partner.status === "PENDING" && (
                      <div className="flex gap-1">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 w-7 p-0" onClick={() => approveMutation.mutate({ id: partner.id, action: "approve" })}>
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-red-300 text-red-500" onClick={() => approveMutation.mutate({ id: partner.id, action: "reject" })}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === "apply" && (
          <Card className="p-6 max-w-xl">
            <h4 className="font-semibold mb-4">تقديم طلب شراكة جديد</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">الاسم</label>
                <Input value={applyForm.name} onChange={e => setApplyForm(p => ({ ...p, name: e.target.value }))} placeholder="اسمك الكامل أو اسم الشركة" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">البريد الإلكتروني</label>
                <Input type="email" value={applyForm.email} onChange={e => setApplyForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">الموقع الإلكتروني (اختياري)</label>
                <Input value={applyForm.website} onChange={e => setApplyForm(p => ({ ...p, website: e.target.value }))} placeholder="https://yourwebsite.com" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">لماذا تريد الانضمام؟</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none"
                  value={applyForm.description}
                  onChange={e => setApplyForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="اشرح كيف ستروّج للمنتجات..."
                />
              </div>
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={!applyForm.name || !applyForm.email || applyMutation.isPending}
                className="w-full"
              >
                {applyMutation.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
