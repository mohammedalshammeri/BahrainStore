import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./types";

const MAX_COMPARE = 4;

interface CompareStore {
  items: Product[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Product) => void;
  isComparing: (productId: string) => boolean;
  clear: () => void;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) => {
        const { items } = get();
        if (items.length >= MAX_COMPARE || items.find((i) => i.id === product.id)) return;
        set((s) => ({ items: [...s.items, product] }));
      },
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== productId) })),
      toggleItem: (product) => {
        const { items } = get();
        if (items.find((i) => i.id === product.id)) {
          set((s) => ({ items: s.items.filter((i) => i.id !== product.id) }));
        } else {
          if (items.length >= MAX_COMPARE) return;
          set((s) => ({ items: [...s.items, product] }));
        }
      },
      isComparing: (productId) => get().items.some((i) => i.id === productId),
      clear: () => set({ items: [] }),
    }),
    { name: "compare-store" }
  )
);
