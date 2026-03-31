"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Resolver } from "react-hook-form";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { Category } from "@/types";
import { ArrowRight, Save } from "lucide-react";
import Link from "next/link";
import { VariantEditor } from "@/components/products/variant-editor";

const schema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب"),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.coerce.number().positive("السعر يجب أن يكون أكبر من صفر"),
  comparePrice: z.coerce.number().optional(),
  cost: z.coerce.number().optional(),
  sku: z.string().optional(),
  stock: z.coerce.number().min(0).default(0),
  categoryId: z.string().optional(),
  trackStock: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isDigital: z.boolean().default(false),
  digitalFileUrl: z.string().optional(),
  isPreOrder: z.boolean().default(false),
  preOrderMessageAr: z.string().optional(),
  preOrderDeliveryDays: z.coerce.number().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewProductPage() {
  const router = useRouter();
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const watchedPrice = 0;
  const watchedStock = 0;

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories", store?.id],
    queryFn: async () => {
      const res = await api.get(`/categories/store/${store!.id}`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { stock: 0, trackStock: true, isActive: true, isDigital: false },
  });

  const isDigital = watch("isDigital");
  const isPreOrder = watch("isPreOrder");

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return api.post("/products", { ...(data as any), storeId: store!.id });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setCreatedProductId(res.data.product.id);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? "حدث خطأ");
    },
  });

  return (
    <div className="flex flex-col">
      <Header title="إضافة منتج جديد" />

      <div className="p-6">
        <div className="mb-4">
          <Link
            href="/products"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للمنتجات
          </Link>
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit((data) => createMutation.mutate(data as FormData))}>
          <div className="grid gap-6 xl:grid-cols-3">
            {/* Main Info */}
            <div className="xl:col-span-2 space-y-6">
              <Card>
                <CardHeader title="معلومات المنتج الأساسية" />
                <CardBody className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="اسم المنتج (إنجليزي)"
                      placeholder="Product Name"
                      required
                      error={errors.name?.message}
                      {...register("name")}
                    />
                    <Input
                      label="اسم المنتج (عربي)"
                      placeholder="اسم المنتج"
                      error={errors.nameAr?.message}
                      {...register("nameAr")}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      الوصف (إنجليزي)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Product description..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      {...register("description")}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      الوصف (عربي)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="وصف المنتج..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      {...register("descriptionAr")}
                    />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="التسعير والمخزون" />
                <CardBody className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input
                      label="السعر (BHD)"
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      required
                      error={errors.price?.message}
                      {...register("price")}
                    />
                    <Input
                      label="سعر المقارنة"
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      hint="السعر قبل الخصم"
                      {...register("comparePrice")}
                    />
                    <Input
                      label="التكلفة"
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      hint="لحساب الربح"
                      {...register("cost")}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="SKU"
                      placeholder="ABC-123"
                      {...register("sku")}
                    />
                    <Input
                      label="الكمية في المخزون"
                      type="number"
                      min="0"
                      placeholder="0"
                      {...register("stock")}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="trackStock"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      {...register("trackStock")}
                    />
                    <label htmlFor="trackStock" className="text-sm font-medium text-slate-700">
                      تتبع المخزون
                    </label>
                  </div>
                </CardBody>
              </Card>

              {/* Variants — shown after product is saved */}
              {createdProductId ? (
                <Card>
                  <CardHeader title="متغيرات المنتج" />
                  <CardBody>
                    <VariantEditor
                      productId={createdProductId}
                      basePrice={0}
                      baseStock={0}
                      onSaved={() => router.push("/products")}
                    />
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push("/products")}
                      >
                        الانتقال للمنتجات بدون متغيرات
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                  احفظ المنتج أولاً لإضافة المتغيرات (اللون، المقاس، ...)
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader title="الحالة والتصنيف" />
                <CardBody className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      حالة المنتج
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      {...register("isActive", { setValueAs: (v) => v === "true" || v === true })}
                    >
                      <option value="true">نشط - يظهر في المتجر</option>
                      <option value="false">مخفي - لا يظهر للعملاء</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      الفئة
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      {...register("categoryId")}
                    >
                      <option value="">— بدون فئة —</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nameAr ?? cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Digital Product */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        id="isDigital"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        {...register("isDigital")}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">منتج رقمي</p>
                        <p className="text-xs text-slate-500">ملف قابل للتحميل بعد الشراء</p>
                      </div>
                    </label>
                    {isDigital && (
                      <Input
                        label="رابط الملف"
                        placeholder="https://example.com/file.pdf"
                        type="url"
                        hint="رابط مباشر للملف الرقمي"
                        {...register("digitalFileUrl")}
                      />
                    )}
                  </div>

                  {/* Pre-order */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        id="isPreOrder"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        {...register("isPreOrder")}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">طلب مسبق (Pre-order)</p>
                        <p className="text-xs text-slate-500">السماح بالطلب قبل توفر المنتج</p>
                      </div>
                    </label>
                    {isPreOrder && (
                      <>
                        <Input
                          label="رسالة الطلب المسبق (عربي)"
                          placeholder="سيُشحن خلال 14 يوم"
                          hint="تظهر للعملاء في صفحة المنتج"
                          {...register("preOrderMessageAr")}
                        />
                        <Input
                          label="مدة التسليم (أيام)"
                          type="number"
                          min="1"
                          placeholder="14"
                          {...register("preOrderDeliveryDays")}
                        />
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isSubmitting || createMutation.isPending}
                disabled={!!createdProductId}
              >
                <Save className="h-4 w-4" />
                {createdProductId ? "تم الحفظ ✓" : "حفظ المنتج"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
