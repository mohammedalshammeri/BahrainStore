// ─── API Client — Axios instance with JWT injection ──────────────────────────

import axios, { type AxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_URL, STORAGE_KEYS } from '@/constants'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject token on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.authToken)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally (token expired)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.authToken)
      await SecureStore.deleteItemAsync(STORAGE_KEYS.user)
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// ─── Analytics / Dashboard ────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: (storeId: string, period: 'today' | '7d' | '30d' | '90d') =>
    api.get(`/analytics/dashboard?storeId=${storeId}&period=${period}`),
  getRevenue: (storeId: string, startDate: string, endDate: string) =>
    api.get(`/analytics/revenue?storeId=${storeId}&startDate=${startDate}&endDate=${endDate}`),
  getTopProducts: (storeId: string, limit = 10) =>
    api.get(`/analytics/top-products?storeId=${storeId}&limit=${limit}`),
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (storeId: string, params: Record<string, any> = {}) =>
    api.get('/orders', { params: { storeId, ...params } }),
  get: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
  addTracking: (id: string, trackingNumber: string, company: string) =>
    api.put(`/orders/${id}/tracking`, { trackingNumber, company }),
  printInvoice: (id: string) => api.get(`/orders/${id}/invoice`),
}

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (storeId: string, params: Record<string, any> = {}) =>
    api.get('/products', { params: { storeId, ...params } }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  updateStock: (id: string, stock: number) =>
    api.put(`/products/${id}/stock`, { stock }),
  search: (storeId: string, q: string) =>
    api.get(`/products/search`, { params: { storeId, q, limit: 20 } }),
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  getLowStock: (storeId: string, threshold = 10) =>
    api.get(`/inventory/low-stock?storeId=${storeId}&threshold=${threshold}`),
  adjust: (productId: string, quantity: number, reason: string) =>
    api.post('/inventory/adjust', { productId, quantity, reason }),
}

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (storeId: string, params: Record<string, any> = {}) =>
    api.get('/customers', { params: { storeId, ...params } }),
  get: (id: string) => api.get(`/customers/${id}`),
  getOrders: (customerId: string, storeId: string) =>
    api.get(`/customers/${customerId}/orders?storeId=${storeId}`),
}

// ─── POS ──────────────────────────────────────────────────────────────────────
export const posApi = {
  checkout: (data: {
    storeId: string
    items: { productId: string; variantId?: string; quantity: number; price: number }[]
    paymentMethod: string
    customerId?: string
    discountAmount?: number
    cashReceived?: number
  }) => api.post('/pos/checkout', data),

  searchProducts: (storeId: string, q: string) =>
    api.get(`/pos/products/search?storeId=${storeId}&q=${encodeURIComponent(q)}`),

  getByBarcode: (storeId: string, barcode: string) =>
    api.get(`/pos/products/barcode/${barcode}?storeId=${storeId}`),

  getDailySummary: (storeId: string, date: string) =>
    api.get(`/pos/summary?storeId=${storeId}&date=${date}`),
}

// ─── Store settings ───────────────────────────────────────────────────────────
export const storeApi = {
  get: (id: string) => api.get(`/stores/${id}`),
  update: (id: string, data: any) => api.put(`/stores/${id}`, data),
  getStats: (id: string) => api.get(`/stores/${id}/stats`),
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (storeId: string) => api.get(`/notifications?storeId=${storeId}`),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: (storeId: string) => api.put(`/notifications/read-all`, { storeId }),
  registerToken: (token: string, storeId: string) =>
    api.post('/push/register', { token, storeId }),
}
