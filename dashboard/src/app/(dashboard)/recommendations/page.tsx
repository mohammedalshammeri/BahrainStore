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
import { Sparkles, TrendingUp, Eye, ShoppingBag, Settings, ToggleLeft, ToggleRight } from "lucide-react";

export default function RecommendationsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"settings" | "trending" | "analytics">("settings");
  const [searchProduct, setSearchProduct] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["rec-settings", store?.id],
    queryFn: async () => {
      const res = await api.get(`/recommendations/settings/${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ["rec-trending", store?.id],
    queryFn: async () => {
      const res = await api.get(`/recommendations/trending/${store!.id}?limit=10`);
      return res.data as any;
    },
    enabled: !!store?.id && tab === "trending",
  });

  const { data: alsoViewed } = useQuery({
    queryKey: ["rec-also-viewed", searchProduct],
    queryFn: async () => {
      const res = await api.get(`/recommendations/also-viewed/${searchProduct}`);
      return res.data as any;
    },
    enabled: !!searchProduct,
  });

  const WIDGETS = [
    { key: "also_viewed", label: "شاهد أيضاً", description: "منتجات شاهدها مشترون آخرون", icon: Eye },
    { key: "complete_the_look", label: "أكمل الإطلالة", description: "منتجات تكمل المنتج الحالي", icon: Sparkles },
    { key: "trending", label: "الأكثر مبيعاً", description: "المنتجات الأكثر طلباً حالياً", icon: TrendingUp },
    { key: "related", label: "منتجات مشابهة", description: "منتجات من نفس الفئة", icon: ShoppingBag },
  ];

  const widgetSettings = settings?.settings || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="توصيات المنتجات" subtitle="نظام التوصيات الذكية لمتجرك" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: "settings", label: "الإعدادات" },
            { id: "trending", label: "الأكثر مشاهدة" },
            { id: "analytics", label: "الإحصائيات" },
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

        {tab === "settings" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">تفعيل أو تعطيل ودجز التوصيات في صفحات المتجر</p>
            {WIDGETS.map(widget => {
              const Icon = widget.icon;
              const isEnabled = widgetSettings[widget.key] !== false;
              return (
                <Card key={widget.key} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{widget.label}</div>
                      <div className="text-xs text-gray-400">{widget.description}</div>
                    </div>
                    <button
                      className={`text-2xl transition-colors ${isEnabled ? "text-blue-600" : "text-gray-300"}`}
                      onClick={async () => {
                        await api.patch(`/recommendations/settings/${store!.id}`, {
                          [widget.key]: !isEnabled,
                        });
                        queryClient.invalidateQueries({ queryKey: ["rec-settings"] });
                      }}
                    >
                      {isEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>
                    <Badge className={isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {isEnabled ? "مفعّل" : "معطّل"}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "trending" && (
          <div className="space-y-3">
            {trendingLoading ? (
              <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
            ) : (
              (trending?.products || []).map((p: any, i: number) => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-sm font-bold text-orange-600">
                      #{i + 1}
                    </div>
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt={p.nameAr || p.name} className="w-12 h-12 object-cover rounded-lg" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{p.nameAr || p.name}</div>
                      <div className="text-xs text-gray-400">{p.viewCount || 0} مشاهدة</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{p.price} BHD</div>
                    </div>
                  </div>
                </Card>
              ))
            )}
            {!trendingLoading && (trending?.products || []).length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                لا توجد بيانات بعد — ابدأ بمشاركة رابط متجرك لجمع البيانات
              </div>
            )}
          </div>
        )}

        {tab === "analytics" && (
          <div className="space-y-4">
            <Card className="p-5">
              <h4 className="font-medium mb-3">البحث عن توصيات منتج</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="أدخل معرّف المنتج..."
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  className="flex-1"
                />
              </div>
              {alsoViewed && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-2">المنتجات التي شاهدها المستخدمون أيضاً:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(alsoViewed.products || []).map((p: any) => (
                      <div key={p.id} className="text-xs p-2 bg-gray-50 rounded">{p.nameAr || p.name}</div>
                    ))}
                    {(alsoViewed.products || []).length === 0 && (
                      <div className="text-xs text-gray-400 col-span-2">لا توجد بيانات لهذا المنتج</div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
