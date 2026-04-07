import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function loyaltyRoutes(app: FastifyInstance) {
  // ── Get Loyalty Config (merchant) ─────────────
  app.get('/config', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const settings = await prisma.storeSettings.findUnique({ where: { storeId } })
    return reply.send({
      loyaltyEnabled: settings?.loyaltyEnabled ?? false,
      loyaltyPointsPerBD: settings?.loyaltyPointsPerBD ?? 10,
      loyaltyBDPerPoint: settings?.loyaltyBDPerPoint ?? 0.01,
      loyaltyMinRedeem: settings?.loyaltyMinRedeem ?? 100,
      loyaltyMaxRedeemPct: settings?.loyaltyMaxRedeemPct ?? 20,
    })
  })

  // ── Update Loyalty Config ──────────────────────
  app.put('/config', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      loyaltyEnabled: z.boolean(),
      loyaltyPointsPerBD: z.number().int().min(1).max(10000),
      loyaltyBDPerPoint: z.number().min(0.0001).max(10),
      loyaltyMinRedeem: z.number().int().min(1),
      loyaltyMaxRedeemPct: z.number().int().min(1).max(100),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const settings = await prisma.storeSettings.upsert({
      where: { storeId },
      create: { storeId, ...data },
      update: data,
    })
    return reply.send({ message: 'تم حفظ إعدادات الولاء', settings })
  })

  // ── Get Customer Points (public) ───────────────
  app.get('/customer', async (request, reply) => {
    const { customerId, storeId } = request.query as { customerId?: string; storeId?: string }
    if (!customerId || !storeId) return reply.status(400).send({ error: 'customerId و storeId مطلوبان' })

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, storeId },
      select: { id: true, firstName: true, lastName: true, loyaltyPoints: true },
    })
    if (!customer) return reply.status(404).send({ error: 'العميل غير موجود' })

    const settings = await prisma.storeSettings.findUnique({ where: { storeId } })
    const bdValue = (customer.loyaltyPoints * Number(settings?.loyaltyBDPerPoint ?? 0.01)).toFixed(3)

    return reply.send({ customer, bdValue, loyaltyEnabled: settings?.loyaltyEnabled ?? false })
  })

  // ── Get Loyalty Transactions ───────────────────
  app.get('/transactions', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { customerId, storeId, page = '1', limit = '20' } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    if (customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true } })
      if (!customer) return reply.status(404).send({ error: 'العميل غير موجود' })
    }

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1)
    const take = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20))
    const skip = (currentPage - 1) * take
    const where = customerId ? { customerId, storeId } : { storeId }

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.loyaltyTransaction.count({ where }),
    ])

    return reply.send({ transactions, total, page: currentPage, pages: Math.ceil(total / take) })
  })

  // ── Earn Points (called after order is PAID) ───
  // POST /loyalty/earn { customerId, storeId, orderId, orderAmount }
  app.post('/earn', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      customerId: z.string().cuid(),
      storeId: z.string().cuid(),
      orderId: z.string().cuid(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { customerId, storeId, orderId } = result.data

    const [store, customer, settings, order] = await Promise.all([
      prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true } }),
      prisma.customer.findFirst({ where: { id: customerId, storeId } }),
      prisma.storeSettings.findUnique({ where: { storeId } }),
      prisma.order.findFirst({ where: { id: orderId, storeId, customerId }, select: { id: true, total: true, paymentStatus: true } }),
    ])

    if (!store) return reply.status(403).send({ error: 'غير مصرح' })
    if (!customer) return reply.status(404).send({ error: 'العميل غير موجود' })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود لهذا العميل في هذا المتجر' })
    if (!settings?.loyaltyEnabled) return reply.send({ message: 'برنامج الولاء غير مفعّل', earned: 0 })
    if (order.paymentStatus !== 'PAID') {
      return reply.status(400).send({ error: 'لا يمكن احتساب نقاط الولاء قبل تأكيد دفع الطلب' })
    }

    // Check if points already earned for this order
    const existing = await prisma.loyaltyTransaction.findFirst({
      where: { orderId, storeId, type: 'EARNED' },
    })
    if (existing) return reply.send({ message: 'تم احتساب النقاط مسبقاً', earned: 0 })

    const earned = Math.floor(Number(order.total) * (settings.loyaltyPointsPerBD ?? 10))
    if (earned <= 0) return reply.send({ earned: 0 })

    const [tx] = await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          storeId, customerId, orderId,
          type: 'EARNED',
          points: earned,
          description: `نقاط مكتسبة من الطلب #${orderId.slice(-6)}`,
        },
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: earned } },
      }),
    ])

    return reply.send({ message: `تم إضافة ${earned} نقطة`, earned, transaction: tx })
  })

  // ── Redeem Points (at checkout) ────────────────
  // POST /loyalty/redeem { customerId, storeId, orderId, pointsToRedeem }
  app.post('/redeem', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      customerId: z.string().cuid(),
      storeId: z.string().cuid(),
      orderId: z.string().cuid(),
      pointsToRedeem: z.number().int().positive(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { customerId, storeId, orderId, pointsToRedeem } = result.data

    const [store, customer, settings, order] = await Promise.all([
      prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true } }),
      prisma.customer.findFirst({ where: { id: customerId, storeId } }),
      prisma.storeSettings.findUnique({ where: { storeId } }),
      prisma.order.findFirst({ where: { id: orderId, storeId, customerId }, select: { id: true, total: true } }),
    ])

    if (!store) return reply.status(403).send({ error: 'غير مصرح' })
    if (!customer) return reply.status(404).send({ error: 'العميل غير موجود' })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود لهذا العميل في هذا المتجر' })
    if (!settings?.loyaltyEnabled) return reply.status(400).send({ error: 'برنامج الولاء غير مفعّل' })
    if (customer.loyaltyPoints < (settings.loyaltyMinRedeem ?? 100)) {
      return reply.status(400).send({ error: `تحتاج على الأقل ${settings.loyaltyMinRedeem} نقطة لاستخدامها` })
    }
    if (pointsToRedeem > customer.loyaltyPoints) {
      return reply.status(400).send({ error: 'رصيد النقاط غير كافٍ' })
    }

    const existingRedeem = await prisma.loyaltyTransaction.findFirst({
      where: { orderId, storeId, type: 'REDEEMED' },
      select: { id: true },
    })
    if (existingRedeem) {
      return reply.status(400).send({ error: 'تم استخدام نقاط الولاء لهذا الطلب مسبقاً' })
    }

    const discountBD = (pointsToRedeem * Number(settings.loyaltyBDPerPoint ?? 0.01))
    const maxDiscountBD = Number(order.total) * ((settings.loyaltyMaxRedeemPct ?? 20) / 100)

    if (discountBD > maxDiscountBD) {
      return reply.status(400).send({
        error: `الحد الأقصى المسموح لاستبدال النقاط لهذا الطلب هو ${maxDiscountBD.toFixed(3)} د.ب`,
      })
    }

    const [tx] = await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          storeId, customerId, orderId,
          type: 'REDEEMED',
          points: -pointsToRedeem,
          description: `نقاط مُستخدمة في الطلب`,
        },
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { decrement: pointsToRedeem } },
      }),
    ])

    return reply.send({
      message: `تم استخدام ${pointsToRedeem} نقطة`,
      discountBD: Number(discountBD.toFixed(3)),
      transaction: tx,
    })
  })

  // ── Manual Adjust (merchant) ───────────────────
  app.post('/adjust', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      customerId: z.string().cuid(),
      points: z.number().int(),
      description: z.string().min(2),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, customerId, points, description } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } })
    if (!customer) return reply.status(404).send({ error: 'العميل غير موجود' })

    const newBalance = customer.loyaltyPoints + points
    if (newBalance < 0) return reply.status(400).send({ error: 'لا يمكن أن يكون الرصيد سالباً' })

    await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          storeId, customerId,
          type: 'ADJUSTED',
          points,
          description,
        },
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: newBalance },
      }),
    ])

    return reply.send({ message: 'تم تعديل النقاط', newBalance })
  })
}
