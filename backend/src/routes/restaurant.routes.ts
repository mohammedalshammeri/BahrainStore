import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'node:crypto'

// ─── Restaurant Mode ──────────────────────────────────────────────────────────
// QR code table ordering, kitchen display, table management
// Each table gets a unique QR code → customer scans → browses menu → orders from phone

// ─── Generate QR code URL ─────────────────────────────────────────────────────
function generateQRData(storeSlug: string, tableId: string): string {
  // Returns the URL that the QR code should encode
  return `https://${storeSlug}.bazar.bh/menu?table=${tableId}`
}

export async function restaurantRoutes(app: FastifyInstance) {
  // ─── GET /restaurant/tables ───────────────────────────────────────────────
  app.get('/tables', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const tables = await prisma.restaurantTable.findMany({
      where: { storeId },
      include: {
        orders: {
          where: { status: { notIn: ['PAID', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true, orderId: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const tablesWithStatus = tables.map((table) => ({
      ...table,
      currentStatus: table.orders[0]?.status || 'EMPTY',
      hasActiveOrder: table.orders.length > 0,
      activeOrderId: table.orders[0]?.id,
    }))

    return reply.send({ tables: tablesWithStatus })
  })

  // ─── POST /restaurant/tables ──────────────────────────────────────────────
  app.post('/tables', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      name: z.string().min(1).max(50),
      capacity: z.number().int().min(1).max(100).default(4),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    const store = await prisma.store.findUnique({ where: { id: parsed.data.storeId }, select: { slug: true, subdomain: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const tableId = crypto.randomBytes(8).toString('hex')
    const storeSlug = store.subdomain || store.slug || parsed.data.storeId
    const qrCode = generateQRData(storeSlug, tableId)

    const table = await prisma.restaurantTable.create({
      data: {
        id: tableId,
        storeId: parsed.data.storeId,
        name: parsed.data.name,
        capacity: parsed.data.capacity,
        qrCode,
      },
    })

    return reply.status(201).send({ success: true, table })
  })

  // ─── PATCH /restaurant/tables/:id ────────────────────────────────────────
  app.patch('/tables/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any
    const schema = z.object({
      name: z.string().min(1).max(50).optional(),
      capacity: z.number().int().min(1).max(100).optional(),
      isActive: z.boolean().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const table = await prisma.restaurantTable.update({ where: { id }, data: parsed.data })
    return reply.send({ success: true, table })
  })

  // ─── DELETE /restaurant/tables/:id ───────────────────────────────────────
  app.delete('/tables/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any
    await prisma.restaurantTable.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─── POST /restaurant/orders ──────────────────────────────────────────────
  // Customer creates an order for a table (from QR scan)
  app.post('/orders', async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      tableId: z.string(),
      guestCount: z.number().int().min(1).default(1),
      items: z.array(z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1),
        notes: z.string().optional(),
      })).min(1),
      notes: z.string().optional(),
      customerName: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })
    const { storeId, tableId, guestCount, items, notes, customerName } = parsed.data

    const [store, table] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId }, select: { name: true, currency: true } }),
      prisma.restaurantTable.findFirst({ where: { id: tableId, storeId, isActive: true } }),
    ])

    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })
    if (!table) return reply.status(404).send({ error: 'الطاولة غير موجودة' })

    // Load products and calculate totals
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId, isActive: true },
      select: { id: true, name: true, nameAr: true, price: true, stock: true },
    })

    const productMap = new Map(products.map((p) => [p.id, p]))
    let subtotal = 0
    const orderItemsData: Array<{ productId: string; name: string; nameAr: string; quantity: number; price: number; total: number }> = []

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) return reply.status(400).send({ error: `المنتج ${item.productId} غير موجود` })
      if (product.stock < item.quantity) return reply.status(400).send({ error: `مخزون غير كافي للمنتج: ${product.nameAr || product.name}` })

      const price = Number(product.price)
      const total = price * item.quantity
      subtotal += total
      orderItemsData.push({ productId: item.productId, name: product.name, nameAr: product.nameAr, quantity: item.quantity, price, total })
    }

    const vatAmount = subtotal * 0.10
    const totalAmount = subtotal + vatAmount

    // Create order + restaurant order in transaction
    const result = await prisma.$transaction(async (tx) => {
      const orderCount = await tx.order.count({ where: { storeId } })
      const counter = orderCount + 1

      // Upsert a restaurant guest customer for the store
      const guestCustomer = await tx.customer.upsert({
        where: { storeId_phone: { storeId, phone: 'restaurant-guest' } },
        create: { storeId, phone: 'restaurant-guest', firstName: 'طاولة', lastName: 'مطعم', isGuest: true },
        update: {},
      })

      const order = await tx.order.create({
        data: {
          storeId,
          customerId: guestCustomer.id,
          orderNumber: `R-${counter.toString().padStart(4, '0')}`,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'CASH_ON_DELIVERY',
          subtotal,
          vatAmount,
          total: totalAmount,
          notes: `[طاولة: ${table.name}] ${notes || ''}`.trim(),
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              name: item.name,
              nameAr: item.nameAr,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })),
          },
        },
      })

      const restaurantOrder = await tx.restaurantOrder.create({
        data: { storeId, tableId, orderId: order.id, guestCount, notes: customerName ? `العميل: ${customerName}` : notes, status: 'PENDING' },
      })

      return { order, restaurantOrder }
    })

    return reply.status(201).send({ success: true, ...result })
  })

  // ─── GET /restaurant/orders ───────────────────────────────────────────────
  // Kitchen display: all active orders
  app.get('/orders', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, status } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const where: any = { storeId }
    if (status) where.status = status
    else where.status = { notIn: ['PAID', 'CANCELLED'] }

    const orders = await prisma.restaurantOrder.findMany({
      where,
      include: {
        table: { select: { name: true, capacity: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Enrich with order items
    const orderIds = orders.map((o) => o.orderId).filter(Boolean) as string[]
    const orderItems = orderIds.length > 0
      ? await prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          include: { product: { select: { name: true, nameAr: true } } },
        })
      : []

    const itemsByOrderId = new Map<string, typeof orderItems>()
    for (const item of orderItems) {
      if (!itemsByOrderId.has(item.orderId)) itemsByOrderId.set(item.orderId, [])
      itemsByOrderId.get(item.orderId)!.push(item)
    }

    const enriched = orders.map((o) => ({
      ...o,
      orderItems: o.orderId ? (itemsByOrderId.get(o.orderId) || []) : [],
      waitingMinutes: Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000),
    }))

    return reply.send({ orders: enriched })
  })

  // ─── PATCH /restaurant/orders/:id/status ─────────────────────────────────
  app.patch('/orders/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any
    const schema = z.object({
      status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED']),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const order = await prisma.restaurantOrder.update({
      where: { id },
      data: {
        status: parsed.data.status,
        paidAt: parsed.data.status === 'PAID' ? new Date() : undefined,
        updatedAt: new Date(),
      },
    })

    // Sync status to main order
    if (order.orderId) {
      const statusMap: Record<string, string> = {
        CONFIRMED: 'CONFIRMED', PREPARING: 'PROCESSING',
        READY: 'PROCESSING', SERVED: 'DELIVERED', PAID: 'DELIVERED', CANCELLED: 'CANCELLED',
      }
      await prisma.order.update({
        where: { id: order.orderId },
        data: { status: statusMap[parsed.data.status] as any },
      })
    }

    return reply.send({ success: true, order })
  })

  // ─── GET /restaurant/kitchen ──────────────────────────────────────────────
  // Kitchen Display System (KDS) — simplified view for kitchen staff
  app.get('/kitchen', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const activeOrders = await prisma.restaurantOrder.findMany({
      where: { storeId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
      include: { table: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const orderIds = activeOrders.map((o) => o.orderId).filter(Boolean) as string[]
    const items = orderIds.length > 0
      ? await prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          include: { product: { select: { name: true, nameAr: true } } },
        })
      : []

    const itemsByOrderId = new Map<string, typeof items>()
    for (const item of items) {
      if (!itemsByOrderId.has(item.orderId)) itemsByOrderId.set(item.orderId, [])
      itemsByOrderId.get(item.orderId)!.push(item)
    }

    const kdsOrders = activeOrders.map((o) => ({
      id: o.id,
      tableName: o.table.name,
      status: o.status,
      guestCount: o.guestCount,
      notes: o.notes,
      createdAt: o.createdAt,
      waitingMinutes: Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000),
      items: (o.orderId ? itemsByOrderId.get(o.orderId) || [] : []).map((i) => ({
        name: i.product.nameAr || i.product.name,
        quantity: i.quantity,
      })),
    }))

    return reply.send({ orders: kdsOrders, timestamp: new Date().toISOString() })
  })

  // ─── GET /restaurant/stats ────────────────────────────────────────────────
  app.get('/stats', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, date } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const targetDate = date ? new Date(date) : new Date()
    const dayStart = new Date(targetDate.setHours(0, 0, 0, 0))
    const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999))

    const [totalTables, activeTables, todayOrders, tableRevenue] = await Promise.all([
      prisma.restaurantTable.count({ where: { storeId, isActive: true } }),
      prisma.restaurantOrder.count({ where: { storeId, status: { notIn: ['PAID', 'CANCELLED'] } } }),
      prisma.restaurantOrder.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        select: { status: true, orderId: true },
      }),
      prisma.restaurantTable.findMany({
        where: { storeId },
        include: {
          orders: {
            where: { createdAt: { gte: dayStart, lte: dayEnd }, status: 'PAID' },
            select: { orderId: true },
          },
        },
      }),
    ])

    const paidOrderIds = todayOrders.filter((o) => o.status === 'PAID').map((o) => o.orderId).filter(Boolean) as string[]
    const revenue = paidOrderIds.length > 0
      ? await prisma.order.aggregate({ where: { id: { in: paidOrderIds } }, _sum: { total: true } })
      : { _sum: { total: 0 } }

    return reply.send({
      totalTables,
      activeTables,
      todayOrders: todayOrders.length,
      paidOrders: todayOrders.filter((o) => o.status === 'PAID').length,
      cancelledOrders: todayOrders.filter((o) => o.status === 'CANCELLED').length,
      todayRevenue: Number(revenue._sum.total || 0),
    })
  })
}
