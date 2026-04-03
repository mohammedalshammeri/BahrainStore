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
import { ArrowRight, Save, ShoppingBag, Download, Clock, Gift, RefreshCw, Wrench, Layers, SlidersHorizontal, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { VariantEditor } from "@/components/products/variant-editor";

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
  isDigital: z.boolean().default(false),
  digitalFileUrl: z.string().optional(),
  isPreOrder: z.boolean().default(false),
  preOrderMessageAr: z.string().optional(),
  preOrderDeliveryDays: z.coerce.number().optional(),
  productType: z.string().default("physical"),
});

type FormData = z.infer<typeof schema>;

export default function NewProductPage() {
  const router = useRouter();
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [productType, setProductType] = useState<ProductTypeId>("physical");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [catError, setCatError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiProductName, setAiProductName] = useState("");

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { stock: 0, trackStock: true, isActive: true, isDigital: false, productType: "physical" },
  });

  const handleAiGenerate = async () => {
    if (!aiProductName.trim() || !store) return;
    setAiLoading(true);
    try {
      const res = await api.post("/ai/product-writer", {
        storeId: store.id,
        productName: aiProductName.trim(),
        language: "both",
      });
      const d = res.data?.data;
      if (d?.ar?.longDescription) setValue("descriptionAr", d.ar.longDescription);
      if (d?.en?.longDescription) setValue("description", d.en.longDescription);
      if (d?.ar?.shortDescription && !aiProductName.includes("|")) setValue("nameAr", aiProductName.trim());
      setShowAiPanel(false);
      setAiProductName("");
    } catch {
      // silent fail
    } finally {
      setAiLoading(false);
    }
  };

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

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return api.post("/products", {
        ...(data as any),
        storeId: store!.id,
        productType,
        isDigital: productType === "digital",
        isPreOrder: productType === "preorder",
        trackStock: productType !== "digital" && productType !== "service",
      });
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
                <CardHeader title="معلومات المنتج الأساسية" action={
                  <button
                    type="button"
                    onClick={() => setShowAiPanel(v => !v)}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 transition"
                  >
                    <Sparkles className="h-3 w-3" />
                    توليد بالذكاء الاصطناعي
                  </button>
                } />
                <CardBody className="space-y-4">
                  {showAiPanel && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-violet-700">أدخل اسم المنتج وسيولّد الذكاء الاصطناعي الوصف عربي + إنجليزي تلقائياً</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="مثال: حقيبة جلد يدوية الصنع"
                          value={aiProductName}
                          onChange={e => setAiProductName(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleAiGenerate()}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                        <button
                          type="button"
                          disabled={!aiProductName.trim() || aiLoading}
                          onClick={handleAiGenerate}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {aiLoading ? "جاري..." : <><Sparkles className="h-3 w-3" />توليد</>}
                        </button>
                      </div>
                    </div>
                  )}
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

                  {/* Conditional fields per type */}
                  {productType === "digital" && (
                    <div className="border-t border-slate-100 pt-3">
                      <Input
                        label="رابط الملف الرقمي"
                        placeholder="https://example.com/file.pdf"
                        type="url"
                        hint="رابط مباشر للملف بعد الشراء"
                        {...register("digitalFileUrl")}
                      />
                    </div>
                  )}

                  {productType === "preorder" && (
                    <div className="border-t border-slate-100 pt-3 space-y-3">
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
