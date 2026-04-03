/**
 * Bazar JavaScript/TypeScript SDK
 * Official client for the Bazar e-commerce platform API
 */

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

export interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  ordersCount: number
  totalSpent: number
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

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
      baseUrl: 'https://api.bazar.bh',
      ...config,
    }

    this.products = new ProductsResource(this)
    this.orders = new OrdersResource(this)
    this.customers = new CustomersResource(this)
    this.categories = new CategoriesResource(this)
    this.coupons = new CouponsResource(this)
    this.inventory = new InventoryResource(this)
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
  async list(options: ListOptions = {}) {
    return this.client.request('GET', `/products`, undefined, {
      storeId: this.storeId,
      ...options,
    })
  }

  async get(id: string): Promise<Product> {
    return this.client.request('GET', `/products/${id}`)
  }

  async getBySlug(slug: string): Promise<Product> {
    return this.client.request('GET', `/products/slug/${slug}`, undefined, {
      storeId: this.storeId,
    })
  }
}

class OrdersResource extends BaseResource {
  async list(options: ListOptions = {}) {
    return this.client.request('GET', `/orders`, undefined, {
      storeId: this.storeId,
      ...options,
    })
  }

  async get(id: string): Promise<Order> {
    return this.client.request('GET', `/orders/${id}`)
  }

  async create(data: any): Promise<Order> {
    return this.client.request('POST', '/orders', { storeId: this.storeId, ...data })
  }

  async updateStatus(id: string, status: string): Promise<Order> {
    return this.client.request('PATCH', `/orders/${id}/status`, { status })
  }
}

class CustomersResource extends BaseResource {
  async list(options: ListOptions = {}) {
    return this.client.request('GET', `/customers`, undefined, {
      storeId: this.storeId,
      ...options,
    })
  }

  async get(id: string): Promise<Customer> {
    return this.client.request('GET', `/customers/${id}`)
  }
}

class CategoriesResource extends BaseResource {
  async list() {
    return this.client.request('GET', `/categories`, undefined, { storeId: this.storeId })
  }
}

class CouponsResource extends BaseResource {
  async validate(code: string, orderValue: number) {
    return this.client.request('POST', '/coupons/validate', {
      storeId: this.storeId,
      code,
      orderValue,
    })
  }
}

class InventoryResource extends BaseResource {
  async getStock(productId: string) {
    return this.client.request('GET', `/inventory/stock`, undefined, {
      storeId: this.storeId,
      productId,
    })
  }
}

// CommonJS export for Node.js compatibility
export default BazarClient
