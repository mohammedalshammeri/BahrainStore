"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle, CreditCard, Mail, MapPin, Phone, ShoppingBag, Truck, User } from "lucide-react";
import { useCartStore } from "@/lib/cart.store";
import { api } from "@/lib/api";
import type { CartItem } from "@/lib/types";
import { formatBHD } from "@/lib/utils";
import type { SectionProps } from "../types";

type Step = "info" | "address" | "payment" | "confirm";

interface ShippingRateQuote {
  id: string;
  name: string;
  nameAr?: string | null;
  provider?: string | null;
  finalPrice: number;
  estimatedDays?: number | null;
}

const PAYMENT_METHODS = [
  { value: "CASH_ON_DELIVERY", label: "الدفع عند الاستلام", icon: "💵" },
  { value: "TAP_PAYMENTS", label: "Tap Payments (بطاقة / Apple Pay / KNET)", icon: "💳" },
  { value: "MOYASAR", label: "Moyasar (mada / STC Pay / Visa)", icon: "🟢" },
];

const BAHRAIN_AREAS = [
  "المنامة", "المحرق", "الرفاع", "عيسى مدينة", "حمد مدينة",
  "سترة", "عالي", "توبلي", "الجفير", "بودي", "القضيبية", "الدراز",
  "باربار", "عراد", "البديع", "الدير", "دمستان", "كرزكان",
];

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

