import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'crypto'

export async function referralRoutes(app: FastifyInstance) {

  // Get or create customer referral code
  app.post('/code', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      customerId: z.string().cuid(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, customerId } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    let code = await prisma.referralCode.findFirst({ where: { storeId, customerId } })
    if (!code) {
      const codeStr = crypto.randomBytes(4).toString('hex').toUpperCase()
      code = await prisma.referralCode.create({
        data: { storeId, customerId, code: codeStr },
      })
    }

    return reply.send({ code })
  })

  // Get referral stats for store
  app.get('/stats', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const codes = await prisma.referralCode.findMany({
      where: { storeId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { referrals: true } },
      },
      orderBy: { totalEarned: 'desc' },
      take: 50,
    })

    const totalReferrals = await prisma.referral.count({
      where: { referralCode: { storeId } },
    })
    const completedReferrals = await prisma.referral.count({
      where: { referralCode: { storeId }, status: 'COMPLETED' },
    })

    return reply.send({ codes, totalReferrals, completedReferrals })
  })

  // Get settings for referral program
  app.get('/settings', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })
    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, include: { settings: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })
    const s = store.settings
    return reply.send({
      referralEnabled: s?.referralEnabled ?? false,
      referralRewardType: s?.referralRewardType ?? 'FIXED',
      referralRewardValue: s?.referralRewardValue ? Number(s.referralRewardValue) : 1,
      referralMinOrder: s?.referralMinOrder ? Number(s.referralMinOrder) : null,
    })
  })

  // Update referral settings
  app.put('/settings', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      referralEnabled: z.boolean(),
      referralRewardType: z.enum(['FIXED', 'PERCENTAGE']),
      referralRewardValue: z.number().positive(),
      referralMinOrder: z.number().positive().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.storeSettings.upsert({
      where: { storeId },
      update: data,
      create: { storeId, ...data },
    })
    return reply.send({ message: 'تم الحفظ' })
  })

  // Public: validate referral code at checkout
  app.post('/public/validate', async (request, reply) => {
    const schema = z.object({ storeId: z.string().cuid(), code: z.string() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, code } = result.data
    const settings = await prisma.storeSettings.findUnique({ where: { storeId } })
    if (!settings?.referralEnabled) return reply.status(400).send({ error: 'برنامج الإحالة غير مفعّل' })

    const referralCode = await prisma.referralCode.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
      include: { customer: { select: { firstName: true, lastName: true } } },
    })
    if (!referralCode) return reply.status(404).send({ error: 'كود الإحالة غير صحيح' })

    return reply.send({
      valid: true,
      referredBy: `${referralCode.customer.firstName} ${referralCode.customer.lastName}`,
      rewardType: settings.referralRewardType,
      rewardValue: Number(settings.referralRewardValue),
    })
  })
}
