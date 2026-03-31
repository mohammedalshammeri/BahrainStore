"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCartStore } from "@/lib/cart.store";
import { formatBHD } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  User, Phone, Mail, MapPin, CreditCard, Truck,
  CheckCircle, AlertCircle, ShoppingBag, ArrowRight,
} from "lucide-react";

type Step = "info" | "address" | "payment" | "confirm";

const PAYMENT_METHODS = [
  { value: "CASH_ON_DELIVERY", label: "الدفع عند الاستلام", icon: "💵" },
  { value: "BENEFIT_PAY", label: "BenefitPay", icon: "🏦" },
  { value: "TAP_PAYMENTS", label: "Tap Payments (بطاقة / Apple Pay / KNET)", icon: "💳" },
  { value: "MOYASAR", label: "Moyasar (mada / STC Pay / Visa)", icon: "🟢" },
  { value: "CREDIMAX", label: "Credimax / VISA", icon: "💳" },
  { value: "APPLE_PAY", label: "Apple Pay", icon: "🍎" },
  { value: "GOOGLE_PAY", label: "Google Pay", icon: "🟦" },
  { value: "TABBY", label: "Tabby — ادفع بعد 14 يوم", icon: "🟢" },
  { value: "TAMARA", label: "تمارا — 3 دفعات بدون فوائد", icon: "🟣" },
];

const BAHRAIN_AREAS = [
  "المنامة", "المحرق", "الرفاع", "عيسى مدينة", "حمد مدينة",
  "سترة", "عالي", "توبلي", "الجفير", "بودي", "القضيبية", "الدراز",
  "باربار", "عراد", "البديع", "الدير", "دمستان", "كرزكان",
];

