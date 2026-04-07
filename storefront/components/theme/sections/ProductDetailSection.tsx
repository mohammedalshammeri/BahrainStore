"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, ChevronRight, MessageSquare, Package, RotateCcw, ShieldCheck, ShoppingCart, Star, Truck } from "lucide-react";
import { BackInStockButton } from "@/components/ui/back-in-stock-button";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart.store";
import { formatBHD } from "@/lib/utils";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

interface Review {
  id: string;
  name: string;
  rating: number;
  title?: string;
  body?: string;
  createdAt: string;
  isVerified: boolean;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
      ))}
    </div>
  );
}

function getStringSetting(settings: Record<string, unknown>, key: string, fallback = "") {
  const value = settings[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function ProductReviews({ storeId, productId }: { storeId: string; productId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", rating: 5, title: "", body: "" });

  const { data } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const res = await api.get(`/reviews/public/${storeId}/${productId}`);
      return res.data as { reviews: Review[]; averageRating: number; count: number };
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post("/reviews/public", { storeId, productId, ...form }),
    onSuccess: () => {
      setSubmitted(true);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
    },
  });

  const reviews = data?.reviews ?? [];
  const avg = data?.averageRating ?? 0;
  const count = data?.count ?? 0;

  return (
    <div className="mt-12 border-t border-gray-100 pt-10" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            تقييمات العملاء
            {count > 0 && <span className="text-sm font-normal text-gray-500">({count} تقييم)</span>}
          </h2>
          {count > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <StarRow rating={Math.round(avg)} />
              <span className="text-sm text-gray-600">{avg.toFixed(1)} / 5</span>
            </div>
          )}
        </div>
        {!showForm && !submitted && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-full border border-indigo-200 px-4 py-2 text-sm text-indigo-600 transition hover:bg-indigo-50"
          >
            أضف تقييمك
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <h3 className="mb-4 font-semibold text-gray-800">أضف تقييمك</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">تقييمك</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} onClick={() => setForm((current) => ({ ...current, rating: value }))} type="button">
                    <Star className={`h-6 w-6 ${value <= form.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="الاسم" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="البريد الإلكتروني" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="عنوان التقييم" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="اكتب رأيك هنا" className="min-h-[110px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !form.name || !form.email}
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitMutation.isPending ? "جاري الإرسال..." : "إرسال التقييم"}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {submitted && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">تم إرسال التقييم وسيظهر بعد المراجعة.</div>}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-400">لا توجد تقييمات بعد لهذا المنتج.</div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{review.name}</p>
                  <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString("ar-BH")}</p>
                </div>
                <StarRow rating={review.rating} />
              </div>
              {review.title && <p className="mb-1 font-medium text-gray-800">{review.title}</p>}
              {review.body && <p className="text-sm leading-7 text-gray-600">{review.body}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ProductDetailSection({ section, globalData }: SectionProps) {
  const product = globalData.product;
  const settings = section.settings as Record<string, unknown>;
  const showBreadcrumbs = settings.showBreadcrumbs !== false;
  const showCategoryLink = settings.showCategoryLink !== false;
  const showReviews = settings.showReviews !== false;
  const showQuickCartLink = settings.showQuickCartLink !== false;
  const showTrustBadges = settings.showTrustBadges !== false;
  const showStickyMobileCart = settings.showStickyMobileCart !== false;
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (!product?.options?.length) return;
    const defaults: Record<string, string> = {};
    product.options.forEach((option) => {
      if (option.values.length > 0) defaults[option.id] = option.values[0].id;
    });
    setSelectedOptions(defaults);
  }, [product]);

  if (!product) {
    return (
      <SectionLayout section={section}>
        <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-16 text-center text-gray-400">
          لا توجد بيانات منتج لعرضها في هذا القسم.
        </div>
      </SectionLayout>
    );
  }

  const currentProduct = product;

  const selectedVariant = currentProduct.variants?.find((variant) =>
    currentProduct.options?.every((option) => {
      const selectedValueId = selectedOptions[option.id];
      return variant.optionValues?.some((entry) => entry.optionValue.id === selectedValueId);
    })
  );

  const fallbackVariantId = selectedOptions["_"];
  const activeVariant = selectedVariant
    ?? currentProduct.variants?.find((variant) => variant.id === fallbackVariantId)
    ?? (currentProduct.variants && currentProduct.variants.length > 0 && (!currentProduct.options || currentProduct.options.length === 0) ? currentProduct.variants[0] : undefined);

  const price = activeVariant ? Number(activeVariant.price) : Number(currentProduct.price ?? 0);
  const comparePrice = activeVariant?.comparePrice ?? currentProduct.comparePrice;
  const stock = activeVariant ? activeVariant.stock : currentProduct.stock ?? 0;
  const inStock = stock > 0;
  const shippingPromise = getStringSetting(settings, "shippingPromiseAr", "يتم تجهيز الطلب خلال 24 ساعة في أيام العمل");
  const lowStockMessage = getStringSetting(settings, "lowStockMessageAr", "كمية محدودة، اطلب الآن قبل النفاد");
  const stickyCartLabel = getStringSetting(settings, "stickyCartLabelAr", "إضافة سريعة للسلة");
  const trustBadges = [
    getStringSetting(settings, "trustBadge1Ar", "دفع آمن ومشفر"),
    getStringSetting(settings, "trustBadge2Ar", "شحن سريع داخل الخليج"),
    getStringSetting(settings, "trustBadge3Ar", "استرجاع مرن عند الحاجة"),
  ].filter(Boolean);

  function handleAddToCart() {
    addItem({
      productId: currentProduct.id,
      variantId: activeVariant?.id,
      name: currentProduct.name,
      nameAr: currentProduct.nameAr,
      price,
      quantity: qty,
      stock,
      image: activeVariant?.image ?? currentProduct.images?.[0]?.url,
      variantName: activeVariant?.nameAr || activeVariant?.name,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <SectionLayout section={section}>
      <section className="mx-auto max-w-5xl px-4 py-8">
        {showBreadcrumbs && (
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-gray-500">
            <Link href={`/${globalData.subdomain}`} className="hover:text-gray-800">الرئيسية</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/${globalData.subdomain}/products`} className="hover:text-gray-800">المنتجات</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-gray-900">{product.nameAr || product.name}</span>
          </nav>
        )}

        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
              {product.images?.[activeImg]?.url ? (
                <Image src={currentProduct.images[activeImg].url} alt={currentProduct.nameAr || currentProduct.name} fill className="object-cover" priority />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-300"><Package className="h-24 w-24" /></div>
              )}
            </div>
            {currentProduct.images && currentProduct.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {currentProduct.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImg(index)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${index === activeImg ? "border-primary" : "border-gray-200"}`}
                  >
                    <Image src={image.url} alt="" width={64} height={64} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{currentProduct.nameAr || currentProduct.name}</h1>
                <WishlistButton
                  item={{
                    productId: currentProduct.id,
                    subdomain: globalData.subdomain,
                    name: currentProduct.name,
                    nameAr: currentProduct.nameAr,
                    slug: currentProduct.slug,
                    price: currentProduct.price,
                    comparePrice: currentProduct.comparePrice,
                    image: currentProduct.images?.[0]?.url ?? null,
                  }}
                  className="mt-1 flex-shrink-0 border border-gray-200"
                />
              </div>
              {showCategoryLink && currentProduct.category && (
                <Link href={`/${globalData.subdomain}/products?categoryId=${currentProduct.category.id}`} className="mt-1 inline-block text-sm text-blue-600 hover:underline">
                  {currentProduct.category.nameAr || currentProduct.category.name}
                </Link>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900">{formatBHD(price)}</span>
              {comparePrice && Number(comparePrice) > price && <span className="text-lg text-gray-400 line-through">{formatBHD(Number(comparePrice))}</span>}
            </div>

            {showTrustBadges && trustBadges.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {trustBadges.map((badge, index) => (
                  <div key={`${badge}-${index}`} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    {index === 0 && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                    {index === 1 && <Truck className="h-4 w-4 text-sky-600" />}
                    {index === 2 && <RotateCcw className="h-4 w-4 text-amber-600" />}
                    <span>{badge}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-sm">
              {inStock ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-600">متوفر في المخزون</span>
                  {stock <= 5 && <span className="text-orange-500">(آخر {stock} قطع)</span>}
                </>
              ) : currentProduct.isPreOrder ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">طلب مسبق</span>
                    {currentProduct.preOrderDeliveryDays && <span className="text-xs text-gray-500">التسليم خلال {currentProduct.preOrderDeliveryDays} يوم</span>}
                  </div>
                  {currentProduct.preOrderMessageAr && <p className="text-sm text-indigo-700">{currentProduct.preOrderMessageAr}</p>}
                </div>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-500">نفد من المخزون</span>
                </>
              )}
            </div>

            {inStock && stock <= 5 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {lowStockMessage}
              </div>
            )}

            {shippingPromise && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span>{shippingPromise}</span>
                </div>
              </div>
            )}

            {(currentProduct.descriptionAr || currentProduct.description) && (
              <div className="text-sm leading-relaxed text-gray-600">{currentProduct.descriptionAr || currentProduct.description}</div>
            )}

            {currentProduct.options && currentProduct.options.length > 0 && (
              <div className="space-y-4">
                {currentProduct.options.map((option) => {
                  const isColor = option.name.toLowerCase() === "color" || option.nameAr === "اللون";
                  return (
                    <div key={option.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">{option.nameAr || option.name}:</span>
                        <span className="text-sm text-gray-500">{option.values.find((value) => value.id === selectedOptions[option.id])?.valueAr || ""}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value) => {
                          const isSelected = selectedOptions[option.id] === value.id;
                          const variantForValue = currentProduct.variants?.find((variant) => variant.optionValues?.some((entry) => entry.optionValue.id === value.id));
                          const outOfStock = variantForValue ? variantForValue.stock === 0 : false;

                          if (isColor && value.color) {
                            return (
                              <button
                                key={value.id}
                                title={value.valueAr || value.value}
                                onClick={() => setSelectedOptions((current) => ({ ...current, [option.id]: value.id }))}
                                disabled={outOfStock}
                                className={`h-9 w-9 rounded-full border-4 transition ${isSelected ? "scale-110 border-gray-800" : "border-white shadow-md"} ${outOfStock ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:scale-110"}`}
                                style={{ backgroundColor: value.color }}
                              />
                            );
                          }

                          return (
                            <button
                              key={value.id}
                              onClick={() => setSelectedOptions((current) => ({ ...current, [option.id]: value.id }))}
                              disabled={outOfStock}
                              className={`rounded-full border-2 px-4 py-1.5 text-sm transition ${isSelected ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700 hover:border-gray-400"} ${outOfStock ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                            >
                              {value.valueAr || value.value}
                              {outOfStock && " (نفد)"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(!currentProduct.options || currentProduct.options.length === 0) && currentProduct.variants && currentProduct.variants.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">الخيارات</label>
                <div className="flex flex-wrap gap-2">
                  {currentProduct.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedOptions({ _: variant.id })}
                      disabled={variant.stock === 0}
                      className={`rounded-full border-2 px-4 py-2 text-sm transition ${selectedOptions._ === variant.id ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-700 hover:border-gray-400"} ${variant.stock === 0 ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                    >
                      {variant.nameAr || variant.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-full border border-gray-200">
                <button onClick={() => setQty((current) => Math.max(1, current - 1))} className="px-4 py-2 text-lg font-medium transition hover:bg-gray-50">-</button>
                <span className="w-10 px-4 py-2 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty((current) => Math.min(stock || current + 1, current + 1))} disabled={!inStock} className="px-4 py-2 text-lg font-medium transition hover:bg-gray-50 disabled:opacity-40">+</button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!inStock && !currentProduct.isPreOrder}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition ${added ? "bg-green-500" : currentProduct.isPreOrder && !inStock ? "bg-indigo-600 hover:bg-indigo-700" : "bg-primary hover:opacity-80"} ${!inStock && !currentProduct.isPreOrder ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {added ? <><CheckCircle className="h-4 w-4" /> تمت الإضافة!</> : currentProduct.isPreOrder && !inStock ? <><ShoppingCart className="h-4 w-4" /> اطلب مسبقاً</> : <><ShoppingCart className="h-4 w-4" /> أضف إلى السلة</>}
              </button>
            </div>

            {!inStock && !currentProduct.isPreOrder && (
              <BackInStockButton storeId={globalData.store.id} productId={currentProduct.id} variantId={activeVariant?.id} />
            )}

            {showQuickCartLink && inStock && (
              <Link href={`/${globalData.subdomain}/cart`} className="rounded-full border-2 border-primary py-3 text-center text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                الذهاب إلى السلة
              </Link>
            )}
          </div>
        </div>

        {showReviews && <ProductReviews storeId={globalData.store.id} productId={currentProduct.id} />}
      </section>

      {showStickyMobileCart && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{currentProduct.nameAr || currentProduct.name}</p>
              <p className="text-sm text-slate-500">{formatBHD(price)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!inStock && !currentProduct.isPreOrder}
              className={`flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition ${added ? "bg-green-500" : currentProduct.isPreOrder && !inStock ? "bg-indigo-600 hover:bg-indigo-700" : "bg-primary hover:opacity-80"} ${!inStock && !currentProduct.isPreOrder ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <ShoppingCart className="h-4 w-4" />
              {stickyCartLabel}
            </button>
          </div>
        </div>
      )}
    </SectionLayout>
  );
}