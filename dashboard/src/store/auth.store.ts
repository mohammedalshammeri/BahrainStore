import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Merchant, Store } from "@/types";
import { clearAuth } from "@/lib/api";

interface AuthState {
  merchant: Merchant | null;
  store: Store | null;
  setMerchant: (merchant: Merchant) => void;
  setStore: (store: Store) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      merchant: null,
      store: null,
      setMerchant: (merchant) => set({ merchant }),
      setStore: (store) => set({ store }),
      logout: () => {
        clearAuth();
        set({ merchant: null, store: null });
      },
    }),
    {
      name: "bazar-auth",
      partialize: (state) => ({ merchant: state.merchant, store: state.store }),
    }
  )
);
