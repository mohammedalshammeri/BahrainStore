"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowRight, Save, CheckCircle } from "lucide-react";
import Link from "next/link";

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
});

type FormData = z.infer<typeof schema>;

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: productData, isLoading: productLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await api.get(`/products/${id}`);
      return res.data.product;
    },
    enabled: !!id,
  });

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
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { stock: 0, trackStock: true, isActive: true },
  });

  // Pre-fill form once product data is loaded
  useEffect(() => {
    if (productData) {
      reset({
        name: productData.name ?? "",
        nameAr: productData.nameAr ?? "",
        description: productData.description ?? "",
        descriptionAr: productData.descriptionAr ?? "",
        price: Number(productData.price),
        comparePrice: productData.comparePrice ? Number(productData.comparePrice) : undefined,
        cost: productData.costPrice ? Number(productData.costPrice) : undefined,
        sku: productData.sku ?? "",
        stock: productData.stock ?? 0,
        categoryId: productData.category?.id ?? "",
        trackStock: productData.trackInventory ?? true,
        isActive: productData.isActive ?? true,
      });
    }
  }, [productData, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.patch(`/products/${id}`, {
        ...data,
        comparePrice: data.comparePrice || undefined,
        cost: data.cost || undefined,
        categoryId: data.categoryId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? "حدث خطأ أثناء الحفظ");
    },
  });

  if (productLoading) {
    return (
      <div className="flex flex-col">
        <Header title="تعديل المنتج" />
        <div className="p-6 grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-4">
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title={`تعديل: ${productData?.nameAr ?? productData?.name ?? "المنتج"}`} />

      <div className="p-6">
        <div className="mb-4">
          <Link
            href="/products"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 w-fit"
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

        {saved && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4" />
            تم حفظ التغييرات بنجاح
          </div>
        )}

        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
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
                </CardBody>
              </Card>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isSubmitting || updateMutation.isPending}
                disabled={!isDirty && !updateMutation.isPending}
              >
                <Save className="h-4 w-4" />
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
