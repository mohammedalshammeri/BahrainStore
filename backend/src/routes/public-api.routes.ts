import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

/**
 * Public API — exposes store data via API key authentication.
 * Header required: x-api-key: <store-api-key>
 * Base prefix: /api/public/v1
 */

const PUBLIC_API_CONTRACT = {
  platform: 'Bazar',
  version: 'v1',
  auth: {
    type: 'apiKey' as const,
    header: 'x-api-key',
    docs: '/docs',
  },
  resources: {
    info: 'GET /',
    contract: 'GET /contract',
    store: 'GET /store',
    products: 'GET /products',
    product: 'GET /products/:slug',
    categories: 'GET /categories',
    orders: 'GET /orders',
    order: 'GET /orders/:orderNumber',
    createOrder: 'POST /orders',
    customers: 'GET /customers',
    customer: 'GET /customers/:phone',
    upsertCustomer: 'POST /customers',
    coupons: 'POST /coupons/validate',
    inventory: 'GET /inventory/stock',
    changelog: 'GET /changelog',
  },
  webhookSupport: {
    docs: '/api/v1/webhooks/contract',
    signatureHeader: 'X-Bazar-Signature',
    deliveryHeader: 'X-Bazar-Delivery',
  },
  sdks: ['javascript', 'python', 'php'],
} as const

async function resolveApiKey(request: any, reply: any): Promise<string | null> {
  const apiKey = request.headers['x-api-key'] as string | undefined
  if (!apiKey) {
    reply.status(401).send({ error: 'x-api-key header مطلوب', docs: '/docs' })
    return null
  }
  const store = await prisma.store.findFirst({
    where: { apiKey, isActive: true },
    select: { id: true, apiKeyEnabled: true },
  })
  if (!store) {
    reply.status(401).send({ error: 'مفتاح API غير صحيح أو المتجر غير نشط' })
    return null
  }
  if (!store.apiKeyEnabled) {
    reply.status(403).send({ error: 'مفتاح API معطّل، يُرجى التواصل مع الدعم' })
    return null
  }
  // cache storeId on the request for usage logging hook
  request._storeId = store.id
  return store.id
}

