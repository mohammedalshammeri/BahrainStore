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
import { DollarSign, TrendingUp, RefreshCw, Globe } from "lucide-react";

const GCC_CURRENCIES = [
  { code: "SAR", flag: "🇸🇦", name: "ريال سعودي" },
  { code: "AED", flag: "🇦🇪", name: "درهم إماراتي" },
  { code: "KWD", flag: "🇰🇼", name: "دينار كويتي" },
  { code: "QAR", flag: "🇶🇦", name: "ريال قطري" },
  { code: "OMR", flag: "🇴🇲", name: "ريال عُماني" },
  { code: "USD", flag: "🇺🇸", name: "دولار أمريكي" },
  { code: "EUR", flag: "🇪🇺", name: "يورو" },
  { code: "EGP", flag: "🇪🇬", name: "جنيه مصري" },
];

export default function CurrenciesPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [editRates, setEditRates] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["currency-rates"],
    queryFn: async () => {
      const res = await api.get("/currencies/rates?base=BHD");
      return res.data as any;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["store-settings-currency", store?.id],
    queryFn: async () => {
      const res = await api.get(`/stores/${store!.id}/settings`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const updateRatesMutation = useMutation({
    mutationFn: async () => {
      const rates: Record<string, number> = {};
      for (const [code, val] of Object.entries(editRates)) {
        if (val) rates[code] = parseFloat(val);
      }
      await api.post("/currencies/rates/update", { base: "BHD", rates, source: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-rates"] });
      setEditing(false);
    },
  });

  const supportedCurrencies: string[] = settings?.settings?.supportedCurrencies || ["BHD"];
  const rates = data?.rates || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="العملات المتعددة"
        subtitle="إدارة أسعار الصرف لمتجرك"
      />
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Base currency */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🇧🇭</div>
            <div>
              <div className="font-bold text-blue-800">دينار بحريني (BHD)</div>
              <div className="text-sm text-blue-600">العملة الأساسية للمتجر</div>
            </div>
            <Badge className="mr-auto bg-blue-200 text-blue-800">أساسية</Badge>
          </div>
        </Card>

        {/* Exchange Rates */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">أسعار الصرف</h3>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={() => updateRatesMutation.mutate()} disabled={updateRatesMutation.isPending}>حفظ</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditRates({}); }}>إلغاء</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  setEditRates(Object.fromEntries(GCC_CURRENCIES.map(c => [c.code, rates[c.code]?.toString() || ""])));
                  setEditing(true);
                }}>
                  تعديل الأسعار
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            {GCC_CURRENCIES.map(currency => (
              <div key={currency.code} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">{currency.flag}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{currency.name}</div>
                  <div className="text-xs text-gray-500">{currency.code}</div>
                </div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">1 BHD =</span>
                    <Input
                      className="w-28 h-8 text-sm"
                      type="number"
                      step="0.0001"
                      value={editRates[currency.code] || ""}
                      onChange={e => setEditRates(p => ({ ...p, [currency.code]: e.target.value }))}
                      placeholder="0.0000"
                    />
                    <span className="text-xs text-gray-500">{currency.code}</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="font-bold">
                      {rates[currency.code] ? `${rates[currency.code].toFixed(4)} ${currency.code}` : "غير محدد"}
                    </div>
                    <div className="text-xs text-gray-400">مقابل 1 BHD</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Last updated */}
        {data?.updatedAt && (
          <div className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3" />
            آخر تحديث: {new Date(data.updatedAt).toLocaleString("ar-BH")}
          </div>
        )}

      </div>
    </div>
  );
}
