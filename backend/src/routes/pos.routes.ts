import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { findMerchantPosSession } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

// ─── POS (نقطة البيع) Routes ───────────────────────────────────────────────────

export async function posRoutes(app: FastifyInstance) {
  async function ensureMerchantStore(storeId: string, merchantId: string) {
    return prisma.store.findFirst({ where: { id: storeId, merchantId } })
  }

  async function ensureOpenSession(storeId: string, merchantId: string) {
    const existing = await prisma.posSession.findFirst({
      where: { storeId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    })

    if (existing) {
      return existing
    }

    return prisma.posSession.create({
      data: { storeId, staffId: merchantId, openingCash: 0, status: 'OPEN' },
    })
  }

  // POST /pos/sessions — Open POS session
  app.post('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      openingCash: z.number().min(0).default(0),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    }

    const merchantId = (request.user as any).id
    const { storeId, openingCash } = result.data

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Check no open session
    const openSession = await prisma.posSession.findFirst({
      where: { storeId, status: 'OPEN' },
    })
    if (openSession) {
      return reply.status(400).send({ error: 'يوجد جلسة مفتوحة بالفعل', session: openSession })
    }

    const session = await prisma.posSession.create({
      data: { storeId, staffId: merchantId, openingCash, status: 'OPEN' },
    })

    return reply.status(201).send({ message: 'تم فتح جلسة POS', session })
  })

  // GET /pos/sessions?storeId=
  app.get('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, status } = request.query as { storeId: string; status?: string }
    const merchantId = (request.user as any).id

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const where: any = { storeId }
    if (status) where.status = status

    const sessions = await prisma.posSession.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { openedAt: 'desc' },
      take: 20,
    })

    return reply.send({ sessions })
  })

  // GET /pos/sessions/:id — Session details
  app.get('/sessions/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const merchantId = (request.user as any).id

    const session = await prisma.posSession.findFirst({
      where: { id, store: { merchantId } },
      include: { orders: true },
    })
    if (!session) return reply.status(404).send({ error: 'الجلسة غير موجودة' })

    return reply.send({ session })
  })

  // POST /pos/sessions/:id/close — Close POS session
  app.post('/sessions/:id/close', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { closingCash } = request.body as { closingCash?: number }

    const merchantId = (request.user as any).id

    const session = await findMerchantPosSession(merchantId, id)
    if (!session || session.status === 'CLOSED') {
      return reply.status(400).send({ error: 'الجلسة غير موجودة أو مغلقة' })
    }

    const totalSales = await prisma.posOrder.aggregate({
      where: { sessionId: id },
      _sum: { total: true },
    })

    await prisma.posSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingCash: closingCash || 0,
        totalSales: totalSales._sum.total || 0,
      },
    })

    return reply.send({ message: 'تم إغلاق الجلسة', totalSales: totalSales._sum.total || 0 })
  })

  // POST /pos/orders — Create POS order (sale)
  app.post('/orders', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      sessionId: z.string().cuid(),
      storeId: z.string().cuid(),
      items: z.array(z.object({
        productId: z.string().cuid(),
        variantId: z.string().optional(),
        name: z.string(),
        price: z.number().positive(),
        qty: z.number().int().positive(),
      })).min(1),
      discount: z.number().min(0).default(0),
      payMethod: z.enum(['CASH', 'CARD', 'BENEFIT_PAY']).default('CASH'),
      paidAmount: z.number().positive(),
      customerId: z.string().optional(),
      customerName: z.string().optional(),
      vatRate: z.number().min(0).max(1).default(0.1),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const data = result.data
    const merchantId = (request.user as any).id

    const store = await ensureMerchantStore(data.storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const session = await prisma.posSession.findFirst({
      where: { id: data.sessionId, storeId: data.storeId, status: 'OPEN', store: { merchantId } },
    })
    if (!session) return reply.status(400).send({ error: 'الجلسة غير مفتوحة' })

    const subtotal = data.items.reduce((s, i) => s + i.price * i.qty, 0)
    const afterDiscount = subtotal - data.discount
    const vatAmount = afterDiscount * data.vatRate
    const total = afterDiscount + vatAmount
    const change = data.paidAmount - total

    const orderNumber = `POS-${Date.now()}`

    // LOGIC-006: Wrap order creation + stock deduction in a single transaction with stock guard
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.posOrder.create({
        data: {
          sessionId: data.sessionId,
          storeId: data.storeId,
          orderNumber,
          items: data.items as any,
          subtotal,
          discount: data.discount,
          vatAmount,
          total,
          payMethod: data.payMethod,
          paidAmount: data.paidAmount,
          change: Math.max(0, change),
          customerId: data.customerId,
          customerName: data.customerName,
        },
      })

      // Deduct stock — abort entire transaction if any item is out of stock
      for (const item of data.items) {
        if (item.variantId) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          })
          if (updated.count !== 1) throw new Error(`STOCK_CONFLICT:${item.name ?? item.variantId}`)
        } else {
          const updated = await tx.product.updateMany({
            where: { id: item.productId, storeId: data.storeId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          })
          if (updated.count !== 1) throw new Error(`STOCK_CONFLICT:${item.name ?? item.productId}`)
        }
      }

      return newOrder
    })

    return reply.status(201).send({ message: 'تم تسجيل عملية البيع', order, change: Math.max(0, change) })
  })

  // GET /pos/orders?sessionId=
  app.get('/orders', { preHandler: authenticate }, async (request, reply) => {
    const { sessionId, storeId } = request.query as { sessionId?: string; storeId?: string }
    const merchantId = (request.user as any).id

    if (!sessionId && !storeId) {
      return reply.status(400).send({ error: 'sessionId أو storeId مطلوب' })
    }

    const where: any = {}
    if (storeId) {
      const store = await ensureMerchantStore(storeId, merchantId)
      if (!store) return reply.status(403).send({ error: 'غير مصرح' })
      where.storeId = storeId
    }

    if (sessionId) {
      const session = await findMerchantPosSession(merchantId, sessionId)
      if (!session) return reply.status(403).send({ error: 'غير مصرح' })
      where.sessionId = sessionId
      if (!storeId) {
        where.storeId = session.storeId
      }
    }

    const orders = await prisma.posOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return reply.send({ orders })
  })

  // GET /pos/products/:storeId — Products for POS (quick search)
  app.get('/products/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { q = '' } = request.query as { q?: string }
    const merchantId = (request.user as any).id

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const products = await prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
        stock: { gt: 0 },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q } },
        ],
      },
      include: {
        images: { take: 1 },
        variants: { where: { isActive: true, stock: { gt: 0 } } },
      },
      take: 20,
    })

    return reply.send({ products })
  })

  // GET /pos/summary/:storeId — POS dashboard summary
  app.get('/summary/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todaySales, totalSessions, openSession] = await Promise.all([
      prisma.posOrder.aggregate({
        where: { storeId, createdAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.posSession.count({ where: { storeId } }),
      prisma.posSession.findFirst({ where: { storeId, status: 'OPEN' } }),
    ])

    return reply.send({
      todayRevenue: todaySales._sum.total || 0,
      todayOrders: todaySales._count,
      totalSessions,
      hasOpenSession: !!openSession,
      openSession,
    })
  })

  // Mobile compatibility endpoints
  app.get('/products/search', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, q = '' } = request.query as { storeId?: string; q?: string }
    const merchantId = (request.user as any).id

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const products = await prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
        stock: { gt: 0 },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q } },
        ],
      },
      include: {
        images: { take: 1 },
        variants: { where: { isActive: true, stock: { gt: 0 } } },
      },
      take: 20,
    })

    return reply.send({ products })
  })

  app.get('/products/barcode/:barcode', { preHandler: authenticate }, async (request, reply) => {
    const { barcode } = request.params as { barcode: string }
    const { storeId } = request.query as { storeId?: string }
    const merchantId = (request.user as any).id

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const product = await prisma.product.findFirst({
      where: { storeId, barcode, isActive: true },
      include: {
        images: { take: 1 },
        variants: { where: { isActive: true, stock: { gt: 0 } } },
      },
    })

    return reply.send({ product: product ?? null })
  })

  app.get('/summary', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string; date?: string }
    const merchantId = (request.user as any).id

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await ensureMerchantStore(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todaySales, totalSessions, openSession] = await Promise.all([
      prisma.posOrder.aggregate({
        where: { storeId, createdAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.posSession.count({ where: { storeId } }),
      prisma.posSession.findFirst({ where: { storeId, status: 'OPEN' } }),
    ])

    return reply.send({
      todayRevenue: todaySales._sum.total || 0,
      todayOrders: todaySales._count,
      totalSessions,
      hasOpenSession: !!openSession,
      openSession,
    })
  })

  app.post('/checkout', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      items: z.array(z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().optional(),
        quantity: z.number().int().positive(),
        price: z.number().positive().optional(),
      })).min(1),
      paymentMethod: z.enum(['CASH', 'CARD', 'BENEFIT_PAY']).default('CASH'),
      customerId: z.string().optional(),
      discountAmount: z.number().min(0).default(0),
      cashReceived: z.number().min(0).optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const payload = result.data

    const store = await ensureMerchantStore(payload.storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const session = await ensureOpenSession(payload.storeId, merchantId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: payload.items.map((item) => item.productId) },
        storeId: payload.storeId,
      },
      include: { variants: true },
    })
    const productMap = new Map(products.map((product) => [product.id, product]))

    const items = [] as Array<{ productId: string; variantId?: string; name: string; price: number; qty: number }>
    for (const item of payload.items) {
      const product = productMap.get(item.productId)
      if (!product) {
        return reply.status(400).send({ error: 'المنتج غير موجود في هذا المتجر' })
      }

      let price = Number(product.price)
      if (item.variantId) {
        const variant = product.variants.find((entry) => entry.id === item.variantId)
        if (!variant) {
          return reply.status(400).send({ error: 'المتغير غير موجود' })
        }
        price = Number(variant.price ?? product.price)
      }

      items.push({
        productId: item.productId,
        variantId: item.variantId,
        name: product.nameAr || product.name,
        price,
        qty: item.quantity,
      })
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0)
    const afterDiscount = Math.max(0, subtotal - payload.discountAmount)
    const vatAmount = afterDiscount * 0.1
    const total = afterDiscount + vatAmount
    const paidAmount = payload.paymentMethod === 'CASH'
      ? Math.max(payload.cashReceived ?? 0, total)
      : total
    const change = Math.max(0, paidAmount - total)

    // LOGIC-006: Wrap order creation + stock deduction in a single transaction with stock guard
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.posOrder.create({
        data: {
          sessionId: session.id,
          storeId: payload.storeId,
          orderNumber: `POS-${Date.now()}`,
          items: items as any,
          subtotal,
          discount: payload.discountAmount,
          vatAmount,
          total,
          payMethod: payload.paymentMethod,
          paidAmount,
          change,
          customerId: payload.customerId,
        },
      })

      for (const item of items) {
        if (item.variantId) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          })
          if (updated.count !== 1) throw new Error(`STOCK_CONFLICT:${item.name ?? item.variantId}`)
        } else {
          const updated = await tx.product.updateMany({
            where: { id: item.productId, storeId: payload.storeId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          })
          if (updated.count !== 1) throw new Error(`STOCK_CONFLICT:${item.name ?? item.productId}`)
        }
      }

      return newOrder
    })

    return reply.status(201).send({ message: 'تم تسجيل عملية البيع', order, change, session })
  })
}
