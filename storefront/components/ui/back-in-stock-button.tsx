"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { BellRing, X, CheckCircle2 } from "lucide-react";

interface BackInStockButtonProps {
  storeId: string;
  productId: string;
  variantId?: string;
}

export function BackInStockButton({ storeId, productId, variantId }: BackInStockButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const subscribe = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/back-in-stock/public/subscribe", {
        storeId,
        productId,
        variantId: variantId ?? null,
        email: email.trim(),
      });
      setDone(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? "حدث خطأ، يرجى المحاولة لاحقًا");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>سيتم إخطارك فور توفر المنتج!</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-full border-2 border-gray-800 text-gray-800 font-semibold text-sm hover:bg-gray-800 hover:text-white transition"
      >
        <BellRing className="w-4 h-4" />
        أعلمني عند التوفر
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">أعلمني عند التوفر</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">أدخل بريدك الإلكتروني وسنخطرك فور توفر هذا المنتج.</p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && subscribe()}
              placeholder="example@email.com"
              dir="ltr"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-800 mb-3"
            />
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <button
              onClick={subscribe}
              disabled={loading || !email.trim()}
              className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {loading ? "جاري التسجيل..." : "تسجيل"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
