"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Resolver } from "react-hook-form";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Save, CheckCircle } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "اسم المتجر مطلوب"),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().default("BHD"),
  language: z.string().default("ar"),
  vatEnabled: z.boolean().default(false),
  vatNumber: z.string().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(10),
  defaultShippingCost: z.coerce.number().min(0).default(0),
  freeShippingThreshold: z.coerce.number().optional(),
  allowCod: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { store, setStore } = useAuthStore();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) as Resolver<FormData> });

  const vatEnabled = watch("vatEnabled");

  useEffect(() => {
    if (store) {
      reset({
        name: store.name,
        nameAr: store.nameAr ?? "",
        description: store.description ?? "",
        currency: store.currency ?? "BHD",
        language: store.language ?? "ar",
        vatEnabled: store.settings?.vatEnabled ?? false,
        vatNumber: store.settings?.vatNumber ?? "",
        vatRate: store.settings?.vatRate ?? 10,
        defaultShippingCost: store.settings?.defaultShippingCost ?? 0,
        freeShippingThreshold: store.settings?.freeShippingThreshold ?? undefined,
        allowCod: store.settings?.allowCod ?? true,
      });
    }
  }, [store, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { vatEnabled, vatNumber, vatRate, defaultShippingCost, freeShippingThreshold, allowCod, ...storeData } = data;
      await api.patch(`/stores/${store!.id}`, storeData);
      await api.patch(`/stores/${store!.id}/settings`, {
        vatEnabled, vatNumber, vatRate, defaultShippingCost, freeShippingThreshold, allowCod,
      });
    },
    onSuccess: async () => {
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      queryClient.invalidateQueries({ queryKey: ["store"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="flex flex-col">
      <Header title="إعدادات المتجر" />

      <div className="p-6">
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d as FormData))}>
          <div className="space-y-6 max-w-3xl">
            {/* Basic Info */}
            <Card>
              <CardHeader title="المعلومات الأساسية" />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="اسم المتجر (إنجليزي)"
                    required
                    error={errors.name?.message}
                    {...register("name")}
                  />
                  <Input
                    label="اسم المتجر (عربي)"
                    {...register("nameAr")}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    وصف المتجر
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    {...register("description")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      العملة
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      {...register("currency")}
                    >
                      <option value="BHD">BHD — دينار بحريني</option>
                      <option value="SAR">SAR — ريال سعودي</option>
                      <option value="USD">USD — دولار أمريكي</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      اللغة
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      {...register("language")}
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                      <option value="both">كلاهما</option>
                    </select>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* VAT */}
            <Card>
              <CardHeader title="ضريبة القيمة المضافة (VAT)" />
              <CardBody className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    {...register("vatEnabled")}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">تفعيل ضريبة القيمة المضافة</p>
                    <p className="text-xs text-slate-500">سيتم إضافة الضريبة تلقائياً على الطلبات</p>
                  </div>
                </label>

                {vatEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
                    <Input
                      label="الرقم الضريبي (اختياري)"
                      placeholder="BH123456789"
                      {...register("vatNumber")}
                    />
                    <Input
                      label="نسبة الضريبة %"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      {...register("vatRate")}
                    />
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Shipping */}
            <Card>
              <CardHeader title="إعدادات الشحن" />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="تكلفة الشحن الافتراضية (BHD)"
                    type="number"
                    min="0"
                    step="0.001"
                    {...register("defaultShippingCost")}
                  />
                  <Input
                    label="حد الشحن المجاني (BHD)"
                    type="number"
                    min="0"
                    step="0.001"
                    hint="فارغ = لا يوجد شحن مجاني"
                    {...register("freeShippingThreshold")}
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    {...register("allowCod")}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">السماح بالدفع عند الاستلام</p>
                    <p className="text-xs text-slate-500">يمكن للعملاء الدفع عند استلام الطلب</p>
                  </div>
                </label>
              </CardBody>
            </Card>

            {/* Save */}
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting || updateMutation.isPending}
                disabled={!isDirty && !updateMutation.isPending}
              >
                <Save className="h-4 w-4" />
                حفظ الإعدادات
              </Button>

              {saved && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  تم الحفظ بنجاح
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