export async function publicApiRoutes(app: FastifyInstance) {
  // ── Usage logging hooks ─────────────────────
  app.addHook('onRequest', async (request) => {
    (request as any)._apiStartMs = Date.now()
  })

  app.addHook('onSend', async (request: any, reply) => {
    if (!request._storeId) return
    const duration = Date.now() - (request._apiStartMs ?? Date.now())
    const url = new URL(request.url, 'http://localhost')
    const endpoint = url.pathname.replace(/^\/api\/public\/v1/, '') || '/'
    prisma.apiUsageLog.create({
      data: {
        storeId: request._storeId,
        endpoint,
        method: request.method,
        statusCode: reply.statusCode,
        duration,
        ip: (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? request.ip ?? null,
        userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
        version: 'v1',
      },
    }).catch(() => { /* fire-and-forget */ })
  })
  // ── Info ────────────────────────────────────
  app.get('/', {
    schema: {
      tags: ['Info'],
      summary: 'API info',
      description: 'Get platform and API version info',
    },
  }, async (_req, reply) => {
    return reply.send({
      ...PUBLIC_API_CONTRACT,
    })
  })

  app.get('/contract', {
    schema: {
      tags: ['Info'],
      summary: 'API contract',
      description: 'Return the explicit contract for supported public API resources',
    },
  }, async (_req, reply) => {
    const latestChangelog = await prisma.apiChangelog.findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { version: true, title: true, publishedAt: true },
    })

    return reply.send({
      ...PUBLIC_API_CONTRACT,
      latestChangelog,
    })
  })

  // ── Get store info ───────────────────────────
  app.get('/store', {
    schema: {
      tags: ['Store'],
      summary: 'Get store information',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string', description: 'Your store API key' } }, required: ['x-api-key'] },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        name: true,
        nameAr: true,
        subdomain: true,
        currency: true,
        phone: true,
        email: true,
        plan: true,
      },
    })
    return reply.send({ store })
  })

  // ── List products ────────────────────────────
  app.get('/products', {
    schema: {
      tags: ['Products'],
      summary: 'List store products',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
          categoryId: { type: 'string' },
          search: { type: 'string' },
          inStock: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { page = 1, limit = 20, categoryId, search, inStock } = request.query as Record<string, any>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { storeId, status: 'ACTIVE' }
    if (categoryId) where.categoryId = categoryId
    if (inStock === true || inStock === 'true') where.stock = { gt: 0 }
    if (search) where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { nameAr: { contains: String(search), mode: 'insensitive' } },
    ]

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
          price: true,
          compareAtPrice: true,
          stock: true,
          sku: true,
          images: { select: { url: true }, take: 1 },
          category: { select: { name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Math.min(Number(limit), 100),
      }),
      prisma.product.count({ where }),
    ])

    return reply.send({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // ── Get single product ───────────────────────
  app.get('/products/:slug', {
    schema: {
      tags: ['Products'],
      summary: 'Get product by slug',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      params: { type: 'object', properties: { slug: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { slug } = request.params as { slug: string }
    const product = await prisma.product.findFirst({
      where: { storeId, slug },
      include: {
        images: true,
        category: { select: { name: true, nameAr: true, slug: true } },
        variants: { include: { optionValues: { include: { optionValue: { include: { option: true } } } } } },
      },
    })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })
    return reply.send({ product })
  })

  // ── List categories ──────────────────────────
  app.get('/categories', {
    schema: {
      tags: ['Categories'],
      summary: 'List store categories',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const categories = await prisma.category.findMany({
      where: { storeId, isActive: true },
      select: { id: true, name: true, nameAr: true, slug: true, image: true, _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    })
    return reply.send({ categories })
  })

  app.get('/orders', {
    schema: {
      tags: ['Orders'],
      summary: 'List store orders',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
          status: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { page = 1, limit = 20, status } = request.query as Record<string, any>
    const take = Math.min(Number(limit) || 20, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where: Record<string, unknown> = { storeId }
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          total: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ])

    return reply.send({ orders, total, page: Math.max(Number(page) || 1, 1), pages: Math.ceil(total / take) })
  })

  // ── Create order ─────────────────────────────
  app.post('/orders', {
    schema: {
      tags: ['Orders'],
      summary: 'Create a new order',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      body: {
        type: 'object',
        required: ['customer', 'items'],
        properties: {
          customer: {
            type: 'object',
            required: ['firstName', 'phone'],
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' },
            },
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string' },
                variantId: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
          paymentMethod: { type: 'string', default: 'CASH_ON_DELIVERY' },
          notes: { type: 'string' },
          shippingCost: { type: 'number', default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { customer, items, paymentMethod = 'CASH_ON_DELIVERY', notes, shippingCost = 0 } = request.body as any

    // Upsert customer
    const cust = await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone: customer.phone } },
      create: { storeId, firstName: customer.firstName, lastName: customer.lastName ?? '', phone: customer.phone, email: customer.email ?? `${customer.phone}@nomail.local` },
      update: { firstName: customer.firstName, lastName: customer.lastName ?? '' },
    })

    // Build order items
    let subtotal = 0
    const orderItems = []
    for (const item of items) {
      const product = await prisma.product.findFirst({ where: { id: item.productId, storeId } })
      if (!product) return reply.status(400).send({ error: `المنتج ${item.productId} غير موجود` })
      const price = Number(product.price)
      subtotal += price * item.quantity
      orderItems.push({ productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity, price, total: price * item.quantity, name: product.name, nameAr: product.nameAr ?? product.name })
    }

    const total = subtotal + Number(shippingCost)
    const orderNumber = `ORD-${Date.now()}`

    const order = await prisma.order.create({
      data: {
        storeId,
        customerId: cust.id,
        orderNumber,
        subtotal,
        shippingCost: Number(shippingCost),
        total,
        paymentMethod: paymentMethod as any,
        notes,
        items: {
          create: orderItems.map(i => ({
            name: i.name,
            nameAr: i.nameAr,
            quantity: i.quantity,
            price: i.price,
            total: i.total,
            variantId: i.variantId ?? undefined,
            product: { connect: { id: i.productId } },
          })),
        },
      },
    })

    return reply.status(201).send({ order: { id: order.id, orderNumber: order.orderNumber, total: order.total, status: order.status } })
  })

  // ── Get order by number ──────────────────────
  app.get('/orders/:orderNumber', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order by order number',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      params: { type: 'object', properties: { orderNumber: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { orderNumber } = request.params as { orderNumber: string }
    const order = await prisma.order.findFirst({
      where: { storeId, orderNumber },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        items: { select: { name: true, nameAr: true, quantity: true, unitPrice: true, totalPrice: true } },
      },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })
    return reply.send({ order })
  })

  // ── Upsert customer ──────────────────────────
  app.post('/customers', {
    schema: {
      tags: ['Customers'],
      summary: 'Create or update a customer',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      body: {
        type: 'object',
        required: ['firstName', 'phone'],
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { firstName, lastName = '', phone, email } = request.body as any
    const customer = await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone } },
      create: { storeId, firstName, lastName, phone, email: email ?? `${phone}@nomail.local` },
      update: { firstName, lastName, email: email ?? undefined },
    })
    return reply.send({ customer: { id: customer.id, phone: customer.phone, firstName: customer.firstName } })
  })

  app.get('/customers', {
    schema: {
      tags: ['Customers'],
      summary: 'List customers',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
          search: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { page = 1, limit = 20, search } = request.query as Record<string, any>
    const take = Math.min(Number(limit) || 20, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where: any = { storeId }
    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          loyaltyPoints: true,
          totalOrders: true,
          totalSpent: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ])

    return reply.send({ customers, total, page: Math.max(Number(page) || 1, 1), pages: Math.ceil(total / take) })
  })

  // ── Get customer by phone ────────────────────
  app.get('/customers/:phone', {
    schema: {
      tags: ['Customers'],
      summary: 'Get customer by phone number',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      params: { type: 'object', properties: { phone: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { phone } = request.params as { phone: string }
    const customer = await prisma.customer.findFirst({
      where: { storeId, phone },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        loyaltyPoints: true,
        totalOrders: true,
        createdAt: true,
      },
    })
    if (!customer) return reply.status(404).send({ error: 'العميل غير موجود' })
    return reply.send({ customer })
  })

  app.post('/coupons/validate', {
    schema: {
      tags: ['Coupons'],
      summary: 'Validate a coupon code',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      body: {
        type: 'object',
        required: ['code', 'orderValue'],
        properties: {
          code: { type: 'string' },
          orderValue: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { code, orderValue } = request.body as { code: string; orderValue: number }

    const coupon = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
    })

    if (!coupon || !coupon.isActive) return reply.status(400).send({ valid: false, error: 'كود الخصم غير صحيح' })
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return reply.status(400).send({ valid: false, error: 'كود الخصم منتهي الصلاحية' })
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return reply.status(400).send({ valid: false, error: 'كود الخصم نفد' })
    if (coupon.minOrderValue && orderValue < Number(coupon.minOrderValue)) {
      return reply.status(400).send({ valid: false, error: `الحد الأدنى ${coupon.minOrderValue} BHD` })
    }

    const discountAmount = coupon.type === 'PERCENTAGE'
      ? (orderValue * Number(coupon.value)) / 100
      : Number(coupon.value)

    return reply.send({ valid: true, coupon, discountAmount })
  })

  app.get('/inventory/stock', {
    schema: {
      tags: ['Inventory'],
      summary: 'Get product stock snapshot',
      headers: { type: 'object', properties: { 'x-api-key': { type: 'string' } }, required: ['x-api-key'] },
      querystring: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const storeId = await resolveApiKey(request, reply)
    if (!storeId) return

    const { productId, variantId } = request.query as { productId: string; variantId?: string }
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
      include: {
        variants: {
          select: {
            id: true,
            sku: true,
            stock: true,
            price: true,
          },
        },
      },
    })

    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    if (variantId) {
      const variant = product.variants.find((item) => item.id === variantId)
      if (!variant) return reply.status(404).send({ error: 'النسخة غير موجودة' })

      return reply.send({
        inventory: {
          productId: product.id,
          variantId: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          trackInventory: product.trackInventory,
        },
      })
    }

    return reply.send({
      inventory: {
        productId: product.id,
        sku: product.sku,
        stock: product.stock,
        trackInventory: product.trackInventory,
        variants: product.variants,
      },
    })
  })

  // ── Public changelog (no auth required) ──────
  app.get('/changelog', {
    schema: {
      tags: ['Info'],
      summary: 'API changelog',
      description: 'List published API changelog entries',
    },
  }, async (_req, reply) => {
    const entries = await prisma.apiChangelog.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, version: true, title: true, description: true, type: true, publishedAt: true },
    })
    return reply.send({ entries })
  })
}
