"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, api } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/store/auth.store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { store, merchant, setStore, setMerchant } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    // LOGIC-007: Always verify the token with the server on mount.
    // The axios 401 interceptor in api.ts handles token refresh and redirects to /login on failure.
    // This covers the case where the cookie exists but the token has been revoked or is expired.
    api.get("/auth/me").then((res) => {
      if (res.data?.merchant) setMerchant(res.data.merchant);
      if (!store) {
        api.get("/stores").then((res2) => {
          const stores = res2.data?.stores ?? res2.data;
          if (Array.isArray(stores) && stores[0]) setStore(stores[0]);
        }).catch(() => {});
      }
    }).catch(() => {
      // 401 interceptor in api.ts already redirects to /login — nothing extra needed here
    });
  }, [router])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
