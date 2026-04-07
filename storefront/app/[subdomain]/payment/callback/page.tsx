"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { CheckCircle, XCircle, Loader2, RefreshCcw } from "lucide-react";

type PaymentStatus = "loading" | "paid" | "failed" | "pending";

export default function PaymentCallbackPage() {
  const params = useParams() as { subdomain: string };
  const { subdomain } = params;
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [trackToken, setTrackToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const gateway = searchParams.get("gateway");
    const orderId = searchParams.get("orderId");

    if (!gateway || !orderId) {
      setStatus("failed");
      setErrorMsg("بيانات الدفع غير مكتملة");
      return;
    }

    async function verify() {
      try {
        if (gateway === "tap") {
          // Tap appends ?tap_id=chg_xxx to the redirect URL
          const chargeId = searchParams.get("tap_id") ?? searchParams.get("chargeId");
          if (!chargeId) {
            setStatus("failed");
            setErrorMsg("لم يتم استلام معرّف الدفع من Tap");
            return;
          }
          const res = await api.get(`/payment/tap/verify?chargeId=${chargeId}&orderId=${orderId}`);
          setOrderNumber(res.data.orderNumber ?? null);
          setTrackToken(res.data.trackToken ?? null);
          setStatus(res.data.status === "PAID" ? "paid" : res.data.status === "FAILED" ? "failed" : "pending");
        } else if (gateway === "moyasar") {
          // Moyasar appends ?id=xxx&status=paid
          const paymentId = searchParams.get("id");
          if (!paymentId) {
            setStatus("failed");
            setErrorMsg("لم يتم استلام معرّف الدفع من Moyasar");
            return;
          }
          const res = await api.get(`/payment/moyasar/verify?id=${paymentId}&orderId=${orderId}`);
          setOrderNumber(res.data.orderNumber ?? null);
          setTrackToken(res.data.trackToken ?? null);
          setStatus(res.data.status === "PAID" ? "paid" : res.data.status === "FAILED" ? "failed" : "pending");
        } else {
          setStatus("failed");
          setErrorMsg("بوابة دفع غير معروفة");
        }
      } catch {
        setStatus("failed");
        setErrorMsg("حدث خطأ أثناء التحقق من الدفع");
      }
    }

    verify();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-gray-600 font-medium">جاري التحقق من دفعتك...</p>
        <p className="text-sm text-gray-400">الرجاء الانتظار، لا تغلق هذه الصفحة</p>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">تمت عملية الدفع بنجاح!</h1>
        {orderNumber && (
          <p className="text-gray-600 mb-2">
            رقم الطلب: <span className="font-mono font-bold">{orderNumber}</span>
          </p>
        )}
        <p className="text-gray-500 text-sm mb-8">تم تأكيد طلبك وسيتم معالجته في أقرب وقت.</p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          {orderNumber && (
            <Link
              href={`/${subdomain}/orders/${orderNumber}?token=${encodeURIComponent(trackToken ?? "")}`}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-indigo-700 transition"
            >
              تتبع طلبي
            </Link>
          )}
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

  if (status === "pending") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <RefreshCcw className="w-16 h-16 mx-auto text-amber-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">الدفع قيد المعالجة</h1>
        <p className="text-gray-500 text-sm mb-8">
          لم تتأكد الدفعة بعد، عادةً تكتمل خلال دقيقة. يمكنك العودة لاحقاً للتحقق من حالة طلبك.
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          {orderNumber && (
            <Link
              href={`/${subdomain}/orders/${orderNumber}?token=${encodeURIComponent(trackToken ?? "")}`}
              className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white font-semibold px-8 py-3 rounded-full hover:bg-amber-600 transition"
            >
              تتبع طلبي
            </Link>
          )}
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

  // Failed
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <XCircle className="w-20 h-20 mx-auto text-red-500 mb-6" />
      <h1 className="text-2xl font-bold text-gray-900 mb-3">فشلت عملية الدفع</h1>
      <p className="text-gray-500 text-sm mb-2">
        {errorMsg || "تعذر إتمام الدفع، يرجى المحاولة مرة أخرى."}
      </p>
      <p className="text-gray-400 text-xs mb-8">لم يتم خصم أي مبلغ من حسابك.</p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Link
          href={`/${subdomain}/checkout`}
          className="inline-flex items-center justify-center gap-2 bg-red-500 text-white font-semibold px-8 py-3 rounded-full hover:bg-red-600 transition"
        >
          إعادة المحاولة
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
