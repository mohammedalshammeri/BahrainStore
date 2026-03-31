"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBHD, formatDate } from "@/lib/utils";
import type { Coupon } from "@/types";
import { Tag, Plus, Trash2, X, Percent, DollarSign, Truck } from "lucide-react";

const schema = z.object({
  code: z.string().min(3, "الرمز يجب أن يكون 3 أحرف على الأقل").max(20),
  type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]),
  value: z.coerce.number().positive("القيمة يجب أن تكون أكبر من صفر"),
  minOrderValue: z.coerce.number().positive().optional().or(z.literal("")),
  maxUses: z.coerce.number().int().positive().optional().or(z.literal("")),
  expiresAt: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: "نسبة مئوية %",
  FIXED: "مبلغ ثابت BHD",
  FREE_SHIPPING: "شحن مجاني",
};

export default function CouponsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["coupons", store?.id],
    queryFn: async () => {
      const res = await api.get(`/coupons`, { params: { storeId: store!.id } });
      return res.data;
    },
    enabled: !!store?.id,
  });

  const coupons: Coupon[] = data?.coupons ?? [];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { type: "PERCENTAGE" },
  });

  const type = watch("type");

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/coupons", {
        ...data,
        storeId: store!.id,
        code: data.code.toUpperCase(),
        minOrderValue: data.minOrderValue || undefined,
        maxUses: data.maxUses || undefined,
        expiresAt: data.expiresAt || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      reset({ type: "PERCENTAGE" });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setDeleteConfirm(null);
    },
  });

  return (
    <div className="flex flex-col">
      <Header title="الكوبونات" subtitle={`${coupons.length} كود خصم`} />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "إلغاء" : "إنشاء كوبون"}
          </Button>
        </div>

        {/* Create Form */}
        {showForm && (
          <Card>
            <CardHeader title="كوبون جديد" />
            <CardBody>
              <form
                onSubmit={handleSubmit((data) => createMutation.mutate(data))}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {/* Code */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">رمز الكوبون *</label>
                  <Input
                    {...register("code")}
                    placeholder="SALE20"
                    className="uppercase"
                    style={{ textTransform: "uppercase" }}
                  />
                  {errors.code && (
                    <p className="text-xs text-red-500">{errors.code.message}</p>
                  )}
                </div>

                {/* Type */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">نوع الخصم *</label>
                  <select
                    {...register("type")}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERCENTAGE">نسبة مئوية %</option>
                    <option value="FIXED">مبلغ ثابت BHD</option>
                    <option value="FREE_SHIPPING">شحن مجاني</option>
                  </select>
                </div>

                {/* Value */}
                {type !== "FREE_SHIPPING" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">
                      {type === "PERCENTAGE" ? "نسبة الخصم (%) *" : "مبلغ الخصم (BHD) *"}
                    </label>
                    <Input
                      {...register("value")}
                      type="number"
                      step={type === "PERCENTAGE" ? "1" : "0.001"}
                      min="0"
                      placeholder={type === "PERCENTAGE" ? "20" : "0.500"}
                    />
                    {errors.value && (
                      <p className="text-xs text-red-500">{errors.value.message}</p>
                    )}
                  </div>
                )}

                {/* Min order value */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    الحد الأدنى للطلب (BHD)
                  </label>
                  <Input
                    {...register("minOrderValue")}
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="اختياري"
                  />
                </div>

                {/* Max uses */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    الحد الأقصى للاستخدام
                  </label>
                  <Input
                    {...register("maxUses")}
                    type="number"
                    min="1"
                    placeholder="غير محدود"
                  />
                </div>

                {/* Expiry */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    تاريخ الانتهاء
                  </label>
                  <Input {...register("expiresAt")} type="datetime-local" />
                </div>

                {/* Submit */}
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowForm(false); reset({ type: "PERCENTAGE" }); }}
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                    {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الكوبون"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* Coupons Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500">الرمز</th>
                  <th className="px-4 py-3 font-medium text-slate-500">النوع</th>
                  <th className="px-4 py-3 font-medium text-slate-500">القيمة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الحد الأدنى</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الاستخدام</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الانتهاء</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 font-medium text-slate-500 w-16">حذف</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !coupons.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Tag className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-2 text-slate-500">لا توجد كوبونات بعد</p>
                      <button
                        onClick={() => setShowForm(true)}
                        className="mt-2 text-sm text-indigo-600 hover:underline"
                      >
                        أنشئ أول كوبون
                      </button>
                    </td>
                  </tr>
                ) : (
                  coupons.map((coupon) => {
                    const isExpired =
                      coupon.expiresAt ? new Date(coupon.expiresAt) < new Date() : false;
                    const isMaxed =
                      coupon.maxUses != null && coupon.usesCount >= coupon.maxUses;

                    return (
                      <tr
                        key={coupon.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        {/* Code */}
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                            {coupon.code}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-slate-600">
                            {coupon.type === "PERCENTAGE" && <Percent className="h-3.5 w-3.5" />}
                            {coupon.type === "FIXED" && <DollarSign className="h-3.5 w-3.5" />}
                            {coupon.type === "FREE_SHIPPING" && <Truck className="h-3.5 w-3.5" />}
                            <span className="text-xs">{TYPE_LABELS[coupon.type]}</span>
                          </div>
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {coupon.type === "FREE_SHIPPING"
                            ? "—"
                            : coupon.type === "PERCENTAGE"
                            ? `${coupon.value}%`
                            : formatBHD(coupon.value)}
                        </td>

                        {/* Min order */}
                        <td className="px-4 py-3 text-slate-600">
                          {coupon.minOrderAmount
                            ? formatBHD(coupon.minOrderAmount)
                            : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Usage */}
                        <td className="px-4 py-3 text-slate-600">
                          {coupon.usesCount.toLocaleString("ar")}
                          {coupon.maxUses
                            ? ` / ${coupon.maxUses.toLocaleString("ar")}`
                            : " / ∞"}
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {coupon.expiresAt ? formatDate(coupon.expiresAt) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {!coupon.isActive || isExpired || isMaxed ? (
                            <Badge variant="error">
                              {isExpired ? "منتهي" : isMaxed ? "نفد" : "معطل"}
                            </Badge>
                          ) : (
                            <Badge variant="success">نشط</Badge>
                          )}
                        </td>

                        {/* Delete */}
                        <td className="px-4 py-3">
                          {deleteConfirm === coupon.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate(coupon.id)}
                                disabled={deleteMutation.isPending}
                                className="rounded px-2 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                              >
                                تأكيد
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                              >
                                لا
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(coupon.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
