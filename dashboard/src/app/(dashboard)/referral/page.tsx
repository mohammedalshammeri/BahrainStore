"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Users2, TrendingUp, Award } from "lucide-react";

interface ReferralStats {
  totalCodes: number;
  totalReferrals: number;
  completedReferrals: number;
  topReferrers: { code: string; customer: { name: string | null; email: string }; uses: number; totalEarned: number }[];
}

interface ReferralSettings {
  referralEnabled: boolean;
  referralRewardType: string;
  referralRewardValue: number;
  referralMinOrder: number | null;
}

export default function ReferralPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);

  const { data: serverSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["referral-settings", store?.id],
    queryFn: async () => {
      const res = await api.get(`/referral/settings?storeId=${store?.id}`);
      const s = res.data as ReferralSettings;
      setSettings(s);
      return s;
    },
    enabled: !!store?.id,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["referral-stats", store?.id],
    queryFn: async () => {
      const res = await api.get(`/referral/stats?storeId=${store?.id}`);
      return res.data as ReferralStats;
    },
    enabled: !!store?.id,
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/referral/settings`, { storeId: store?.id, ...settings }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["referral-settings"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  if (settingsLoading) return <div className="p-6 text-center text-gray-400">جاري التحميل...</div>;
  if (!settings) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 mb-6">
        <Users2 className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">برنامج الإحالة</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "إجمالي الأكواد", value: stats?.totalCodes ?? 0, icon: Users2 },
          { label: "الإحالات المكتملة", value: stats?.completedReferrals ?? 0, icon: Award },
          { label: "إجمالي الإحالات", value: stats?.totalReferrals ?? 0, icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-lg">
              <s.icon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">إعدادات برنامج الإحالة</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700">تفعيل البرنامج</p>
              <p className="text-xs text-gray-500">يتيح للعملاء مشاركة رابط إحالة مخصص</p>
            </div>
            <button
              onClick={() => setSettings(s => s ? { ...s, referralEnabled: !s.referralEnabled } : s)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.referralEnabled ? "bg-indigo-600" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.referralEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">نوع المكافأة</label>
              <select value={settings.referralRewardType} onChange={e => setSettings(s => s ? { ...s, referralRewardType: e.target.value } : s)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="FIXED">مبلغ ثابت (د.ب)</option>
                <option value="PERCENTAGE">نسبة مئوية (%)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">قيمة المكافأة</label>
              <input type="number" min="0" step="0.001" value={settings.referralRewardValue}
                onChange={e => setSettings(s => s ? { ...s, referralRewardValue: Number(e.target.value) } : s)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">الحد الأدنى للطلب (اختياري)</label>
            <input type="number" min="0" step="0.001" value={settings.referralMinOrder ?? ""}
              onChange={e => setSettings(s => s ? { ...s, referralMinOrder: e.target.value ? Number(e.target.value) : null } : s)}
              placeholder="0.000"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
        </div>

        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className={`mt-5 px-6 py-2 rounded-lg text-sm font-medium transition ${saved ? "bg-green-50 text-green-700 border border-green-200" : "bg-indigo-600 text-white hover:bg-indigo-700"} disabled:opacity-50`}>
          {saveMutation.isPending ? "جاري الحفظ..." : saved ? "✓ تم الحفظ" : "حفظ الإعدادات"}
        </button>
      </div>

      {/* Top Referrers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-800">أفضل المحيلين</h2>
        </div>
        {statsLoading ? (
          <div className="p-6 text-center text-gray-400">جاري التحميل...</div>
        ) : (stats?.topReferrers?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-gray-400">لا توجد إحالات بعد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-right px-4 py-2.5">العميل</th>
                <th className="text-right px-4 py-2.5">الكود</th>
                <th className="text-right px-4 py-2.5">الاستخدامات</th>
                <th className="text-right px-4 py-2.5">المكسب الكلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats?.topReferrers.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.customer.name || r.customer.email}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.code}</code></td>
                  <td className="px-4 py-3">{r.uses}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">{Number(r.totalEarned).toFixed(3)} د.ب</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
