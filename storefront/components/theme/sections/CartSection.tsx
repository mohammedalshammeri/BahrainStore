"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { useCartStore } from "@/lib/cart.store";
import { api } from "@/lib/api";
import type { CartItem } from "@/lib/types";
import { formatBHD } from "@/lib/utils";
import { UpsellModal } from "@/components/ui/upsell-modal";
import type { SectionProps } from "../types";

const previewItems: CartItem[] = [
  {
    productId: "preview-product-1",
    name: "Preview Product",
    nameAr: "منتج تجريبي",
    price: 12.5,
    quantity: 2,
    image: null,
    stock: 10,
    variantName: "Large",
  },
  {
    productId: "preview-product-2",
    name: "Preview Accessory",
    nameAr: "ملحق تجريبي",
    price: 4.75,
    quantity: 1,
    image: null,
    stock: 8,
  },
];

function getStringSetting(settings: Record<string, unknown>, key: string, fallback: string) {
  return typeof settings[key] === "string" && settings[key] ? String(settings[key]) : fallback;
}

export default function CartSection({ section, globalData }: SectionProps) {
  const searchParams = useSearchParams();
  const subdomain = globalData.subdomain;
  const storeId = globalData.store.id;
  const isBuilderPreview = searchParams.get("__builderPreview") === "1";

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const subtotal = useCartStore((state) => state.subtotal);
  const total = useCartStore((state) => state.total);
  const discount = useCartStore((state) => state.discount);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const clearCoupon = useCartStore((state) => state.clearCoupon);

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const titleAr = getStringSetting(section.settings, "titleAr", "سلة التسوق");
  const emptyTitleAr = getStringSetting(section.settings, "emptyTitleAr", "سلتك فارغة");
  const emptyCtaAr = getStringSetting(section.settings, "emptyCtaAr", "ابدأ التسوق");
  const showCoupon = section.settings.showCoupon !== false;
  const showUpsell = section.settings.showUpsell !== false;

  const usingPreviewItems = isBuilderPreview && items.length === 0;
  const effectiveItems = usingPreviewItems ? previewItems : items;
  const effectiveSubtotal = usingPreviewItems
    ? previewItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : subtotal;
  const effectiveDiscount = usingPreviewItems ? 0 : discount;
  const effectiveTotal = usingPreviewItems ? effectiveSubtotal : total;

  const cartProductIds = useMemo(() => effectiveItems.map((item) => item.productId), [effectiveItems]);

  async function applyCoupon() {
    if (usingPreviewItems || !couponInput.trim() || !storeId) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await api.post("/coupons/validate", {
        storeId,
        code: couponInput.trim().toUpperCase(),
        orderValue: effectiveSubtotal,
      });
      const { coupon } = res.data;
      let discountVal = 0;
      if (coupon.type === "PERCENTAGE") discountVal = effectiveSubtotal * (coupon.value / 100);
      else if (coupon.type === "FIXED") discountVal = coupon.value;
      else if (coupon.type === "FREE_SHIPPING") discountVal = 0;
      setCoupon(couponInput.trim().toUpperCase(), discountVal);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setCouponError(error.response?.data?.error ?? "كود الخصم غير صحيح");
    } finally {
      setCouponLoading(false);
    }
  }

  if (effectiveItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto mb-6 h-20 w-20 text-gray-200" />
        <h1 className="mb-3 text-2xl font-bold text-gray-800">{emptyTitleAr}</h1>
        <p className="mb-8 text-gray-500">لم تقم بإضافة أي منتجات بعد</p>
        <Link
          href={`/${subdomain}/products`}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-semibold text-white transition hover:opacity-80"
        >
          <ShoppingBag className="h-5 w-5" />
          {emptyCtaAr}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{titleAr} ({effectiveItems.length})</h1>
        {usingPreviewItems && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">معاينة ببيانات تجريبية</span>
        )}
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-3">
          {effectiveItems.map((item) => (
            <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {item.image ? (
                  <Image src={item.image} alt={item.nameAr || item.name} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{item.nameAr || item.name}</p>
                {item.variantName && <p className="text-sm text-gray-500">{item.variantName}</p>}
                <p className="mt-0.5 text-sm font-bold text-gray-900">{formatBHD(item.price)}</p>

                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-full border border-gray-200 text-sm">
                    <button
                      onClick={() => !usingPreviewItems && updateQty(item.productId, item.variantId, item.quantity - 1)}
                      disabled={usingPreviewItems}
                      className="px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >-</button>
                    <span className="px-3 py-1 font-medium">{item.quantity}</span>
                    <button
                      onClick={() => !usingPreviewItems && updateQty(item.productId, item.variantId, item.quantity + 1)}
                      disabled={usingPreviewItems || item.quantity >= item.stock}
                      className="px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >+</button>
                  </div>
                  <span className="text-xs text-gray-400">الإجمالي: {formatBHD(item.price * item.quantity)}</span>
                </div>
              </div>

              <button
                onClick={() => !usingPreviewItems && removeItem(item.productId, item.variantId)}
                disabled={usingPreviewItems}
                className="self-start text-gray-400 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <Link href={`/${subdomain}/products`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" />
            متابعة التسوق
          </Link>

          {showUpsell && !usingPreviewItems && storeId && cartProductIds.length > 0 && (
            <UpsellModal storeId={storeId} cartProductIds={cartProductIds} />
          )}
        </div>

        <div className="lg:w-80 lg:flex-shrink-0">
          <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 font-bold text-gray-900">ملخص الطلب</h2>

            {showCoupon && (
              couponCode && !usingPreviewItems ? (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Tag className="h-4 w-4" />
                    <span className="font-medium">{couponCode}</span>
                  </div>
                  <button onClick={clearCoupon} className="text-gray-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(event) => setCouponInput(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && applyCoupon()}
                      placeholder={usingPreviewItems ? "معطل أثناء المعاينة" : "كود الخصم"}
                      disabled={usingPreviewItems}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || usingPreviewItems}
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium transition hover:bg-gray-200 disabled:opacity-60"
                    >
                      {couponLoading ? "..." : "تطبيق"}
                    </button>
                  </div>
                  {couponError && <p className="mt-1 text-xs text-red-500">{couponError}</p>}
                </div>
              )
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع الفرعي</span>
                <span>{formatBHD(effectiveSubtotal)}</span>
              </div>
              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>الخصم</span>
                  <span>- {formatBHD(effectiveDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>التوصيل</span>
                <span className="text-green-600">مجاني (يحدد عند الدفع)</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                <span>الإجمالي</span>
                <span>{formatBHD(effectiveTotal)}</span>
              </div>
            </div>

            <Link
              href={`/${subdomain}/checkout`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white transition hover:opacity-80"
            >
              إتمام الطلب
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}