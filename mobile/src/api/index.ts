import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_URL, STORAGE_KEYS } from '@/constants'
import type { NotificationItem } from '@/types'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.authToken)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// LOGIC-008: Track refresh state to queue concurrent requests
let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error?.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Wait for the ongoing refresh to complete, then retry with new token
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        // Attempt to refresh using stored refresh token
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.refreshToken)
        if (!refreshToken) throw new Error('NO_REFRESH_TOKEN')

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
        const newAccessToken: string = data.accessToken
        const newRefreshToken: string = data.refreshToken ?? refreshToken

        await SecureStore.setItemAsync(STORAGE_KEYS.authToken, newAccessToken)
        await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, newRefreshToken)

        const { useAuthStore } = await import('@/store/auth.store')
        useAuthStore.setState({ token: newAccessToken })

        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`
        processQueue(null, newAccessToken)
        original.headers.Authorization = `Bearer ${newAccessToken}`
        return api(original)
      } catch {
        // Refresh failed — log out
        processQueue(error, null)
        await SecureStore.deleteItemAsync(STORAGE_KEYS.authToken)
        await SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken)
        await SecureStore.deleteItemAsync(STORAGE_KEYS.user)
        await SecureStore.deleteItemAsync(STORAGE_KEYS.currentStoreId)
        const { useAuthStore } = await import('@/store/auth.store')
        useAuthStore.setState({ user: null, token: null, currentStore: null, isAuthenticated: false })
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

function unwrapResource<T>(payload: any, key: string): T {
  return (payload?.[key] ?? payload) as T
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeAlert(alert: any): NotificationItem {
  const typeMap: Record<string, NotificationItem['type']> = {
    LOW_STOCK: 'LOW_STOCK',
    OUT_OF_STOCK: 'LOW_STOCK',
    LARGE_ORDER: 'NEW_ORDER',
    FAILED_PAYMENT: 'PAYMENT',
    NEW_REVIEW: 'REVIEW',
    ABANDONED_CART: 'SYSTEM',
    SEASONAL_REMINDER: 'SYSTEM',
  }

  return {
    id: alert.id,
    type: typeMap[alert.type] ?? 'SYSTEM',
    title: alert.title,
    body: alert.message,
    isRead: alert.isRead,
    createdAt: alert.createdAt,
    data: alert.data,
  }
}

function normalizeProduct(product: any) {
  if (!product) return product

  return {
    ...product,
    comparePrice: product.comparePrice != null ? Number(product.comparePrice) : undefined,
    costPrice: product.costPrice != null ? Number(product.costPrice) : undefined,
    price: Number(product.price ?? 0),
    stock: Number(product.stock ?? 0),
    weight: product.weight != null ? Number(product.weight) : undefined,
    images: Array.isArray(product.images)
      ? product.images.map((image: any) => typeof image === 'string' ? image : image?.url).filter(Boolean)
      : [],
    trackInventory: product.trackInventory ?? product.trackStock ?? true,
  }
}

function normalizeProductListPayload(payload: any) {
  return {
    ...payload,
    products: Array.isArray(payload?.products) ? payload.products.map(normalizeProduct) : [],
  }
}

function normalizeOrder(order: any) {
  if (!order) return order

  const customer = order.customer
    ? {
        ...order.customer,
        name: order.customer.name || [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ').trim() || order.customer.phone || '',
      }
    : undefined

  return {
    ...order,
    subtotal: order.subtotal != null ? Number(order.subtotal) : undefined,
    shippingCost: order.shippingCost != null ? Number(order.shippingCost) : undefined,
    vatAmount: order.vatAmount != null ? Number(order.vatAmount) : undefined,
    discountAmount: order.discountAmount != null ? Number(order.discountAmount) : order.discount,
    total: Number(order.total ?? 0),
    customer,
    items: Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          ...item,
          productName: item.productName || item.nameAr || item.name || '',
          unitPrice: item.unitPrice != null ? Number(item.unitPrice) : Number(item.price ?? 0),
          price: Number(item.price ?? item.unitPrice ?? 0),
          total: Number(item.total ?? item.totalPrice ?? 0),
        }))
      : [],
  }
}

function normalizeStore(store: any) {
  if (!store) return store

  return {
    ...store,
    domain: store.domain || store.customDomain || undefined,
    phone: store.phone || store.settings?.phone || undefined,
  }
}

export default api

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const analyticsApi = {
  getDashboard: (storeId: string, period: 'today' | '7d' | '30d' | '90d') =>
    api.get(`/analytics/dashboard?storeId=${storeId}&period=${period}`),
  getRevenue: (storeId: string, startDate: string, endDate: string) =>
    api.get(`/analytics/revenue?storeId=${storeId}&startDate=${startDate}&endDate=${endDate}`),
  getTopProducts: (storeId: string, limit = 10) =>
    api.get(`/analytics/top-products?storeId=${storeId}&limit=${limit}`),
}

export const ordersApi = {
  list: async (storeId: string, params: Record<string, any> = {}) => {
    const res = await api.get('/orders', { params: { storeId, ...params } })
    return {
      ...res,
      data: {
        ...res.data,
        orders: Array.isArray(res.data?.orders) ? res.data.orders.map(normalizeOrder) : [],
      },
    }
  },
  get: async (id: string) => {
    const res = await api.get(`/orders/${id}`)
    return { ...res, data: normalizeOrder(unwrapResource(res.data, 'order')) }
  },
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
  addTracking: (id: string, trackingNumber: string, company: string) =>
    api.patch(`/orders/${id}/status`, { trackingNumber, shippingCompany: company }),
  printInvoice: (id: string) => api.get(`/orders/${id}/invoice`),
}

export const productsApi = {
  list: async (storeId: string, params: Record<string, any> = {}) => {
    const res = await api.get('/products', { params: { storeId, ...params } })
    return {
      ...res,
      data: normalizeProductListPayload(res.data),
    }
  },
  get: async (id: string) => {
    const res = await api.get(`/products/${id}/merchant`)
    return { ...res, data: normalizeProduct(unwrapResource(res.data, 'product')) }
  },
  create: async (data: any) => {
    const payload = {
      ...data,
      slug: data.slug || slugify(data.name || data.nameAr || `product-${Date.now()}`),
    }
    const res = await api.post('/products', payload)
    return { ...res, data: { ...res.data, product: normalizeProduct(unwrapResource(res.data, 'product')) } }
  },
  update: async (id: string, data: any) => {
    const res = await api.patch(`/products/${id}`, data)
    return { ...res, data: { ...res.data, product: normalizeProduct(unwrapResource(res.data, 'product')) } }
  },
  delete: (id: string) => api.delete(`/products/${id}`),
  updateStock: (id: string, stock: number) =>
    api.patch(`/products/${id}`, { stock }),
  search: async (storeId: string, q: string) => {
    const res = await api.get('/products', { params: { storeId, search: q, limit: 20 } })
    return { ...res, data: normalizeProductListPayload(res.data) }
  },
}

export const inventoryApi = {
  getLowStock: (storeId: string, threshold = 10) =>
    api.get(`/inventory/low-stock?storeId=${storeId}&threshold=${threshold}`),
  adjust: (productId: string, quantity: number, reason: string) =>
    api.post('/inventory/adjust', { productId, quantity, reason }),
}

export const customersApi = {
  list: (storeId: string, params: Record<string, any> = {}) =>
    api.get('/customers', { params: { storeId, ...params } }),
  get: (id: string) => api.get(`/customers/${id}`),
  getOrders: (customerId: string, storeId: string) =>
    api.get(`/customers/${customerId}/orders?storeId=${storeId}`),
}

export const posApi = {
  checkout: (data: {
    storeId: string
    items: { productId: string; variantId?: string; quantity: number; price: number }[]
    paymentMethod: string
    customerId?: string
    discountAmount?: number
    cashReceived?: number
  }) => api.post('/pos/checkout', data),

  searchProducts: async (storeId: string, q: string) => {
    const res = await api.get(`/pos/products/search?storeId=${storeId}&q=${encodeURIComponent(q)}`)
    return { ...res, data: normalizeProductListPayload(res.data) }
  },

  getByBarcode: async (storeId: string, barcode: string) => {
    const res = await api.get(`/pos/products/barcode/${barcode}?storeId=${storeId}`)
    return { ...res, data: { ...res.data, product: normalizeProduct(unwrapResource(res.data, 'product')) } }
  },

  getDailySummary: (storeId: string, date: string) =>
    api.get(`/pos/summary?storeId=${storeId}&date=${date}`),
}

export const storeApi = {
  get: async (id: string) => {
    const res = await api.get(`/stores/${id}`)
    return { ...res, data: normalizeStore(unwrapResource(res.data, 'store')) }
  },
  update: async (id: string, data: any) => {
    const res = await api.patch(`/stores/${id}`, data)
    return { ...res, data: normalizeStore(unwrapResource(res.data, 'store')) }
  },
  getStats: (id: string) => api.get(`/stores/${id}/stats`),
}

export const notificationsApi = {
  list: async (storeId: string) => {
    const res = await api.get('/alerts', { params: { storeId } })
    return { ...res, data: { notifications: (res.data?.alerts || []).map(normalizeAlert) } }
  },
  markRead: (id: string) => api.patch(`/alerts/${id}/read`),
  markAllRead: (storeId: string) => api.post('/alerts/read-all', { storeId }),
  registerToken: (token: string, storeId: string) => {
    if (!token || !storeId || /^ExponentPushToken|^ExpoPushToken/.test(token)) {
      return Promise.resolve({ data: { success: false, reason: 'mobile-push-not-configured' } })
    }

    return api.post('/push/register', { token, storeId })
  },
}
