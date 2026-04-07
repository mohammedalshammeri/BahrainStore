import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { findMerchantCountdownTimer, findMerchantStore, findMerchantUpsellRule } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

export async function upsellRoutes(fastify: FastifyInstance) {
  // ── UPSELL RULES ────────────────────────────────────────────────

  // GET all rules for a store
  fastify.get('/upsell/rules', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const rules = await prisma.upsellRule.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })
    return rules
  })

  // POST create rule
  fastify.post('/upsell/rules', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, name, title, titleAr, isActive, triggerType, triggerProductId, triggerCategoryId, offerProductIds, discountPct } = req.body as any
    if (!storeId || !name) return reply.code(400).send({ error: 'storeId and name required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const rule = await prisma.upsellRule.create({
      data: {
        storeId,
        name,
        title: title ?? null,
        titleAr: titleAr ?? null,
        isActive: isActive ?? true,
        triggerType: triggerType ?? 'ANY',
        triggerProductId: triggerProductId ?? null,
        triggerCategoryId: triggerCategoryId ?? null,
        offerProductIds: offerProductIds ?? [],
        discountPct: discountPct ?? null,
      },
    })
    return reply.code(201).send(rule)
  })

  // PUT update rule
  fastify.put('/upsell/rules/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    const data = req.body as any

    const merchantId = req.user.id
    const rule = await findMerchantUpsellRule(merchantId, id)
    if (!rule) return reply.code(403).send({ error: 'غير مصرح' })

    const updatedRule = await prisma.upsellRule.update({
      where: { id },
      data: {
        name: data.name,
        title: data.title ?? null,
        titleAr: data.titleAr ?? null,
        isActive: data.isActive ?? undefined,
        triggerType: data.triggerType ?? undefined,
        triggerProductId: data.triggerProductId ?? null,
        triggerCategoryId: data.triggerCategoryId ?? null,
        offerProductIds: data.offerProductIds ?? undefined,
        discountPct: data.discountPct ?? null,
      },
    })
    return updatedRule
  })

  // DELETE rule
  fastify.delete('/upsell/rules/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any

    const merchantId = req.user.id
    const rule = await findMerchantUpsellRule(merchantId, id)
    if (!rule) return reply.code(403).send({ error: 'غير مصرح' })

    await prisma.upsellRule.delete({ where: { id } })
    return { success: true }
  })

  // GET public upsell offers for a product in a store
  fastify.get('/upsell/public', async (req: any, reply) => {
    const { storeId, productId, categoryId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const rules = await prisma.upsellRule.findMany({
      where: {
        storeId,
        isActive: true,
        OR: [
          { triggerType: 'ANY' },
          ...(productId ? [{ triggerType: 'SPECIFIC_PRODUCT', triggerProductId: productId }] : []),
          ...(categoryId ? [{ triggerType: 'SPECIFIC_CATEGORY', triggerCategoryId: categoryId }] : []),
        ],
      },
    })

    if (!rules.length) return []

    // Gather all offer product IDs
    const offerIds = [...new Set(rules.flatMap(r => r.offerProductIds))]
    const products = await prisma.product.findMany({
      where: { id: { in: offerIds }, isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        price: true,
        comparePrice: true,
        images: { take: 1, select: { url: true } },
        slug: true,
      },
    })

    return rules.map(rule => ({
      ruleId: rule.id,
      title: rule.title,
      titleAr: rule.titleAr,
      discountPct: rule.discountPct,
      products: products.filter(p => rule.offerProductIds.includes(p.id)),
    }))
  })

  // ── COUNTDOWN TIMERS ────────────────────────────────────────────

  // GET all timers for a store
  fastify.get('/countdown/timers', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const timers = await prisma.countdownTimer.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })
    return timers
  })

  // POST create timer
  fastify.post('/countdown/timers', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, name, title, titleAr, endsAt, isActive, showOnAllPages, targetUrl, style } = req.body as any
    if (!storeId || !name || !endsAt) return reply.code(400).send({ error: 'storeId, name, endsAt required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const timer = await prisma.countdownTimer.create({
      data: {
        storeId,
        name,
        title: title ?? null,
        titleAr: titleAr ?? null,
        endsAt: new Date(endsAt),
        isActive: isActive ?? true,
        showOnAllPages: showOnAllPages ?? false,
        targetUrl: targetUrl ?? null,
        style: style ?? 'BAR',
      },
    })
    return reply.code(201).send(timer)
  })

  // PUT update timer
  fastify.put('/countdown/timers/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    const data = req.body as any

    const merchantId = req.user.id
    const timer = await findMerchantCountdownTimer(merchantId, id)
    if (!timer) return reply.code(403).send({ error: 'غير مصرح' })

    const updatedTimer = await prisma.countdownTimer.update({
      where: { id },
      data: {
        name: data.name,
        title: data.title ?? null,
        titleAr: data.titleAr ?? null,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        isActive: data.isActive ?? undefined,
        showOnAllPages: data.showOnAllPages ?? undefined,
        targetUrl: data.targetUrl ?? null,
        style: data.style ?? undefined,
      },
    })
    return updatedTimer
  })

  // DELETE timer
  fastify.delete('/countdown/timers/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any

    const merchantId = req.user.id
    const timer = await findMerchantCountdownTimer(merchantId, id)
    if (!timer) return reply.code(403).send({ error: 'غير مصرح' })

    await prisma.countdownTimer.delete({ where: { id } })
    return { success: true }
  })

  // GET public active timers for storefront
  fastify.get('/countdown/public', async (req: any, reply) => {
    const { storeId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const now = new Date()
    const timers = await prisma.countdownTimer.findMany({
      where: { storeId, isActive: true, endsAt: { gt: now } },
      select: { id: true, title: true, titleAr: true, endsAt: true, style: true, targetUrl: true, showOnAllPages: true },
    })
    return timers
  })
}
