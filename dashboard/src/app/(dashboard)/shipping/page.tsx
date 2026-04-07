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
import { Plus, Trash2, MapPin, Package, Truck, ChevronDown, ChevronRight } from "lucide-react";

export default function ShippingPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [showAddZone, setShowAddZone] = useState(false);
  const [rateFormZoneId, setRateFormZoneId] = useState<string | null>(null);
  const [newZone, setNewZone] = useState({ name: "", nameAr: "", countries: "" });
  const [newRate, setNewRate] = useState({
    name: "",
    nameAr: "",
    provider: "MANUAL",
    price: "0",
    estimatedDays: "3",
    minOrderValue: "",
    minWeight: "",
    maxWeight: "",
    isFree: false,
  });
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackingResult, setTrackingResult] = useState<any>(null);

  const { data: zonesData, isLoading } = useQuery({
    queryKey: ["shipping-zones", store?.id],
    queryFn: async () => {
      const res = await api.get(`/shipping/zones?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const addZoneMutation = useMutation({
    mutationFn: async () => {
      await api.post("/shipping/zones", {
        storeId: store!.id,
        name: newZone.name,
        nameAr: newZone.nameAr,
        countries: newZone.countries.split(",").map(c => c.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-zones"] });
      setShowAddZone(false);
      setNewZone({ name: "", nameAr: "", countries: "" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/shipping/zones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-zones"] }),
  });

  const addRateMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      await api.post("/shipping/rates", {
        zoneId,
        name: newRate.name,
        nameAr: newRate.nameAr,
        provider: newRate.provider,
        price: newRate.isFree ? 0 : parseFloat(newRate.price) || 0,
        estimatedDays: parseInt(newRate.estimatedDays, 10) || 3,
        minOrderValue: newRate.minOrderValue ? parseFloat(newRate.minOrderValue) : undefined,
        minWeight: newRate.minWeight ? parseFloat(newRate.minWeight) : undefined,
        maxWeight: newRate.maxWeight ? parseFloat(newRate.maxWeight) : undefined,
        isFree: newRate.isFree,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-zones"] });
      setRateFormZoneId(null);
      setNewRate({
        name: "",
        nameAr: "",
        provider: "MANUAL",
        price: "0",
        estimatedDays: "3",
        minOrderValue: "",
        minWeight: "",
        maxWeight: "",
        isFree: false,
      });
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/shipping/rates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-zones"] }),
  });

  const handleTrack = async () => {
    if (!trackingQuery) return;
    try {
      const res = await api.get(`/shipping/track/${trackingQuery}`);
      setTrackingResult(res.data);
    } catch {
      setTrackingResult({ error: "لم يتم العثور على الشحنة" });
    }
  };

  const zones = zonesData?.zones || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="الشحن والتوصيل" subtitle="إدارة مناطق ومعدلات الشحن" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Tracking */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4" /> تتبع الشحنات
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="أدخل رقم التتبع..."
              value={trackingQuery}
              onChange={e => setTrackingQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTrack()}
              className="flex-1"
            />
            <Button onClick={handleTrack}>تتبع</Button>
          </div>
          {trackingResult && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
              {trackingResult.error ? (
                <span className="text-red-500">{trackingResult.error}</span>
              ) : (
                <div className="space-y-1">
                  <div className="font-medium">{trackingResult.liveStatus?.status || trackingResult.tracking?.status || "غير متوفر"}</div>
                  <div className="text-gray-500">
                    {trackingResult.liveStatus?.available
                      ? `مصدر التتبع: ${trackingResult.liveStatus.provider || trackingResult.tracking?.provider || "Carrier"}`
                      : trackingResult.liveStatus?.message || "لا يوجد live tracking جاهز لهذا المزود حالياً"}
                  </div>
                  <div className="text-xs text-gray-400">
                    رقم التتبع: {trackingResult.tracking?.trackingNumber || trackingQuery}
                  </div>
                  {trackingResult.liveStatus?.checkedAt && (
                    <div className="text-xs text-gray-400">
                      آخر تحقق: {new Date(trackingResult.liveStatus.checkedAt).toLocaleString("ar-BH")}
                    </div>
                  )}
                  {trackingResult.tracking?.updatedAt && (
                    <div className="text-xs text-gray-400">
                      آخر تحديث محفوظ: {new Date(trackingResult.tracking.updatedAt).toLocaleString("ar-BH")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Zones */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">مناطق الشحن ({zones.length})</h3>
          <Button size="sm" onClick={() => setShowAddZone(true)}>
            <Plus className="w-4 h-4 mr-1" /> منطقة جديدة
          </Button>
        </div>

        {showAddZone && (
          <Card className="p-4 border-blue-200 bg-blue-50">
            <h4 className="font-medium mb-3">إضافة منطقة شحن</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input placeholder="الاسم بالإنجليزية" value={newZone.name} onChange={e => setNewZone(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="الاسم بالعربية" value={newZone.nameAr} onChange={e => setNewZone(p => ({ ...p, nameAr: e.target.value }))} />
            </div>
            <Input placeholder="الدول (مفصولة بفاصلة): BH, SA, AE" value={newZone.countries} onChange={e => setNewZone(p => ({ ...p, countries: e.target.value }))} className="mb-3" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addZoneMutation.mutate()} disabled={!newZone.name || !newZone.nameAr}>إضافة</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddZone(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : zones.length === 0 ? (
          <Card className="p-10 text-center text-gray-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
            لا توجد مناطق شحن بعد
          </Card>
        ) : (
          <div className="space-y-3">
            {zones.map((zone: any) => (
              <Card key={zone.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedZone(expandedZone === zone.id ? null : zone.id)}
                >
                  {expandedZone === zone.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="font-medium">{zone.nameAr || zone.name}</div>
                    <div className="text-xs text-gray-400">{zone.countries?.join(", ")}</div>
                  </div>
                  <Badge variant="info">{zone.rates?.length || 0} معدل</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-600"
                    onClick={e => { e.stopPropagation(); deleteZoneMutation.mutate(zone.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {expandedZone === zone.id && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-gray-500">إدارة معدلات الشحن لهذه المنطقة</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRateFormZoneId(rateFormZoneId === zone.id ? null : zone.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" /> معدل جديد
                      </Button>
                    </div>

                    {rateFormZoneId === zone.id && (
                      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input placeholder="الاسم بالإنجليزية" value={newRate.name} onChange={e => setNewRate(p => ({ ...p, name: e.target.value }))} />
                          <Input placeholder="الاسم بالعربية" value={newRate.nameAr} onChange={e => setNewRate(p => ({ ...p, nameAr: e.target.value }))} />
                          <select
                            value={newRate.provider}
                            onChange={e => setNewRate(p => ({ ...p, provider: e.target.value }))}
                            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                          >
                            <option value="MANUAL">MANUAL</option>
                            <option value="ARAMEX">ARAMEX</option>
                            <option value="DHL">DHL</option>
                          </select>
                          <Input placeholder="السعر (BHD)" type="number" min="0" step="0.001" value={newRate.price} onChange={e => setNewRate(p => ({ ...p, price: e.target.value }))} disabled={newRate.isFree} />
                          <Input placeholder="المدة التقديرية بالأيام" type="number" min="1" value={newRate.estimatedDays} onChange={e => setNewRate(p => ({ ...p, estimatedDays: e.target.value }))} />
                          <Input placeholder="الحد الأدنى لقيمة الطلب" type="number" min="0" step="0.001" value={newRate.minOrderValue} onChange={e => setNewRate(p => ({ ...p, minOrderValue: e.target.value }))} />
                          <Input placeholder="أقل وزن (kg)" type="number" min="0" step="0.001" value={newRate.minWeight} onChange={e => setNewRate(p => ({ ...p, minWeight: e.target.value }))} />
                          <Input placeholder="أعلى وزن (kg)" type="number" min="0" step="0.001" value={newRate.maxWeight} onChange={e => setNewRate(p => ({ ...p, maxWeight: e.target.value }))} />
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={newRate.isFree} onChange={e => setNewRate(p => ({ ...p, isFree: e.target.checked }))} />
                          شحن مجاني
                        </label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => addRateMutation.mutate(zone.id)}
                            disabled={!newRate.name || !newRate.nameAr || addRateMutation.isPending}
                          >
                            حفظ المعدل
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRateFormZoneId(null)}>إلغاء</Button>
                        </div>
                      </div>
                    )}

                    {zone.rates?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 border-b">
                            <th className="text-right pb-2">الاسم</th>
                            <th className="text-right pb-2">السعر</th>
                            <th className="text-right pb-2">المزود</th>
                            <th className="text-right pb-2">المدة</th>
                            <th className="text-right pb-2">الحد الأدنى</th>
                            <th className="text-right pb-2">إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zone.rates.map((rate: any) => (
                            <tr key={rate.id} className="border-b last:border-0">
                              <td className="py-2">{rate.nameAr || rate.name}</td>
                              <td className="py-2">{rate.isFree ? <Badge className="bg-green-100 text-green-800 text-xs">مجاني</Badge> : `${rate.price} BHD`}</td>
                              <td className="py-2 text-gray-500">{rate.provider || "—"}</td>
                              <td className="py-2 text-gray-500">{rate.estimatedDays ? `${rate.estimatedDays} أيام` : "—"}</td>
                              <td className="py-2 text-gray-500">{rate.minOrderValue ? `${rate.minOrderValue} BHD` : "—"}</td>
                              <td className="py-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => deleteRateMutation.mutate(rate.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-2">لا توجد معدلات لهذه المنطقة</div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
