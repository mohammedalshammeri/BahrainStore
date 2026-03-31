import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ── Plan definitions ──────────────────────────
export const PLAN_PRICES: Record<string, { monthly: number; name: string; nameAr: string; features: string[] }> = {
  STARTER: {
    monthly: 0,
    name: 'Starter',
    nameAr: 'مجاني',
    features: ['100 منتج', '50 طلب/شهر', 'متجر واحد', 'دعم البريد الإلكتروني'],
  },
  GROWTH: {
    monthly: 19,
    name: 'Growth',
    nameAr: 'نمو',
    features: ['1,000 منتج', '500 طلب/شهر', 'إحصائيات متقدمة', 'دعم واتساب', 'كوبونات خصم'],
  },
  PRO: {
    monthly: 49,
    name: 'Pro',
    nameAr: 'احترافي',
    features: ['منتجات غير محدودة', 'طلبات غير محدودة', 'API عامة', 'نقاط الولاء', 'خاصية متعددة المستخدمين', 'أولوية الدعم'],
  },
  ENTERPRISE: {
    monthly: 149,
    name: 'Enterprise',
    nameAr: 'مؤسسي',
    features: ['كل مزايا Pro', 'مدير حساب مخصص', 'SLA مضمون 99.9%', 'تكامل مخصص', 'تقارير مخصصة'],
  },
}

const TRIAL_DAYS = 14

function makeInvoiceNumber(): string {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `INV-${yyyymm}-${rand}`
}

export async function billingRoutes(app: FastifyInstance) {
  // ── Get plans list (public) ───────────────────
  app.get('/plans', async (_req, reply) => {
    return reply.send({ plans: PLAN_PRICES })
  })

  // ── Get store billing status (auth) ──────────
  app.get('/status', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const now = new Date()
    const isTrialActive = store.trialEndsAt ? store.trialEndsAt > now : false
    const isPlanActive = store.planExpiresAt ? store.planExpiresAt > now : store.plan === 'STARTER'
    const daysUntilExpiry = store.planExpiresAt
      ? Math.max(0, Math.ceil((store.planExpiresAt.getTime() - now.getTime()) / 86400000))
      : null
    const trialDaysLeft = store.trialEndsAt
      ? Math.max(0, Math.ceil((store.trialEndsAt.getTime() - now.getTime()) / 86400000))
      : null

    const planInfo = PLAN_PRICES[store.plan]

    return reply.send({
      plan: store.plan,
      planInfo,
      isTrialActive,
      trialDaysLeft,
      isPlanActive,
      daysUntilExpiry,
      planExpiresAt: store.planExpiresAt,
      trialEndsAt: store.trialEndsAt,
    })
  })

  // ── Start 14-day trial (auth) ─────────────────
  app.post('/start-trial', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ storeId: z.string().cuid() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { storeId } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    if (store.trialEndsAt) {
      return reply.status(400).send({ error: 'تم استخدام الفترة التجريبية مسبقاً' })
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    await prisma.store.update({
      where: { id: storeId },
      data: { trialEndsAt },
    })

    return reply.send({ message: 'بدأت الفترة التجريبية', trialEndsAt, trialDays: TRIAL_DAYS })
  })

  // ── Upgrade plan (auth) — creates invoice ─────
  app.post('/upgrade', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      plan: z.enum(['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']),
      paymentRef: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { storeId, plan, paymentRef } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const planInfo = PLAN_PRICES[plan]
    const now = new Date()
    const periodStart = now
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const amountBD = planInfo.monthly

    // Create invoice
    const invoice = await prisma.billingInvoice.create({
      data: {
        storeId,
        plan,
        periodStart,
        periodEnd,
        amountBD,
        status: amountBD === 0 ? 'PAID' : paymentRef ? 'PAID' : 'PENDING',
        paidAt: amountBD === 0 || paymentRef ? now : null,
        paymentRef,
        invoiceNumber: makeInvoiceNumber(),
      },
    })

    // Update store plan
    await prisma.store.update({
      where: { id: storeId },
      data: {
        plan,
        planExpiresAt: periodEnd,
      },
    })

    return reply.send({ message: 'تم ترقية الخطة', plan, planInfo, invoice, expiresAt: periodEnd })
  })

  // ── Get invoices (auth) ───────────────────────
  app.get('/invoices', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, page = '1' } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * 10
    const [invoices, total] = await Promise.all([
      prisma.billingInvoice.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: 10,
      }),
      prisma.billingInvoice.count({ where: { storeId } }),
    ])

    return reply.send({ invoices, total, page: parseInt(page), pages: Math.ceil(total / 10) })
  })

  // ── Mark invoice paid (auth — admin use or after payment) ──
  app.patch('/invoices/:invoiceId/pay', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ paymentRef: z.string().optional() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { invoiceId } = request.params as { invoiceId: string }

    const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId }, include: { store: true } })
    if (!invoice || invoice.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الفاتورة غير موجودة' })
    }

    const updated = await prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date(), paymentRef: result.data.paymentRef },
    })

    return reply.send({ message: 'تم تسجيل الدفع', invoice: updated })
  })

  // ── Check if store is active/within plan limits ─
  app.get('/check', async (request, reply) => {
    const { storeId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const now = new Date()
    const isTrialActive = store.trialEndsAt ? store.trialEndsAt > now : false
    const isPlanPaid = store.planExpiresAt ? store.planExpiresAt > now : false
    const isStarter = store.plan === 'STARTER'
    const isAccessible = isTrialActive || isPlanPaid || isStarter

    return reply.send({ accessible: isAccessible, plan: store.plan, isTrialActive })
  })

  // ── Generate / Rotate API Key ─────────────────
  app.post('/api-key', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ storeId: z.string().cuid() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const { storeId } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const crypto = await import('crypto')
    const apiKey = `bz_live_${crypto.randomBytes(24).toString('hex')}`

    await prisma.store.update({ where: { id: storeId }, data: { apiKey } })

    return reply.send({ apiKey, message: 'احفظ مفتاح API هذا — لن يظهر مجدداً' })
  })

  // ── Get API Key (masked) ───────────────────────
  app.get('/api-key', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { apiKey: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const masked = store.apiKey
      ? `${store.apiKey.slice(0, 12)}${'*'.repeat(store.apiKey.length - 20)}${store.apiKey.slice(-8)}`
      : null

    return reply.send({ hasApiKey: Boolean(store.apiKey), maskedKey: masked })
  })
}
