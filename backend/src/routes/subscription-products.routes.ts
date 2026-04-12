import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── Subscription Products Routes ─────────────────────────────────────────────
// Handles: subscription plans per product, customer subscriptions

export async function subscriptionProductRoutes(app: FastifyInstance) {
  // POST /subscription-products — Create a subscription plan by passing productId in body
  // This is the endpoint used by the dashboard subscription creation form.
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id

    const schema = z.object({
      productId: z.string().min(1),
      name: z.string().min(1),
      nameAr: z.string().min(1),
      intervalType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('MONTHLY'),
      intervalCount: z.number().int().positive().default(1),
      price: z.number().positive(),
      trialDays: z.number().int().min(0).default(0),
      description: z.string().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const { productId, description: _desc, ...planData } = result.data

    const product = await prisma.product.findFirst({
      where: { id: productId },
      include: { store: true },
    })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    const plan = await prisma.subscriptionPlan.create({
      data: { productId, ...planData },
    })

    return reply.status(201).send({ message: 'تم إنشاء خطة الاشتراك', plan })
  })

  // POST /subscription-products/:productId/plans — Add subscription plan to a product
  app.post('/:productId/plans', { preHandler: authenticate }, async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const merchantId = (request.user as any).id

    const schema = z.object({
      name: z.string().min(1),
      nameAr: z.string().min(1),
      intervalType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('MONTHLY'),
      intervalCount: z.number().int().positive().default(1),
      price: z.number().positive(),
      trialDays: z.number().int().min(0).default(0),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    // Verify product belongs to merchant's store
    const product = await prisma.product.findFirst({
      where: { id: productId },
      include: { store: true },
    })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    // Mark product as subscription
    await prisma.product.update({
      where: { id: productId },
      data: { isDigital: false }, // subscription products are not digital per se
    })

    const plan = await prisma.subscriptionPlan.create({
      data: { productId, ...result.data },
    })

    return reply.status(201).send({ message: 'تم إنشاء خطة الاشتراك', plan })
  })

  // GET /subscription-products/:productId/plans
  app.get('/:productId/plans', async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const plans = await prisma.subscriptionPlan.findMany({
      where: { productId, isActive: true },
      orderBy: { price: 'asc' },
    })
    return reply.send({ plans })
  })

  // DELETE /subscription-products/plans/:planId
  app.delete('/plans/:planId', { preHandler: authenticate }, async (request, reply) => {
    const { planId } = request.params as { planId: string }
    const merchantId = (request.user as any).id

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId },
      include: { product: { include: { store: true } } },
    })

    if (!plan || plan.product.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    await prisma.subscriptionPlan.update({ where: { id: planId }, data: { isActive: false } })
    return reply.send({ message: 'تم إلغاء خطة الاشتراك' })
  })

  // POST /subscription-products/subscribe — Customer subscribes (storefront)
  app.post('/subscribe', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      customerId: z.string().cuid(),
      planId: z.string().cuid(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    }

    const { storeId, customerId, planId } = result.data

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true },
    })
    if (!plan) return reply.status(404).send({ error: 'خطة الاشتراك غير موجودة' })

    // Check if already subscribed
    const existing = await prisma.customerSubscription.findFirst({
      where: { customerId, planId, status: { in: ['ACTIVE', 'TRIALING'] } },
    })
    if (existing) return reply.status(400).send({ error: 'أنت مشترك بالفعل في هذه الخطة' })

    const now = new Date()
    let periodStart = now
    let periodEnd = new Date()
    let trialEndsAt: Date | undefined

    if (plan.trialDays > 0) {
      trialEndsAt = new Date(now.getTime() + plan.trialDays * 86400000)
      periodStart = trialEndsAt
    }

    // Calculate period end
    const intervalMs = {
      DAILY: 86400000,
      WEEKLY: 7 * 86400000,
      MONTHLY: 30 * 86400000,
      YEARLY: 365 * 86400000,
    }[plan.intervalType]

    periodEnd = new Date(periodStart.getTime() + intervalMs * plan.intervalCount)

    const subscription = await prisma.customerSubscription.create({
      data: {
        storeId,
        customerId,
        planId,
        status: plan.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStartsAt: plan.trialDays > 0 ? now : undefined,
        trialEndsAt,
      },
    })

    return reply.status(201).send({ message: 'تم الاشتراك بنجاح', subscription })
  })

  // GET /subscription-products/customer/:customerId — Customer's subscriptions
  app.get('/customer/:customerId', { preHandler: authenticate }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string }
    const merchantId = (request.user as any).id

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, store: { merchantId } },
      select: { id: true, storeId: true },
    })

    if (!customer) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    const subscriptions = await prisma.customerSubscription.findMany({
      where: { customerId: customer.id, storeId: customer.storeId },
      include: {
        plan: { include: { product: { select: { name: true, nameAr: true, images: { take: 1 } } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ subscriptions })
  })

  // POST /subscription-products/:subscriptionId/cancel
  app.post('/:subscriptionId/cancel', { preHandler: authenticate }, async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string }
    const merchantId = (request.user as any).id
    const { immediately } = request.body as { immediately?: boolean }

    const sub = await prisma.customerSubscription.findFirst({
      where: { id: subscriptionId },
      include: { store: true },
    })
    if (!sub || sub.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    if (immediately) {
      await prisma.customerSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      })
    } else {
      await prisma.customerSubscription.update({
        where: { id: subscriptionId },
        data: { cancelAtPeriodEnd: true },
      })
    }

    return reply.send({ message: immediately ? 'تم إلغاء الاشتراك فوراً' : 'سيتم إلغاء الاشتراك في نهاية الفترة الحالية' })
  })

  // GET /subscription-products/store/:storeId — All store subscriptions
  app.get('/store/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { page = 1, limit = 20, status } = request.query as { page?: number; limit?: number; status?: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const where: any = { storeId }
    if (status) where.status = status

    const [subscriptions, total] = await Promise.all([
      prisma.customerSubscription.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
          plan: { include: { product: { select: { name: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.customerSubscription.count({ where }),
    ])

    return reply.send({ subscriptions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })
}
