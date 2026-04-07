"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  Star,
  Gift,
  TrendingUp,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface LoyaltyConfig {
  loyaltyEnabled: boolean;
  loyaltyPointsPerBD: number;
  loyaltyBDPerPoint: number;
  loyaltyMinRedeem: number;
  loyaltyMaxRedeemPct: number;
}

interface LoyaltyTransaction {
  id: string;
  type: "EARNED" | "REDEEMED" | "EXPIRED" | "ADJUSTED";
  points: number;
  description: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  EARNED: { label: "مكتسبة", color: "text-emerald-600 bg-emerald-50" },
  REDEEMED: { label: "مستردة", color: "text-indigo-600 bg-indigo-50" },
  EXPIRED: { label: "منتهية", color: "text-red-500 bg-red-50" },
  ADJUSTED: { label: "معدّلة", color: "text-amber-600 bg-amber-50" },
};

/* ─── Settings Panel ─── */
function SettingsPanel({
  storeId,
  config,
}: {
  storeId: string;
  config: LoyaltyConfig;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LoyaltyConfig>(config);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.put("/loyalty/config", { storeId, ...form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-config", storeId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const pointValue = (form.loyaltyBDPerPoint * 100).toFixed(2);

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-800">إعدادات البرنامج</h2>
        </div>
        {/* Enable toggle */}
        <label className="relative inline-flex cursor-pointer items-center gap-2">
          <span className="text-sm font-medium text-slate-600">
            {form.loyaltyEnabled ? "مفعّل" : "موقوف"}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={form.loyaltyEnabled}
              onChange={(e) =>
                setForm({ ...form, loyaltyEnabled: e.target.checked })
              }
            />
            <div
              className={`h-6 w-11 rounded-full transition-colors ${
                form.loyaltyEnabled ? "bg-indigo-600" : "bg-slate-200"
              }`}
            />
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.loyaltyEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            نقاط لكل دينار بحريني
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={form.loyaltyPointsPerBD}
            onChange={(e) =>
              setForm({ ...form, loyaltyPointsPerBD: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            كل دينار بحريني = {form.loyaltyPointsPerBD} نقطة
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            قيمة النقطة (فلس بحريني)
          </label>
          <input
            type="number"
            step={0.001}
            min={0.001}
            value={form.loyaltyBDPerPoint}
            onChange={(e) =>
              setForm({ ...form, loyaltyBDPerPoint: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            100 نقطة = {pointValue} فلس بحريني
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            الحد الأدنى للاسترداد (نقاط)
          </label>
          <input
            type="number"
            min={1}
            value={form.loyaltyMinRedeem}
            onChange={(e) =>
              setForm({ ...form, loyaltyMinRedeem: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            لا يمكن الاسترداد بأقل من {form.loyaltyMinRedeem} نقطة
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            أقصى خصم بالاسترداد (%)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.loyaltyMaxRedeemPct}
            onChange={(e) =>
              setForm({ ...form, loyaltyMaxRedeemPct: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            لا يزيد الخصم بالنقاط عن {form.loyaltyMaxRedeemPct}% من قيمة الطلب
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-700 space-y-1">
        <p className="font-semibold text-indigo-800">مثال عملي</p>
        <p>• عميل يشتري بـ 10 دنانير → يكسب {form.loyaltyPointsPerBD * 10} نقطة</p>
        <p>
          • {form.loyaltyMinRedeem} نقطة تساوي{" "}
          {(form.loyaltyMinRedeem * form.loyaltyBDPerPoint).toFixed(3)} دينار خصم
        </p>
        <p>
          • أقصى خصم على طلب 20 دينار:{" "}
          {((20 * form.loyaltyMaxRedeemPct) / 100).toFixed(3)} دينار
        </p>
      </div>

      <div className="flex items-center justify-between">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            تم الحفظ
          </span>
        )}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="ms-auto flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          حفظ الإعدادات
        </button>
      </div>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function LoyaltyPage() {
  const { store } = useAuthStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["loyalty-config", store?.id],
    queryFn: async () => {
      const res = await api.get("/loyalty/config", {
        params: { storeId: store!.id },
      });
      return res.data as LoyaltyConfig;
    },
    enabled: !!store?.id,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["loyalty-transactions", store?.id],
    queryFn: async () => {
      const res = await api.get("/loyalty/transactions", {
        params: { storeId: store!.id, limit: 30 },
      });
      return res.data;
    },
    enabled: !!store?.id,
  });

  const transactions: LoyaltyTransaction[] = txData?.transactions ?? [];

  return (
    <div className="flex flex-col">
      <Header
        title="برنامج الولاء"
        subtitle="نقاط المكافآت للعملاء"
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <Star className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {configLoading ? "—" : configData?.loyaltyEnabled ? "مفعّل" : "موقوف"}
              </p>
              <p className="text-xs text-slate-500">حالة البرنامج</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {configLoading ? "—" : configData?.loyaltyPointsPerBD ?? "—"}
              </p>
              <p className="text-xs text-slate-500">نقطة / دينار</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Gift className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {configLoading ? "—" : `${configData?.loyaltyMinRedeem ?? "—"}`}
              </p>
              <p className="text-xs text-slate-500">أدنى نقاط للصرف</p>
            </div>
          </Card>
        </div>

        {/* Settings */}
        {configLoading ? (
          <Card className="p-5">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          </Card>
        ) : configData ? (
          <SettingsPanel storeId={store!.id} config={configData} />
        ) : null}

        {/* Recent Transactions */}
        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">آخر حركات النقاط</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500">النوع</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الوصف</th>
                  <th className="px-4 py-3 font-medium text-slate-500">النقاط</th>
                  <th className="px-4 py-3 font-medium text-slate-500">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {txLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded bg-slate-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : !transactions.length
                  ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-14 text-center">
                        <Star className="mx-auto h-12 w-12 text-slate-300" />
                        <p className="mt-2 font-medium text-slate-500">
                          لا توجد حركات بعد
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          ستظهر هنا نقاط العملاء عند أول عملية شراء
                        </p>
                      </td>
                    </tr>
                  )
                  : transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_LABELS[tx.type]?.color ?? "text-slate-600 bg-slate-100"}`}
                          >
                            {TYPE_LABELS[tx.type]?.label ?? tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{tx.description}</td>
                        <td className="px-4 py-3 font-semibold">
                          <span
                            className={
                              tx.type === "EARNED"
                                ? "text-emerald-600"
                                : "text-red-500"
                            }
                          >
                            {tx.type === "EARNED" ? "+" : "-"}
                            {tx.points.toLocaleString("ar")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {formatDate(tx.createdAt)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
