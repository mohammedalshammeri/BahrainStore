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
    // Re-hydrate merchant + store from API (handles page refreshes / new tabs)
    if (!merchant) {
      api.get("/auth/me").then((res) => {
        if (res.data?.merchant) setMerchant(res.data.merchant);
      }).catch(() => {});
    }
    if (!store) {
      api.get("/stores").then((res) => {
        const stores = res.data?.stores ?? res.data;
        if (Array.isArray(stores) && stores[0]) setStore(stores[0]);
      }).catch(() => {});
    }
  }, [router, merchant, store, setMerchant, setStore]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
