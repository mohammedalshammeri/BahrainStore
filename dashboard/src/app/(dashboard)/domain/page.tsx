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
import { Globe, Shield, Wifi, Trash2, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

export default function DomainPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");

  const { data: domain, isLoading } = useQuery({
    queryKey: ["domain", store?.id],
    queryFn: async () => {
      const res = await api.get(`/domain/status?storeId=${store!.id}`);
      return (res.data as any).domain;
    },
    enabled: !!store?.id,
  });

  const connectMutation = useMutation({
    mutationFn: async (customDomain: string) => {
      await api.post("/domain/connect", { storeId: store!.id, customDomain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain"] });
      setNewDomain("");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await api.post("/domain/verify", { storeId: store!.id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domain"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/domain/remove?storeId=${store!.id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domain"] }),
  });

  const sslStatus: Record<string, { label: string; color: string; icon: any }> = {
    ACTIVE: { label: "نشط", color: "bg-green-100 text-green-700", icon: Shield },
    PENDING: { label: "جارٍ الإصدار", color: "bg-yellow-100 text-yellow-700", icon: Clock },
    ISSUING: { label: "يُصدر الآن", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
    FAILED: { label: "فشل", color: "bg-red-100 text-red-700", icon: AlertCircle },
    EXPIRED: { label: "منتهي الصلاحية", color: "bg-gray-100 text-gray-700", icon: AlertCircle },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="النطاق المخصص" subtitle="ربط نطاق خاص بمتجرك" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">

        {/* Current store URL */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-700 mb-2">رابط المتجر الحالي</h3>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-blue-600 font-mono text-sm">
              {store?.subdomain}.bazar.com
            </span>
            <Badge className="mr-auto bg-green-100 text-green-700">نشط</Badge>
          </div>
        </Card>

        {/* Connect custom domain */}
        {!domain && (
          <Card className="p-5">
            <h3 className="font-semibold text-gray-700 mb-4">ربط نطاق مخصص</h3>
            <div className="flex gap-3">
              <Input
                placeholder="store.yourdomain.com"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                className="flex-1"
                dir="ltr"
              />
              <Button
                onClick={() => connectMutation.mutate(newDomain)}
                disabled={!newDomain || connectMutation.isPending}
              >
                ربط
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              أضف CNAME record يشير إلى <code className="bg-gray-100 px-1 rounded">cname.bazar.com</code> في إعدادات DNS الخاصة بك
            </p>
          </Card>
        )}

        {/* Domain status */}
        {domain && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">النطاق المرتبط</h3>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200"
                onClick={() => removeMutation.mutate()}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                إزالة
              </Button>
            </div>

            <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="text-blue-700 font-mono text-sm">{domain.customDomain}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">حالة الربط</div>
                <Badge className={domain.verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                  {domain.verified ? "مُتحقق" : "قيد الانتظار"}
                </Badge>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">شهادة SSL</div>
                {(() => {
                  const ssl = sslStatus[domain.sslStatus] || sslStatus.PENDING;
                  return <Badge className={ssl.color}>{ssl.label}</Badge>;
                })()}
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">CDN</div>
                <Badge className={domain.cdnEnabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                  {domain.cdnEnabled ? "مفعّل" : "معطّل"}
                </Badge>
              </div>
            </div>

            {!domain.verified && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                التحقق من DNS الآن
              </Button>
            )}
          </Card>
        )}

        {/* DNS Instructions */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-700 mb-3">إعدادات DNS المطلوبة</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="ltr">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-2 font-mono">CNAME</td>
                  <td className="p-2 font-mono">@</td>
                  <td className="p-2 font-mono text-blue-600">cname.bazar.com</td>
                </tr>
                <tr className="border-t">
                  <td className="p-2 font-mono">CNAME</td>
                  <td className="p-2 font-mono">www</td>
                  <td className="p-2 font-mono text-blue-600">cname.bazar.com</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  );
}
