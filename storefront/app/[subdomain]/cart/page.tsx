"use client";

import Image from "next/image";
import Link from "next/link";
import { useCartStore } from "@/lib/cart.store";
import { formatBHD } from "@/lib/utils";
import { Trash2, ShoppingBag, ArrowLeft, Tag, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { UpsellModal } from "@/components/ui/upsell-modal";

export default function CartPage() {
  const params = useParams() as { subdomain: string };
  const { subdomain } = params;

  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const subtotal = useCartStore((s) => s.subtotal);
  const total = useCartStore((s) => s.total);
  const discount = useCartStore((s) => s.discount);
  const couponCode = useCartStore((s) => s.couponCode);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const clearCoupon = useCartStore((s) => s.clearCoupon);

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const { data: storeData } = useQuery({
    queryKey: ["store", subdomain],
    queryFn: async () => {
      const res = await api.get(`/stores/s/${subdomain}`);
      return res.data.store as { id: string };
    },
  });

  async function applyCoupon() {
    if (!couponInput.trim() || !storeData?.id) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await api.post("/coupons/validate", {
        storeId: storeData.id,
        code: couponInput.trim().toUpperCase(),
        orderValue: subtotal,
      });
      const { coupon } = res.data;
      let discountVal = 0;
      if (coupon.type === "PERCENTAGE") discountVal = subtotal * (coupon.value / 100);
      else if (coupon.type === "FIXED") discountVal = coupon.value;
      else if (coupon.type === "FREE_SHIPPING") discountVal = 0; // handled in checkout
      setCoupon(couponInput.trim().toUpperCase(), discountVal);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setCouponError(error.response?.data?.error ?? "كود الخصم غير صحيح");
    } finally {
      setCouponLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="w-20 h-20 mx-auto text-gray-200 mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-3">سلتك فارغة</h1>
        <p className="text-gray-500 mb-8">لم تقم بإضافة أي منتجات بعد</p>
        <Link
          href={`/${subdomain}/products`}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3 rounded-full hover:opacity-80 transition"
        >
          <ShoppingBag className="w-5 h-5" />
          ابدأ التسوق
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">سلة التسوق ({items.length})</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Items */}
        <div className="flex-1 space-y-3">
          {items.map((item) => (
            <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex gap-4 bg-white rounded-xl border border-gray-200 p-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                {item.image ? (
                  <Image src={item.image} alt={item.nameAr || item.name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.nameAr || item.name}</p>
                {item.variantName && <p className="text-sm text-gray-500">{item.variantName}</p>}
                <p className="text-sm font-bold text-gray-900 mt-0.5">{formatBHD(item.price)}</p>

                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border border-gray-200 rounded-full overflow-hidden text-sm">
                    <button
                      onClick={() => updateQty(item.productId, item.variantId, item.quantity - 1)}
                      className="px-3 py-1 hover:bg-gray-50"
                    >-</button>
                    <span className="px-3 py-1 font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.productId, item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                    >+</button>
                  </div>
                  <span className="text-xs text-gray-400">الإجمالي: {formatBHD(item.price * item.quantity)}</span>
                </div>
              </div>

              <button
                onClick={() => removeItem(item.productId, item.variantId)}
                className="text-gray-400 hover:text-red-500 transition self-start"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <Link href={`/${subdomain}/products`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mt-2">
            <ArrowLeft className="w-4 h-4" />
            متابعة التسوق
          </Link>

          {storeData?.id && (
            <UpsellModal
              storeId={storeData.id}
              cartProductIds={items.map((i) => i.productId)}
            />
          )}
        </div>

        {/* Summary */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-20">
            <h2 className="font-bold text-gray-900 mb-4">ملخص الطلب</h2>

            {/* Coupon */}
            {couponCode ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <Tag className="w-4 h-4" />
                  <span className="font-medium">{couponCode}</span>
                </div>
                <button onClick={clearCoupon} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    placeholder="كود الخصم"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition disabled:opacity-60"
                  >
                    {couponLoading ? "..." : "تطبيق"}
                  </button>
                </div>
                {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
              </div>
            )}

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع الفرعي</span>
                <span>{formatBHD(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>الخصم</span>
                  <span>- {formatBHD(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>التوصيل</span>
                <span className="text-green-600">مجاني (يحدد عند الدفع)</span>
              </div>
              <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-gray-900 text-base">
                <span>الإجمالي</span>
                <span>{formatBHD(total)}</span>
              </div>
            </div>

            <Link
              href={`/${subdomain}/checkout`}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-primary hover:opacity-80 text-white font-semibold py-3 rounded-full transition"
            >
              إتمام الطلب
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