export default function CheckoutPage() {
  const params = useParams() as { subdomain: string };
  const { subdomain } = params;
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal);
  const total = useCartStore((s) => s.total);
  const discount = useCartStore((s) => s.discount);
  const couponCode = useCartStore((s) => s.couponCode);
  const clearCart = useCartStore((s) => s.clearCart);

  const [step, setStep] = useState<Step>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  // Customer info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Address
  const [area, setArea] = useState("");
  const [block, setBlock] = useState("");
  const [road, setRoad] = useState("");
  const [building, setBuilding] = useState("");
  const [flat, setFlat] = useState("");
  const [notes, setNotes] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_DELIVERY");

  const { data: storeData } = useQuery({
    queryKey: ["store", subdomain],
    queryFn: async () => {
      const res = await api.get(`/stores/s/${subdomain}`);
      return res.data.store as { id: string };
    },
  });

  async function saveAbandonedCart() {
    if (!storeData?.id || items.length === 0) return;
    const cartData = items.map((i) => ({ name: i.nameAr || i.name, quantity: i.quantity, price: i.price }));
    api.post("/whatsapp/save-cart", {
      storeId: storeData.id,
      phone: phone || undefined,
      email: email || undefined,
      firstName: firstName || undefined,
      cartData,
    }).catch(() => {});
  }

  async function placeOrder() {
    if (!storeData?.id || items.length === 0) return;
    setLoading(true);
    setError("");
    try {
      // 1. Create/get customer
      const custRes = await api.post("/customers", {
        storeId: storeData.id,
        firstName,
        lastName,
        phone,
        email: email || undefined,
      });
      const customer = custRes.data.customer;

      // 2. Create address
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

      // 3. Place order
      const orderRes = await api.post("/orders", {
        storeId: storeData.id,
        customerId: customer.id,
        addressId: address?.id,
        paymentMethod,
        couponCode: couponCode || undefined,
        notes: notes || undefined,
        shippingCost: 0,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      });

      const order = orderRes.data.order;

      // Send WhatsApp order confirmation (fire & forget)
      api.post("/whatsapp/order-confirmed", { orderId: order.id }).catch(() => {});

      const baseUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${subdomain}`
          : `/${subdomain}`;

      // 4a. Redirect to Tap Payments
      if (paymentMethod === "TAP_PAYMENTS") {
        const tapRes = await api.post("/payment/tap/charge", {
          orderId: order.id,
          storeId: storeData.id,
          successUrl: `${baseUrl}/payment/callback?gateway=tap&orderId=${order.id}`,
          cancelUrl: `${baseUrl}/checkout`,
        });
        clearCart();
        if (tapRes.data.redirectUrl) {
          window.location.href = tapRes.data.redirectUrl;
          return;
        }
      }

      // 4b. Redirect to Moyasar
      if (paymentMethod === "MOYASAR") {
        const moyasarRes = await api.post("/payment/moyasar/charge", {
          orderId: order.id,
          storeId: storeData.id,
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
      // Mark abandoned cart as recovered (fire & forget)
      api.post("/whatsapp/cart-recovered", {
        storeId: storeData?.id,
        phone: phone || undefined,
        email: email || undefined,
      }).catch(() => {});
      clearCart();
      setStep("confirm");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? "حدث خطأ أثناء تقديم الطلب");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && step !== "confirm") {
    return (
      <div className="text-center py-24">
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-200 mb-4" />
        <p className="text-gray-500 mb-4">سلتك فارغة</p>
        <Link href={`/${subdomain}/products`} className="text-blue-600 hover:underline">
          تسوق الآن
        </Link>
      </div>
    );
  }

  // Confirmation screen
  if (step === "confirm") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">تم تقديم طلبك!</h1>
        <p className="text-gray-600 mb-2">رقم الطلب: <span className="font-mono font-bold">{orderId}</span></p>
        <p className="text-gray-500 text-sm mb-8">سيتواصل معك فريق المتجر قريباً لتأكيد الطلب وترتيب التوصيل.</p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link
            href={`/${subdomain}/orders/${orderId}`}
            className="inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-8 py-3 rounded-full hover:opacity-80 transition"
          >
            تتبع طلبي
          </Link>
          <Link
            href={`/${subdomain}`}
            className="text-center py-3 border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            العودة للمتجر
          </Link>
        </div>
      </div>
    );
  }

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: "info", label: "بياناتك", icon: <User className="w-4 h-4" /> },
    { key: "address", label: "العنوان", icon: <MapPin className="w-4 h-4" /> },
    { key: "payment", label: "الدفع", icon: <CreditCard className="w-4 h-4" /> },
  ];

  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إتمام الطلب</h1>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition
              ${i < stepIdx ? "bg-green-100 text-green-700" : i === stepIdx ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}>
              {i < stepIdx ? <CheckCircle className="w-4 h-4" /> : s.icon}
              {s.label}
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 w-6 ${i < stepIdx ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Form */}
        <div className="flex-1">
          {/* Step 1: Info */}
          {step === "info" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-5">
                <User className="w-5 h-5" /> بياناتك الشخصية
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">الاسم الأول *</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">الاسم الأخير *</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    <Phone className="w-3.5 h-3.5 inline me-1" />رقم الجوال (بحريني) *
                  </label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="3XXXXXXX"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    <Mail className="w-3.5 h-3.5 inline me-1" />البريد الإلكتروني
                  </label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
              </div>
              <button
                disabled={!firstName.trim() || !lastName.trim() || !phone.trim()}
                onClick={() => { saveAbandonedCart(); setStep("address"); }}
                className="mt-6 w-full bg-primary hover:opacity-80 text-white font-semibold py-3 rounded-full transition disabled:opacity-50"
              >
                التالي — العنوان
              </button>
            </div>
          )}

          {/* Step 2: Address */}
          {step === "address" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-5">
                <MapPin className="w-5 h-5" /> عنوان التوصيل
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">المنطقة *</label>
                  <select value={area} onChange={(e) => setArea(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white">
                    <option value="">اختر المنطقة</option>
                    {BAHRAIN_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">رقم المجمع (Block) *</label>
                  <input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="e.g. 319"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">رقم الشارع (Road) *</label>
                  <input value={road} onChange={(e) => setRoad(e.target.value)} placeholder="e.g. 3610"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">رقم المبنى (Building) *</label>
                  <input value={building} onChange={(e) => setBuilding(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">رقم الشقة (Flat)</label>
                  <input value={flat} onChange={(e) => setFlat(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات للتوصيل</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="مثال: اتصل قبل الوصول"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep("info")}
                  className="flex items-center gap-1.5 px-5 py-3 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition">
                  <ArrowRight className="w-4 h-4" /> رجوع
                </button>
                <button
                  disabled={!area || !block || !road || !building}
                  onClick={() => setStep("payment")}
                  className="flex-1 bg-primary hover:opacity-80 text-white font-semibold py-3 rounded-full transition disabled:opacity-50"
                >
                  التالي — طريقة الدفع
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === "payment" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-5">
                <CreditCard className="w-5 h-5" /> طريقة الدفع
              </h2>
              <div className="space-y-3">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition
                      ${paymentMethod === m.value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" name="pm" value={m.value} checked={paymentMethod === m.value}
                      onChange={(e) => setPaymentMethod(e.target.value)} className="accent-gray-900" />
                    <span className="text-xl">{m.icon}</span>
                    <span className="font-medium">{m.label}</span>
                    {m.value === "CASH_ON_DELIVERY" && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ms-auto">
                        <Truck className="w-3 h-3 inline me-0.5" />ادفع عند الاستلام
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep("address")}
                  className="flex items-center gap-1.5 px-5 py-3 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition">
                  <ArrowRight className="w-4 h-4" /> رجوع
                </button>
                <button
                  onClick={placeOrder}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-full transition disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />جاري تقديم الطلب...</span>
                  ) : (
                    <><CheckCircle className="w-4 h-4" />تأكيد الطلب — {formatBHD(total)}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-20">
            <h2 className="font-bold text-gray-900 mb-4">ملخص الطلب</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate max-w-[150px]">
                    {item.nameAr || item.name}
                    {item.variantName && <span className="text-gray-400"> ({item.variantName})</span>}
                    <span className="text-gray-400"> ×{item.quantity}</span>
                  </span>
                  <span className="font-medium flex-shrink-0 ms-2">{formatBHD(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع</span><span>{formatBHD(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>خصم ({couponCode})</span><span>- {formatBHD(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>التوصيل</span><span className="text-green-600">مجاني</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
                <span>الإجمالي</span><span>{formatBHD(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
