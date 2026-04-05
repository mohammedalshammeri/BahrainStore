// ─── Bazar Merchant Mobile App — Type Definitions ────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  token?: string
  role?: string
  stores?: Store[]
  currentStoreId?: string
}

export interface Store {
  id: string
  name: string
  nameAr?: string
  slug?: string
  subdomain?: string
  domain?: string
  logo?: string
  currency?: string
  plan?: string
  phone?: string
  isActive?: boolean
  role?: string
}

export interface Product {
  id: string
  name: string
  nameAr: string
  slug: string
  price: number
  comparePrice?: number
  costPrice?: number
  sku?: string
  barcode?: string
  stock: number
  isActive: boolean
  isFeatured: boolean
  images?: string[]
  description?: string
  weight?: number
  category?: { id: string; name: string; nameAr: string }
}

export interface OrderItem {
  id: string
  productId: string
  variantId?: string
  productName: string
  name?: string
  nameAr?: string
  variantOptions?: string
  sku?: string
  price: number
  unitPrice?: number
  quantity: number
  total: number
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: string
  subtotal?: number
  shippingCost?: number
  vatAmount?: number
  tax?: number
  discountAmount?: number
  discount?: number
  total: number
  notes?: string
  trackingNumber?: string
  shippingAddress?: {
    street?: string
    city?: string
    country?: string
    zip?: string
  }
  createdAt: string
  customer?: {
    id: string
    name: string
    email: string
    phone?: string
  }
  items?: OrderItem[]
}

export type OrderStatus =
  | 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'PROCESSING'
  | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'

export interface DashboardStats {
  revenue: number
  orders: number
  customers: number
  products: number
  revenueGrowth?: number
  ordersGrowth?: number
  customersGrowth?: number
  avgOrderValue?: number
  conversionRate?: number
  cancelledOrders?: number
  topProducts?: { id?: string; name: string; totalSold: number; revenue: number }[]
  recentOrders?: Order[]
  revenueByDay?: { date: string; revenue: number }[]
}

export interface InventoryAlert {
  id: string
  productId: string
  name: string
  nameAr: string
  stock: number
  sku?: string
  image?: string
}

export interface POSCartItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  total: number
  discountPercent?: number
}

export interface POSSession {
  storeId: string
  items: POSCartItem[]
  subtotal: number
  discountAmount: number
  vatAmount: number
  total: number
  paymentMethod?: 'CASH' | 'CARD' | 'BENEFIT_PAY'
  cashReceived?: number
  change?: number
  customerId?: string
}

export interface NotificationItem {
  id: string
  type: 'NEW_ORDER' | 'LOW_STOCK' | 'ORDER_CANCELLED' | 'PAYMENT' | 'REVIEW' | 'SYSTEM'
  title: string
  body: string
  isRead: boolean
  createdAt: string
  data?: Record<string, any>
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
  total?: number
  page?: number
  limit?: number
}

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  storeId: string
}
