"use client";

import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { formatBHD } from "@/lib/utils";
import { useCartStore } from "@/lib/cart.store";
import { ShoppingCart, ChevronRight, Package, CheckCircle, AlertCircle, Star, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { BackInStockButton } from "@/components/ui/back-in-stock-button";

async function fetchProductBySlug(storeId: string, slug: string) {
  // Products GET /store/:storeId returns list; we need to find by slug
  const res = await api.get(`/products/store/${storeId}?limit=100`);
  const found = (res.data.products as Product[]).find((p) => p.slug === slug);
  if (!found) throw new Error("not found");
  // Fetch full detail with images & variants
  const detail = await api.get(`/products/${found.id}`);
  return detail.data.product as Product;
}

async function fetchStoreId(subdomain: string) {
  const res = await api.get(`/stores/s/${subdomain}`);
  return res.data.store as { id: string };
}

export default function ProductDetailPage() {
  const params = useParams() as { subdomain: string; slug: string };
  const { subdomain, slug } = params;

  const { data: storeData } = useQuery({
    queryKey: ["store", subdomain],
    queryFn: () => fetchStoreId(subdomain),
    enabled: !!subdomain,
  });

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", storeData?.id, slug],
    queryFn: () => fetchProductBySlug(storeData!.id, slug),
    enabled: !!storeData?.id,
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ["related", product?.id],
    queryFn: async () => {
      const res = await api.get(`/products/${product!.id}/related`);
      return res.data.products as Product[];
    },
    enabled: !!product?.id,
  });

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);

  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (product?.options && product.options.length > 0) {
      const defaults: Record<string, string> = {};
      product.options.forEach((opt) => {
        if (opt.values.length > 0) defaults[opt.id] = opt.values[0].id;
      });
      setSelectedOptions(defaults);
    }
  }, [product]);

  // Find variant that matches all selected option values
  const selectedVariant = product?.variants?.find((v) =>
    product.options?.every((opt) => {
      const selectedValueId = selectedOptions[opt.id];
      return v.optionValues?.some((ov) => ov.optionValue.id === selectedValueId);
    })
  );

  // Fallback: if no options, pick first variant
  const activeVariant =
    selectedVariant ??
    (product?.variants && product.variants.length > 0 && (!product.options || product.options.length === 0)
      ? product.variants[0]
      : undefined);

  const price = activeVariant ? Number(activeVariant.price) : Number(product?.price ?? 0);
  const comparePrice = activeVariant?.comparePrice ?? product?.comparePrice;
  const stock = activeVariant ? activeVariant.stock : product?.stock ?? 0;
  const inStock = stock > 0;

  function handleAddToCart() {
    if (!product) return;
    addItem({
      productId: product.id,
      variantId: activeVariant?.id,
      name: product.name,
      nameAr: product.nameAr,
      price,
      quantity: qty,
      stock,
      image: activeVariant?.image ?? product.images?.[0]?.url,
      variantName: activeVariant?.nameAr || activeVariant?.name,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-100 animate-pulse rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-100 animate-pulse rounded w-3/4" />
            <div className="h-6 bg-gray-100 animate-pulse rounded w-1/3" />
            <div className="h-24 bg-gray-100 animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">المنتج غير موجود</p>
        <Link href={`/${subdomain}/products`} className="mt-4 inline-block text-blue-600 hover:underline">
          العودة للمنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href={`/${subdomain}`} className="hover:text-gray-800">الرئيسية</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/${subdomain}/products`} className="hover:text-gray-800">المنتجات</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">{product.nameAr || product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Images */}
        <div>
          <div className="aspect-square relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
            {product.images?.[activeImg]?.url ? (
              <Image
                src={product.images[activeImg].url}
                alt={product.nameAr || product.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300">
                <Package className="w-24 h-24" />
              </div>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i === activeImg ? "border-primary" : "border-gray-200"}`}
                >
                  <Image src={img.url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.nameAr || product.name}</h1>
              <WishlistButton
                item={{
                  productId: product.id,
                  subdomain,
                  name: product.name,
                  nameAr: product.nameAr,
                  slug: product.slug,
                  price: product.price,
                  comparePrice: product.comparePrice,
                  image: product.images?.[0]?.url ?? null,
                }}
                className="mt-1 flex-shrink-0 border border-gray-200"
              />
            </div>
            {product.category && (
              <Link
                href={`/${subdomain}/products?categoryId=${product.category.id}`}
                className="text-sm text-blue-600 hover:underline mt-1 inline-block"
              >
                {product.category.nameAr || product.category.name}
              </Link>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{formatBHD(price)}</span>
            {comparePrice && Number(comparePrice) > price && (
              <span className="text-lg text-gray-400 line-through">{formatBHD(Number(comparePrice))}</span>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-1.5 text-sm">
            {inStock ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-600 font-medium">متوفر في المخزون</span>
                {stock <= 5 && <span className="text-orange-500">(آخر {stock} قطع)</span>}
              </>
            ) : (product as any)?.isPreOrder ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-full">طلب مسبق</span>
                  {(product as any).preOrderDeliveryDays && (
                    <span className="text-xs text-gray-500">التسليم خلال {(product as any).preOrderDeliveryDays} يوم</span>
                  )}
                </div>
                {(product as any).preOrderMessageAr && (
                  <p className="text-sm text-indigo-700">{(product as any).preOrderMessageAr}</p>
                )}
              </div>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-medium">نفد من المخزون</span>
              </>
            )}
          </div>

          {/* Description */}
          {(product.descriptionAr || product.description) && (
            <div className="text-sm text-gray-600 leading-relaxed">
              {product.descriptionAr || product.description}
            </div>
          )}

          {/* Options (Color, Size, etc.) */}
          {product.options && product.options.length > 0 && (
            <div className="space-y-4">
              {product.options.map((opt) => {
                const isColor = opt.name.toLowerCase() === "color" || opt.nameAr === "اللون";
                return (
                  <div key={opt.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-700">{opt.nameAr || opt.name}:</span>
                      <span className="text-sm text-gray-500">
                        {opt.values.find((v) => v.id === selectedOptions[opt.id])?.valueAr || ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((val) => {
                        const isSelected = selectedOptions[opt.id] === val.id;
                        // Check stock for this option value combination
                        const variantForValue = product.variants?.find((v) =>
                          v.optionValues?.some((ov) => ov.optionValue.id === val.id)
                        );
                        const outOfStock = variantForValue ? variantForValue.stock === 0 : false;

                        if (isColor && val.color) {
                          return (
                            <button
                              key={val.id}
                              title={val.valueAr || val.value}
                              onClick={() =>
                                setSelectedOptions((prev) => ({ ...prev, [opt.id]: val.id }))
                              }
                              disabled={outOfStock}
                              className={`w-9 h-9 rounded-full border-4 transition
                                ${isSelected ? "border-gray-800 scale-110" : "border-white shadow-md"}
                                ${outOfStock ? "opacity-40 cursor-not-allowed" : "hover:scale-110 cursor-pointer"}`}
                              style={{ backgroundColor: val.color }}
                            />
                          );
                        }
                        return (
                          <button
                            key={val.id}
                            onClick={() =>
                              setSelectedOptions((prev) => ({ ...prev, [opt.id]: val.id }))
                            }
                            disabled={outOfStock}
                            className={`px-4 py-1.5 rounded-full text-sm border-2 transition
                              ${isSelected ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-400 text-gray-700"}
                              ${outOfStock ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                          >
                            {val.valueAr || val.value}
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

          {/* Fallback: simple variant buttons (no options) */}
          {(!product.options || product.options.length === 0) && product.variants && product.variants.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">الخيارات</label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedOptions({ _: v.id })}
                    disabled={v.stock === 0}
                    className={`px-4 py-2 rounded-full text-sm border-2 transition
                      ${selectedOptions["_"] === v.id ? "border-primary bg-primary text-white" : "border-gray-200 hover:border-gray-400 text-gray-700"}
                      ${v.stock === 0 ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                  >
                    {v.nameAr || v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + Add to cart */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-4 py-2 text-lg font-medium hover:bg-gray-50 transition"
              >-</button>
              <span className="px-4 py-2 text-sm font-semibold w-10 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(stock, q + 1))}
                disabled={!inStock}
                className="px-4 py-2 text-lg font-medium hover:bg-gray-50 transition disabled:opacity-40"
              >+</button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!inStock && !(product as any)?.isPreOrder}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm transition
                ${added ? "bg-green-500 text-white" 
                  : (product as any)?.isPreOrder && !inStock ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-primary hover:opacity-80 text-white"}
                ${!inStock && !(product as any)?.isPreOrder ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {added ? (
                <><CheckCircle className="w-4 h-4" /> تمت الإضافة!</>
              ) : (product as any)?.isPreOrder && !inStock ? (
                <><ShoppingCart className="w-4 h-4" /> اطلب مسبقاً (Pre-order)</>
              ) : (
                <><ShoppingCart className="w-4 h-4" /> أضف إلى السلة</>
              )}
            </button>
          </div>

          {/* Back in stock subscribe (when out of stock and NOT pre-order) */}
          {!inStock && !(product as any)?.isPreOrder && storeData?.id && (
            <BackInStockButton
              storeId={storeData.id}
              productId={product.id}
              variantId={activeVariant?.id}
            />
          )}

          {/* Quick checkout */}
          {inStock && (
            <Link
              href={`/${subdomain}/cart`}
              className="text-center py-3 rounded-full border-2 border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-white transition"
            >
              الذهاب إلى السلة
            </Link>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <div className="mt-12 border-t border-gray-100 pt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-5">منتجات مشابهة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                href={`/${subdomain}/products/${p.slug}`}
                className="group rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition"
              >
                <div className="aspect-square bg-gray-50 relative overflow-hidden">
                  {p.images?.[0]?.url ? (
                    <Image
                      src={p.images[0].url}
                      alt={p.nameAr || p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package className="w-10 h-10 text-gray-200" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{p.nameAr || p.name}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatBHD(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      {product && storeData && (
        <ReviewsSection storeId={storeData.id} productId={product.id} />
      )}
    </div>
  );
}

/* ─────────────── Reviews Section ─────────────── */

interface Review {
  id: string;
  name: string;
  rating: number;
  title?: string;
  body?: string;
  createdAt: string;
  isVerified: boolean;
}

function StarRow({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-${size} h-${size} ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function ReviewsSection({ storeId, productId }: { storeId: string; productId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", rating: 5, title: "", body: "" });
  const [submitted, setSubmitted] = useState(false);

  const { data } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const res = await api.get(`/reviews/public/${storeId}/${productId}`);
      return res.data as { reviews: Review[]; averageRating: number; count: number };
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/reviews/public", { storeId, productId, ...form }),
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            تقييمات العملاء
            {count > 0 && <span className="text-sm font-normal text-gray-500">({count} تقييم)</span>}
          </h2>
          {count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRow rating={Math.round(avg)} />
              <span className="text-sm text-gray-600">{avg.toFixed(1)} / 5</span>
            </div>
          )}
        </div>
        {!showForm && !submitted && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition"
          >
            أضف تقييمك
          </button>
        )}
      </div>

      {/* Submit form */}
      {showForm && (
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4">أضف تقييمك</h3>
          <div className="space-y-3">
            {/* Star picker */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">تقييمك</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} onClick={() => setForm((f) => ({ ...f, rating: i }))}>
                    <Star className={`w-6 h-6 transition ${i <= form.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الاسم *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="اسمك"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                  placeholder="example@email.com"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">عنوان التقييم</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                placeholder="ملخص رأيك"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">تفاصيل التقييم</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                placeholder="شاركنا تجربتك مع المنتج..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => submitMutation.mutate()}
                disabled={!form.name || submitMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {submitMutation.isPending ? "جاري الإرسال..." : "إرسال التقييم"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          شكراً لتقييمك! سيتم نشره بعد المراجعة.
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          لا توجد تقييمات بعد، كن أول من يقيّم هذا المنتج!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-800">{r.name}</span>
                    {r.isVerified && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">مشتري موثوق</span>
                    )}
                  </div>
                  <StarRow rating={r.rating} size={3} />
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(r.createdAt).toLocaleDateString("ar-BH")}
                </span>
              </div>
              {r.title && <p className="text-sm font-medium text-gray-800 mb-1">{r.title}</p>}
              {r.body && <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