export default function CheckoutSection({ section, globalData }: SectionProps) {
  const searchParams = useSearchParams();
  const subdomain = globalData.subdomain;
  const storeId = globalData.store.id;
  const isBuilderPreview = searchParams.get("__builderPreview") === "1";

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const total = useCartStore((state) => state.total);
  const discount = useCartStore((state) => state.discount);
  const couponCode = useCartStore((state) => state.couponCode);
  const clearCart = useCartStore((state) => state.clearCart);

  const [step, setStep] = useState<Step>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [trackToken, setTrackToken] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [area, setArea] = useState("");
  const [block, setBlock] = useState("");
  const [road, setRoad] = useState("");
  const [building, setBuilding] = useState("");
  const [flat, setFlat] = useState("");
  const [notes, setNotes] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_DELIVERY");
  const [shippingRate, setShippingRate] = useState<ShippingRateQuote | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const titleAr = getStringSetting(section.settings, "titleAr", "إتمام الطلب");
  const emptyTitleAr = getStringSetting(section.settings, "emptyTitleAr", "سلتك فارغة");
  const emptyCtaAr = getStringSetting(section.settings, "emptyCtaAr", "تسوق الآن");
  const confirmButtonAr = getStringSetting(section.settings, "confirmButtonAr", "تأكيد الطلب");
  const showStepper = section.settings.showStepper !== false;

  const usingPreviewItems = isBuilderPreview && items.length === 0;
  const effectiveItems = usingPreviewItems ? previewItems : items;
  const effectiveSubtotal = usingPreviewItems
    ? previewItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : subtotal;
  const effectiveDiscount = usingPreviewItems ? 0 : discount;
  const effectiveTotal = usingPreviewItems ? effectiveSubtotal : total;
  const effectiveShippingCost = usingPreviewItems ? 0 : Number(shippingRate?.finalPrice ?? 0);
  const payableTotal = effectiveTotal + effectiveShippingCost;

  async function loadShippingRate() {
    if (usingPreviewItems) {
      setShippingRate(null);
      setShippingError("");
      return true;
    }

    if (!storeId) return false;

    setShippingLoading(true);
    setShippingError("");

    try {
      const res = await api.post("/shipping/calculate", {
        storeId,
        country: "BH",
        city: area,
        orderValue: Math.max(0, effectiveTotal),
      });

      const rates = Array.isArray(res.data?.rates) ? (res.data.rates as ShippingRateQuote[]) : [];
      if (rates.length === 0) {
        setShippingRate(null);
        setShippingError("لا توجد طريقة شحن متاحة لهذه المنطقة حالياً.");
        return false;
      }

      setShippingRate(rates[0]);
      return true;
    } catch {
      setShippingRate(null);
      setShippingError("تعذر احتساب تكلفة الشحن حالياً.");
      return false;
    } finally {
      setShippingLoading(false);
    }
  }

  async function saveAbandonedCart() {
    if (usingPreviewItems || !storeId || effectiveItems.length === 0) return;
    const cartData = effectiveItems.map((item) => ({ name: item.nameAr || item.name, quantity: item.quantity, price: item.price }));
    api.post("/whatsapp/save-cart", {
      storeId,
      phone: phone || undefined,
      email: email || undefined,
      firstName: firstName || undefined,
      cartData,
    }).catch(() => {});
  }

  async function placeOrder() {
    if (effectiveItems.length === 0) return;

    if (isBuilderPreview) {
      setOrderId("PREVIEW-ORDER");
      setTrackToken("preview-token");
      setStep("confirm");
      return;
    }

    if (!storeId) return;
    setLoading(true);
    setError("");
    try {
      const custRes = await api.post("/customers", {
        storeId,
        firstName,
        lastName,
        phone,
        email: email || undefined,
      });
      const customer = custRes.data.customer;

      const addrRes = await api.post("/customers/address", {
        customerId: customer.id,
        firstName,
        lastName,
        phone,
        label: "افتراضي",
        area,
        block,
        road,
        building,
        flat,
        isDefault: true,
      }).catch(() => ({ data: { address: null } }));
      const address = addrRes.data.address;

      const orderRes = await api.post("/orders", {
        storeId,
        customerId: customer.id,
        addressId: address?.id,
        paymentMethod,
        couponCode: couponCode || undefined,
        notes: notes || undefined,
        shippingCost: effectiveShippingCost,
        items: effectiveItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });

      const order = orderRes.data.order;
      const orderTrackToken = typeof orderRes.data.trackToken === "string" ? orderRes.data.trackToken : "";
      setTrackToken(orderTrackToken);

      api.post("/whatsapp/order-confirmed", { orderId: order.id }).catch(() => {});

      const baseUrl = typeof window !== "undefined"
        ? `${window.location.origin}/${subdomain}`
        : `/${subdomain}`;

      if (paymentMethod === "TAP_PAYMENTS") {
        const tapRes = await api.post("/payment/tap/charge", {
          orderId: order.id,
          storeId,
          successUrl: `${baseUrl}/payment/callback?gateway=tap&orderId=${order.id}`,
          cancelUrl: `${baseUrl}/checkout`,
        });
        clearCart();
        if (tapRes.data.redirectUrl) {
          window.location.href = tapRes.data.redirectUrl;
          return;
        }
      }

      if (paymentMethod === "MOYASAR") {
        const moyasarRes = await api.post("/payment/moyasar/charge", {
          orderId: order.id,
          storeId,
          successUrl: `${baseUrl}/payment/callback?gateway=moyasar&orderId=${order.id}`,
          backUrl: `${baseUrl}/checkout`,
        });
        clearCart();
        if (moyasarRes.data.redirectUrl) {
          window.location.href = moyasarRes.data.redirectUrl;
          return;
        }
      }

      setOrderId(order.orderNumber);
      api.post("/whatsapp/cart-recovered", {
        storeId,
        phone: phone || undefined,
        email: email || undefined,
      }).catch(() => {});
      clearCart();
      setStep("confirm");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error ?? "حدث خطأ أثناء تقديم الطلب");
    } finally {
      setLoading(false);
    }
  }

  if (effectiveItems.length === 0 && step !== "confirm") {
    return (
      <div className="py-24 text-center">
        <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-gray-200" />
        <p className="mb-4 text-gray-500">{emptyTitleAr}</p>
        <Link href={`/${subdomain}/products`} className="text-blue-600 hover:underline">
          {emptyCtaAr}
        </Link>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle className="mx-auto mb-6 h-20 w-20 text-green-500" />
        <h1 className="mb-3 text-2xl font-bold text-gray-900">تم تقديم طلبك!</h1>
        <p className="mb-2 text-gray-600">رقم الطلب: <span className="font-mono font-bold">{orderId}</span></p>
        <p className="mb-8 text-sm text-gray-500">سيتواصل معك فريق المتجر قريباً لتأكيد الطلب وترتيب التوصيل.</p>
        <div className="mx-auto flex max-w-xs flex-col gap-3">
          <Link
            href={`/${subdomain}/orders/${orderId}?token=${encodeURIComponent(trackToken)}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 font-semibold text-white transition hover:opacity-80"
          >
            تتبع طلبي
          </Link>
          <Link
            href={`/${subdomain}`}
            className="rounded-full border border-gray-200 py-3 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            العودة للمتجر
          </Link>
        </div>
      </div>
    );
  }

  const steps: { key: Step; label: string; icon: ReactNode }[] = [
    { key: "info", label: "بياناتك", icon: <User className="h-4 w-4" /> },
    { key: "address", label: "العنوان", icon: <MapPin className="h-4 w-4" /> },
    { key: "payment", label: "الدفع", icon: <CreditCard className="h-4 w-4" /> },
  ];
  const stepIdx = steps.findIndex((entry) => entry.key === step);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{titleAr}</h1>
        {usingPreviewItems && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">معاينة ببيانات تجريبية</span>
        )}
      </div>

      {showStepper && (
        <div className="mb-8 flex items-center gap-1">
          {steps.map((entry, index) => (
            <div key={entry.key} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  index < stepIdx
                    ? "bg-green-100 text-green-700"
                    : index === stepIdx
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {index < stepIdx ? <CheckCircle className="h-4 w-4" /> : entry.icon}
                {entry.label}
              </div>
              {index < steps.length - 1 && <div className={`h-0.5 w-6 ${index < stepIdx ? "bg-green-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          {step === "info" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-5 flex items-center gap-2 font-bold text-gray-900">
                <User className="h-5 w-5" /> بياناتك الشخصية
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">الاسم الأول *</label>
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">الاسم الأخير *</label>
                  <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700"><Phone className="me-1 inline h-3.5 w-3.5" />رقم الجوال (بحريني) *</label>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="3XXXXXXX" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700"><Mail className="me-1 inline h-3.5 w-3.5" />البريد الإلكتروني</label>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
              </div>
              <button
                disabled={!firstName.trim() || !lastName.trim() || !phone.trim()}
                onClick={() => {
                  saveAbandonedCart();
                  setStep("address");
                }}
                className="mt-6 w-full rounded-full bg-primary py-3 font-semibold text-white transition hover:opacity-80 disabled:opacity-50"
              >
                التالي - العنوان
              </button>
            </div>
          )}

          {step === "address" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-5 flex items-center gap-2 font-bold text-gray-900">
                <MapPin className="h-5 w-5" /> عنوان التوصيل
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">المنطقة *</label>
                  <select value={area} onChange={(event) => setArea(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400">
                    <option value="">اختر المنطقة</option>
                    {BAHRAIN_AREAS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">رقم المجمع (Block) *</label>
                  <input value={block} onChange={(event) => setBlock(event.target.value)} placeholder="e.g. 319" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">رقم الشارع (Road) *</label>
                  <input value={road} onChange={(event) => setRoad(event.target.value)} placeholder="e.g. 3610" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">رقم المبنى (Building) *</label>
                  <input value={building} onChange={(event) => setBuilding(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">رقم الشقة (Flat)</label>
                  <input value={flat} onChange={(event) => setFlat(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">ملاحظات للتوصيل</label>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="مثال: اتصل قبل الوصول" className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep("info")} className="flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-3 text-sm font-medium transition hover:bg-gray-50">
                  <ArrowRight className="h-4 w-4" /> رجوع
                </button>
                <button
                  disabled={!area || !block || !road || !building || shippingLoading}
                  onClick={async () => {
                    const ok = await loadShippingRate();
                    if (ok) setStep("payment");
                  }}
                  className="flex-1 rounded-full bg-primary py-3 font-semibold text-white transition hover:opacity-80 disabled:opacity-50"
                >
                  التالي - طريقة الدفع
                </button>
              </div>
            </div>
          )}

          {step === "payment" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-5 flex items-center gap-2 font-bold text-gray-900">
                <CreditCard className="h-5 w-5" /> طريقة الدفع
              </h2>
              <p className="mb-4 text-sm text-gray-500">نعرض هنا فقط وسائل الدفع الموصولة فعلياً وجاهزة للتنفيذ في هذا المتجر.</p>
              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <label
                    key={method.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition ${
                      paymentMethod === method.value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input type="radio" name="pm" value={method.value} checked={paymentMethod === method.value} onChange={(event) => setPaymentMethod(event.target.value)} className="accent-gray-900" />
                    <span className="text-xl">{method.icon}</span>
                    <span className="font-medium">{method.label}</span>
                    {method.value === "CASH_ON_DELIVERY" && (
                      <span className="ms-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        <Truck className="me-0.5 inline h-3 w-3" />ادفع عند الاستلام
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {shippingError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {shippingError}
                </div>
              )}

              {shippingRate && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between font-medium text-slate-900">
                    <span>طريقة الشحن المختارة</span>
                    <span>{formatBHD(effectiveShippingCost)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {(shippingRate.nameAr || shippingRate.name)}
                    {shippingRate.estimatedDays ? ` • ${shippingRate.estimatedDays} أيام تقريباً` : ""}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep("address")} className="flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-3 text-sm font-medium transition hover:bg-gray-50">
                  <ArrowRight className="h-4 w-4" /> رجوع
                </button>
                <button onClick={placeOrder} disabled={loading || shippingLoading || (!usingPreviewItems && !shippingRate)} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60">
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />جاري تقديم الطلب...</span>
                  ) : (
                    <><CheckCircle className="h-4 w-4" />{confirmButtonAr} - {formatBHD(payableTotal)}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:w-72 lg:flex-shrink-0">
          <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 font-bold text-gray-900">ملخص الطلب</h2>
            <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
              {effectiveItems.map((item) => (
                <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex justify-between text-sm">
                  <span className="max-w-[150px] truncate text-gray-700">
                    {item.nameAr || item.name}
                    {item.variantName && <span className="text-gray-400"> ({item.variantName})</span>}
                    <span className="text-gray-400"> ×{item.quantity}</span>
                  </span>
                  <span className="ms-2 flex-shrink-0 font-medium">{formatBHD(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع</span><span>{formatBHD(effectiveSubtotal)}</span>
              </div>
              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>خصم ({couponCode})</span><span>- {formatBHD(effectiveDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>التوصيل</span>
                <span className={effectiveShippingCost === 0 ? "text-green-600" : ""}>
                  {usingPreviewItems || !shippingRate
                    ? "سيُحتسب حسب المنطقة"
                    : effectiveShippingCost === 0
                      ? "مجاني"
                      : formatBHD(effectiveShippingCost)}
                </span>
              </div>
              {shippingRate && (
                <div className="text-xs text-gray-500">
                  {(shippingRate.nameAr || shippingRate.name)}{shippingRate.estimatedDays ? ` • ${shippingRate.estimatedDays} أيام` : ""}
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold text-gray-900">
                <span>الإجمالي</span><span>{formatBHD(payableTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}