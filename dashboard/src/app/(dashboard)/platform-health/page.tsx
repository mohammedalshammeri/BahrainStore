"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Server, Cpu, HardDrive, Zap, Globe, TrendingUp } from "lucide-react";
import { formatDate, formatBHD } from "@/lib/utils";

export default function PlatformHealthPage() {
  const router = useRouter();
  const { merchant, store } = useAuthStore();

  useEffect(() => {
    if (merchant !== null && !(merchant as any).isAdmin) {
      router.replace('/');
    }
  }, [merchant, router]);

  if (!(merchant as any)?.isAdmin) return null;

  const { data: health, isLoading } = useQuery({
    queryKey: ["platform-health"],
    queryFn: async () => {
      const res = await api.get("/platform/health");
      return res.data as any;
    },
    refetchInterval: 30_000,
  });

  const { data: errors } = useQuery({
    queryKey: ["platform-errors"],
    queryFn: async () => {
      const res = await api.get("/platform/errors?limit=10");
      return res.data as any;
    },
  });

  const { data: funnel } = useQuery({
    queryKey: ["platform-funnel"],
    queryFn: async () => {
      const res = await api.get("/platform/conversion-funnel");
      return res.data as any;
    },
  });

  const stats = health || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="صحة المنصة" subtitle="مراقبة الأداء والأخطاء" />
      <div className="p-6 max-w-6xl mx-auto space-y-5">

        {/* System Overview */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "وقت التشغيل", value: stats.uptime ? `${Math.floor(stats.uptime / 3600)}س` : "—", icon: Activity, color: "text-green-600 bg-green-50" },
            { label: "المتاجر النشطة", value: stats.activeStores || "—", icon: Globe, color: "text-blue-600 bg-blue-50" },
            { label: "استخدام الذاكرة", value: stats.memoryUsage ? `${stats.memoryUsage}%` : "—", icon: Cpu, color: "text-purple-600 bg-purple-50" },
            { label: "أخطاء اليوم", value: stats.todayErrors || 0, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Conversion Funnel */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              قمع التحويل
            </h3>
            {funnel ? (
              <div className="space-y-2">
                {[
                  { label: "مسجلون", value: funnel.registered, color: "bg-blue-500" },
                  { label: "ربطوا متجراً", value: funnel.withStore, color: "bg-green-500" },
                  { label: "حصّلوا دفع", value: funnel.paidUsers, color: "bg-orange-500" },
                  { label: "نشطون (30 يوم)", value: funnel.active30d, color: "bg-purple-500" },
                ].map(step => {
                  const max = funnel.registered || 1;
                  return (
                    <div key={step.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{step.label}</span>
                        <span className="font-bold">{step.value || 0}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`${step.color} h-2 rounded-full`}
                          style={{ width: `${Math.min(100, ((step.value || 0) / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-6">جارٍ التحميل...</div>
            )}
          </Card>

          {/* Recent Errors */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              آخر الأخطاء
            </h3>
            {errors?.errors?.length === 0 ? (
              <div className="text-center text-green-600 py-6">
                <Activity className="w-8 h-8 mx-auto mb-2" />
                لا توجد أخطاء!
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(errors?.errors || []).map((err: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-mono text-red-600 truncate flex-1">{err.message}</div>
                      <Badge className={err.level === "CRITICAL" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>
                        {err.level}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{err.route} — {formatDate(err.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Service Status */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">حالة الخدمات</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { name: "API", status: true },
              { name: "Database", status: true },
              { name: "Storage", status: true },
              { name: "Email", status: stats.emailStatus !== false },
              { name: "SMS", status: stats.smsStatus !== false },
              { name: "CDN", status: true },
            ].map(service => (
              <div key={service.name} className="text-center border rounded-xl p-3">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${service.status ? "bg-green-500" : "bg-red-500"}`} />
                <div className="text-xs font-medium">{service.name}</div>
                <div className={`text-xs ${service.status ? "text-green-600" : "text-red-600"}`}>
                  {service.status ? "يعمل" : "تعطُّل"}
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}
