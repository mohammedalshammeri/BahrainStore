"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setAuth } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

function GoogleCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { setMerchant, setStore } = useAuthStore();

  useEffect(() => {
    const at = params.get("at");
    const rt = params.get("rt");

    if (!at || !rt) {
      router.replace("/login?error=google_auth_failed");
      return;
    }

    // Clear tokens from URL immediately
    window.history.replaceState({}, "", "/google-callback");

    setAuth(at, rt);

    api
      .get("/auth/me")
      .then(async (res) => {
        setMerchant(res.data.merchant);
        try {
          const storeRes = await api.get("/stores");
          if (storeRes.data?.stores?.[0]) setStore(storeRes.data.stores[0]);
          else if (Array.isArray(storeRes.data) && storeRes.data[0]) setStore(storeRes.data[0]);
        } catch {
          // No store yet — will be created in onboarding
        }
        router.push("/");
      })
      .catch(() => {
        router.replace("/login?error=google_auth_failed");
      });
  }, [params, router, setMerchant, setStore]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">جاري تسجيل دخولك…</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
