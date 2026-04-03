// ─── POS Cart Store — in-memory state for the POS session ────────────────────

import { create } from 'zustand'
import type { POSCartItem, POSSession, Product } from '@/types'

interface POSState {
  session: POSSession | null
  isCheckingOut: boolean

  initSession: (storeId: string) => void
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setDiscount: (percent: number) => void
  setPaymentMethod: (method: POSSession['paymentMethod']) => void
  setCashReceived: (amount: number) => void
  setCustomer: (customerId: string) => void
  clearSession: () => void
  getTotal: () => number
}

const VAT_RATE = 0.10 // 10% VAT

function recalculate(items: POSCartItem[], discountAmount: number): Pick<POSSession, 'subtotal' | 'vatAmount' | 'total'> {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const vatAmount = afterDiscount * VAT_RATE
  const total = afterDiscount + vatAmount
  return { subtotal, vatAmount, total }
}

export const usePOSStore = create<POSState>((set, get) => ({
  session: null,
  isCheckingOut: false,

  initSession: (storeId) => {
    set({
      session: {
        storeId,
        items: [],
        subtotal: 0,
        discountAmount: 0,
        vatAmount: 0,
        total: 0,
        paymentMethod: 'CASH',
      },
    })
  },

  addItem: (product, quantity = 1) => {
    const { session } = get()
    if (!session) return
    const existing = session.items.find(i => i.productId === product.id)
    let items: POSCartItem[]
    if (existing) {
      items = session.items.map(i =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + quantity, total: (i.quantity + quantity) * i.unitPrice }
          : i
      )
    } else {
      items = [...session.items, {
        productId: product.id,
        productName: product.name,
        unitPrice: Number(product.price),
        quantity,
        total: Number(product.price) * quantity,
      }]
    }
    const calcs = recalculate(items, session.discountAmount)
    set({ session: { ...session, items, ...calcs } })
  },

  removeItem: (productId) => {
    const { session } = get()
    if (!session) return
    const items = session.items.filter(i => i.productId !== productId)
    const calcs = recalculate(items, session.discountAmount)
    set({ session: { ...session, items, ...calcs } })
  },

  updateQuantity: (productId, quantity) => {
    const { session } = get()
    if (!session) return
    if (quantity <= 0) { get().removeItem(productId); return }
    const items = session.items.map(i =>
      i.productId === productId
        ? { ...i, quantity, total: quantity * i.unitPrice }
        : i
    )
    const calcs = recalculate(items, session.discountAmount)
    set({ session: { ...session, items, ...calcs } })
  },

  setDiscount: (percent) => {
    const { session } = get()
    if (!session) return
    const discountAmount = session.subtotal * (percent / 100)
    const calcs = recalculate(session.items, discountAmount)
    set({ session: { ...session, discountAmount, ...calcs } })
  },

  setPaymentMethod: (method) => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, paymentMethod: method } })
  },

  setCashReceived: (amount) => {
    const { session } = get()
    if (!session) return
    const change = Math.max(0, amount - session.total)
    set({ session: { ...session, cashReceived: amount, change } })
  },

  setCustomer: (customerId) => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, customerId } })
  },

  clearSession: () => {
    const storeId = get().session?.storeId
    if (storeId) get().initSession(storeId)
  },

  getTotal: () => get().session?.total ?? 0,
}))
