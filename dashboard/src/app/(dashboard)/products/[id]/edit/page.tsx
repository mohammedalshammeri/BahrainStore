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
import { VariantEditor } from "@/components/products/variant-editor";
import { ArrowRight, Save, CheckCircle, ShoppingBag, Download, Clock, Gift, RefreshCw, Wrench, Layers, SlidersHorizontal, Plus } from "lucide-react";
import Link from "next/link";

const PRODUCT_TYPES = [
  { id: "physical",     label: "مادي",        desc: "منتج يُشحن للعميل",          icon: ShoppingBag,       color: "indigo"  },
  { id: "digital",      label: "رقمي",         desc: "ملف قابل للتحميل",           icon: Download,          color: "blue"    },
  { id: "preorder",     label: "طلب مسبق",    desc: "يُباع قبل توفّره",            icon: Clock,             color: "amber"   },
  { id: "gift_card",    label: "بطاقة هدية",  desc: "رصيد يُستخدم في المتجر",     icon: Gift,              color: "pink"    },
  { id: "subscription", label: "اشتراك",       desc: "دفع دوري متكرر",             icon: RefreshCw,         color: "violet"  },
  { id: "service",      label: "خدمة",         desc: "لا يحتاج شحناً",             icon: Wrench,            color: "teal"    },
  { id: "bundle",       label: "مجموعة",       desc: "عدة منتجات بسعر واحد",       icon: Layers,            color: "orange"  },
  { id: "custom",       label: "تخصيص",        desc: "العميل يُحدد تفاصيله",        icon: SlidersHorizontal, color: "rose"    },
] as const;

type ProductTypeId = typeof PRODUCT_TYPES[number]["id"];

const ICON_COLORS: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
  blue:   "bg-blue-50 text-blue-600 border-blue-200",
  amber:  "bg-amber-50 text-amber-600 border-amber-200",
  pink:   "bg-pink-50 text-pink-600 border-pink-200",
  violet: "bg-violet-50 text-violet-600 border-violet-200",
  teal:   "bg-teal-50 text-teal-600 border-teal-200",
  orange: "bg-orange-50 text-orange-600 border-orange-200",
  rose:   "bg-rose-50 text-rose-600 border-rose-200",
};

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
  const [productType, setProductType] = useState<ProductTypeId>("physical");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [catError, setCatError] = useState("");

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
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { stock: 0, trackStock: true, isActive: true },
  });

  // Pre-fill form once product data is loaded
  useEffect(() => {
    if (productData) {
      let derivedType: ProductTypeId = "physical";
      if (productData.isDigital) derivedType = "digital";
      else if (productData.isPreOrder) derivedType = "preorder";
      setProductType(derivedType);
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

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; nameAr: string }) =>
      api.post("/categories", { ...data, storeId: store!.id }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["categories", store?.id] });
      const newId = res.data?.id ?? res.data?.category?.id ?? "";
      setValue("categoryId", newId);
      setShowNewCat(false);
      setNewCatName("");
      setNewCatNameAr("");
      setCatError("");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setCatError(e?.response?.data?.message ?? "فشل إنشاء الفئة");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.patch(`/products/${id}`, {
        ...data,
        comparePrice: data.comparePrice || undefined,
        cost: data.cost || undefined,
        categoryId: data.categoryId || undefined,
        isDigital: productType === "digital",
        isPreOrder: productType === "preorder",
        trackStock: productType !== "digital" && productType !== "service",
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

              {/* Variants */}
              <Card>
                <CardHeader title="متغيرات المنتج" />
                <CardBody>
                  <VariantEditor
                    productId={id}
                    basePrice={productData?.price ? Number(productData.price) : 0}
                    baseStock={productData?.stock ?? 0}
                    initialOptions={productData?.options ?? []}
                    initialVariants={productData?.variants ?? []}
                  />
                </CardBody>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Product Type */}
              <Card>
                <CardHeader title="نوع المنتج" />
                <CardBody className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {PRODUCT_TYPES.map((t) => {
                      const Icon = t.icon;
                      const isSelected = productType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setProductType(t.id)}
                          className={`flex items-start gap-2 rounded-xl border-2 p-2.5 text-right transition-all ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`mt-0.5 shrink-0 h-7 w-7 rounded-lg border flex items-center justify-center ${isSelected ? ICON_COLORS[t.color] : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-tight ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{t.label}</p>
                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">{t.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {productType === "digital" && (
                    <div className="border-t border-slate-100 pt-3">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">رابط الملف الرقمي</label>
                      <input
                        type="url"
                        placeholder="https://example.com/file.pdf"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {productType === "preorder" && (
                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">رسالة الطلب المسبق (عربي)</label>
                        <input
                          type="text"
                          placeholder="سيُشحن خلال 14 يوم"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">مدة التسليم (أيام)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="14"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {productType === "gift_card" && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 bg-pink-50 border border-pink-100 rounded-xl px-3 py-2">
                        أدخل قيمة البطاقة في حقل السعر. العميل يحصل على كود يستخدمه بقيمة مساوية للسعر.
                      </p>
                    </div>
                  )}

                  {productType === "subscription" && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                        الاشتراكات المتكررة. السعر سيُحصّل دورياً — الربط بالبوابة يتم من صفحة الطلبات.
                      </p>
                    </div>
                  )}

                  {productType === "bundle" && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                        أضف المنتجات في وصف المجموعة. ربط المنتجات معاً سيكون متاحاً قريباً.
                      </p>
                    </div>
                  )}

                  {productType === "custom" && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                        العميل سيتمكن من إضافة ملاحظة تخصيص عند الطلب (اسم، لون، مقاس خاص).
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>

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
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">الفئة</label>
                      <button
                        type="button"
                        onClick={() => { setShowNewCat(v => !v); setCatError(""); }}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        <Plus className="h-3 w-3" />
                        {showNewCat ? "إلغاء" : "فئة جديدة"}
                      </button>
                    </div>
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
                    {showNewCat && (
                      <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                        <input
                          type="text"
                          placeholder="Category name (English)"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="اسم الفئة (عربي)"
                          value={newCatNameAr}
                          onChange={(e) => setNewCatNameAr(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {catError && <p className="text-xs text-red-600">{catError}</p>}
                        <button
                          type="button"
                          disabled={!newCatName.trim() || createCategoryMutation.isPending}
                          onClick={() => createCategoryMutation.mutate({ name: newCatName.trim(), nameAr: newCatNameAr.trim() })}
                          className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {createCategoryMutation.isPending ? "جارٍ الإضافة..." : "إضافة الفئة"}
                        </button>
                      </div>
                    )}
                  </div>

                  {(productType === "physical" || productType === "preorder" || productType === "bundle") && (
                    <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
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
                  )}
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
