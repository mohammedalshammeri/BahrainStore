// ─── Auth ──────────────────────────────────────────────
export interface Merchant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

// ─── Store ─────────────────────────────────────────────
export interface Store {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  subdomain: string;
  customDomain: string | null;
  logo: string | null;
  description: string | null;
  currency: string;
  language: string;
  plan: "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
  isActive: boolean;
  createdAt: string;
  settings?: StoreSettings;
}

export interface StoreSettings {
  vatEnabled: boolean;
  vatNumber: string | null;
  vatRate: number;
  freeShippingThreshold: number | null;
  defaultShippingCost: number;
  allowCod: boolean;
}

export interface StoreStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  recentOrders: Order[];
  revenueGrowth: number;
  ordersGrowth: number;
}

// ─── Product ────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  nameAr: string | null;
  image: string | null;
  parentId: string | null;
  children?: Category[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  stock: number;
  options: Record<string, string>;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  comparePrice: number | null;
  cost: number | null;
  sku: string | null;
  stock: number;
  trackStock: boolean;
  isActive: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  category: Category | null;
  createdAt: string;
}

export interface ProductPayload {
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  comparePrice?: number;
  cost?: number;
  sku?: string;
  stock?: number;
  trackStock?: boolean;
  categoryId?: string;
  isActive?: boolean;
}

// ─── Customer ───────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

// ─── Order ──────────────────────────────────────────────
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentMethod = "BENEFIT_PAY" | "CREDIMAX" | "CASH_ON_DELIVERY" | "BANK_TRANSFER";

export interface OrderItem {
  id: string;
  productName: string;
  productNameAr: string | null;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  subtotal: number;
  shippingCost: number;
  discount: number;
  vatAmount: number;
  total: number;
  customer: Customer;
  items: OrderItem[];
  shippingAddress: Address | null;
  notes: string | null;
  createdAt: string;
}

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  governorate: string | null;
  country: string;
}

// ─── Coupon ─────────────────────────────────────────────
export interface Coupon {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

// ─── Pagination ─────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}
