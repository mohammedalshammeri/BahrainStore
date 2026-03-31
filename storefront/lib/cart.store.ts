"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface CartStore {
  items: CartItem[];
  couponCode: string;
  discount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQty: (productId: string, variantId: string | undefined, qty: number) => void;
  clearCart: () => void;
  setCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;
  get total(): number;
  get subtotal(): number;
  get itemCount(): number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: "",
      discount: 0,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          );
          if (existing) {
            const newQty = Math.min(existing.quantity + item.quantity, item.stock);
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.variantId === item.variantId
                  ? { ...i, quantity: newQty }
                  : i
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        })),

      updateQty: (productId, variantId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter(
                  (i) => !(i.productId === productId && i.variantId === variantId)
                )
              : state.items.map((i) =>
                  i.productId === productId && i.variantId === variantId
                    ? { ...i, quantity: Math.min(qty, i.stock) }
                    : i
                ),
        })),

      clearCart: () => set({ items: [], couponCode: "", discount: 0 }),

      setCoupon: (code, discount) => set({ couponCode: code, discount }),

      clearCoupon: () => set({ couponCode: "", discount: 0 }),

      get subtotal() {
        return get().items.reduce((acc, i) => acc + i.price * i.quantity, 0);
      },
      get total() {
        return Math.max(0, get().subtotal - get().discount);
      },
      get itemCount() {
        return get().items.reduce((acc, i) => acc + i.quantity, 0);
      },
    }),
    { name: "bazar-cart" }
  )
);
