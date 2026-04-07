/**
 * Bazar JavaScript/TypeScript SDK
 * Official client for the Bazar e-commerce platform API
 */

import crypto from 'node:crypto'

export interface BazarConfig {
  apiKey: string
  storeId: string
  baseUrl?: string
}

export interface ListOptions {
  page?: number
  limit?: number
  search?: string
  [key: string]: any
}

export interface Product {
  id: string
  name: string
  nameAr?: string
  slug: string
  price: number
  comparePrice?: number
  stock: number
  images: string[]
  active: boolean
  createdAt: string
}

export interface ProductListResponse {
  products: Product[]
  total: number
  page: number
  pages: number
}

export interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
}

export interface OrderListResponse {
  orders: Order[]
  total: number
  page: number
  pages: number
}

export interface Customer {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints?: number
  createdAt?: string
}

export interface CustomerListResponse {
  customers: Customer[]
  total: number
  page: number
  pages: number
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
  const normalizedSignature = signature.replace(/^sha256=/, '')
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(normalizedSignature), Buffer.from(expectedSignature))
}

export class BazarClient {
  private config: Required<BazarConfig>

  products: ProductsResource
  orders: OrdersResource
  customers: CustomersResource
  categories: CategoriesResource
  coupons: CouponsResource
  inventory: InventoryResource

  constructor(config: BazarConfig) {
    this.config = {
      baseUrl: config.baseUrl?.replace(/\/$/, '') ?? 'https://api.bazar.bh',
      ...config,
    }

    this.products = new ProductsResource(this)
    this.orders = new OrdersResource(this)
    this.customers = new CustomersResource(this)
    this.categories = new CategoriesResource(this)
    this.coupons = new CouponsResource(this)
    this.inventory = new InventoryResource(this)
  }

  async info() {
    return this.request('GET', '/')
  }

  async contract() {
    return this.request('GET', '/contract')
  }

  async changelog() {
    return this.request('GET', '/changelog')
  }

  async request<T = any>(method: HttpMethod, path: string, body?: any, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api/public/v1${path}`)

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new BazarError(error.error || 'API Error', response.status, error)
    }

    return response.json() as Promise<T>
  }
}

export class BazarError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data?: any) {
    super(message)
    this.name = 'BazarError'
    this.status = status
    this.data = data
  }
}

class BaseResource {
  protected client: BazarClient
  protected storeId: string

  constructor(client: BazarClient) {
    this.client = client
    this.storeId = (client as any).config.storeId
  }
}

class ProductsResource extends BaseResource {
  async list(options: ListOptions = {}): Promise<ProductListResponse> {
    return this.client.request('GET', '/products', undefined, options)
  }

  async get(slug: string) {
    return this.getBySlug(slug)
  }

  async getBySlug(slug: string) {
    return this.client.request('GET', `/products/${slug}`)
  }
}

class OrdersResource extends BaseResource {
  async list(options: ListOptions = {}): Promise<OrderListResponse> {
    return this.client.request('GET', '/orders', undefined, options)
  }

  async get(orderNumber: string) {
    return this.client.request('GET', `/orders/${orderNumber}`)
  }

  async getByOrderNumber(orderNumber: string) {
    return this.get(orderNumber)
  }

  async create(data: any) {
    return this.client.request('POST', '/orders', data)
  }
}

class CustomersResource extends BaseResource {
  async list(options: ListOptions = {}): Promise<CustomerListResponse> {
    return this.client.request('GET', '/customers', undefined, options)
  }

  async get(phone: string) {
    return this.client.request('GET', `/customers/${phone}`)
  }

  async getByPhone(phone: string) {
    return this.get(phone)
  }

  async upsert(data: { firstName: string; lastName?: string; phone: string; email?: string }) {
    return this.client.request('POST', '/customers', data)
  }
}

class CategoriesResource extends BaseResource {
  async list() {
    return this.client.request('GET', '/categories')
  }
}

class CouponsResource extends BaseResource {
  async validate(code: string, orderValue: number) {
    return this.client.request('POST', '/coupons/validate', {
      code,
      orderValue,
    })
  }
}

class InventoryResource extends BaseResource {
  async getStock(productId: string, variantId?: string) {
    return this.client.request('GET', '/inventory/stock', undefined, {
      productId,
      variantId,
    })
  }
}

// CommonJS export for Node.js compatibility
export default BazarClient
