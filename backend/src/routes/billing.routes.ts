import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, requireFullPlatformAdmin } from '../middleware/auth.middleware'

type TapBillingChargeResponse = {
  id?: string
  status?: string
  amount?: number | string
  currency?: string
  reference?: {
    merchant?: string
  }
}

function normalizeBillingAmount(value: unknown): number | null {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function getTapBillingStatus(charge: TapBillingChargeResponse): 'PAID' | 'FAILED' | 'PENDING' {
  const status = String(charge.status ?? '').toUpperCase()

  if (status === 'CAPTURED') return 'PAID'
  if (status === 'DECLINED' || status === 'CANCELLED' || status === 'FAILED') return 'FAILED'

  return 'PENDING'
}

function tapBillingChargeMatchesPayment(
  charge: TapBillingChargeResponse,
  payment: { id: string; gatewayRef: string | null; amount: unknown; currency: string }
): boolean {
  if (charge.id == null || charge.id !== payment.gatewayRef) return false
  if (charge.reference?.merchant && charge.reference.merchant !== payment.id) return false

  const expectedAmount = normalizeBillingAmount(payment.amount)
  const chargeAmount = normalizeBillingAmount(charge.amount)
  if (expectedAmount !== null && chargeAmount !== null && expectedAmount !== chargeAmount) return false

  if (charge.currency && charge.currency !== payment.currency) return false

  return true
}

async function fetchTapBillingCharge(chargeId: string, secretKey: string): Promise<TapBillingChargeResponse> {
  const response = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(`Tap billing verification failed with status ${response.status}`)
  }

  return data as TapBillingChargeResponse
}

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

async function activateStorePlanFromInvoice(invoice: { storeId: string; plan: string; periodEnd: Date }) {
  await prisma.store.update({
    where: { id: invoice.storeId },
    data: {
      plan: invoice.plan as any,
      planExpiresAt: invoice.periodEnd,
    },
  })
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

    const invoiceStatus = amountBD === 0 ? 'PAID' : paymentRef ? 'PAID' : 'PENDING'

    // Create invoice
    const invoice = await prisma.billingInvoice.create({
      data: {
        storeId,
        plan,
        periodStart,
        periodEnd,
        amountBD,
        status: invoiceStatus,
        paidAt: invoiceStatus === 'PAID' ? now : null,
        paymentRef,
        invoiceNumber: makeInvoiceNumber(),
      },
    })

    if (invoiceStatus === 'PAID') {
      await activateStorePlanFromInvoice({ storeId, plan, periodEnd })
    }

    return reply.send({
      message: invoiceStatus === 'PAID' ? 'تم تفعيل الخطة بعد تأكيد الدفع' : 'تم إنشاء فاتورة الترقية والخطة ستُفعّل بعد تأكيد الدفع',
      plan,
      planInfo,
      invoice,
      expiresAt: invoiceStatus === 'PAID' ? periodEnd : null,
      activated: invoiceStatus === 'PAID',
      pendingPayment: invoiceStatus !== 'PAID',
    })
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
  app.patch('/invoices/:invoiceId/pay', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (request, reply) => {
    const schema = z.object({ paymentRef: z.string().optional() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const { invoiceId } = request.params as { invoiceId: string }

    const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) {
      return reply.status(404).send({ error: 'الفاتورة غير موجودة' })
    }

    const paidAt = new Date()
    const updated = await prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt, paymentRef: result.data.paymentRef ?? invoice.paymentRef },
    })

    await activateStorePlanFromInvoice({
      storeId: invoice.storeId,
      plan: invoice.plan,
      periodEnd: invoice.periodEnd,
    })

    return reply.send({ message: 'تم تسجيل الدفع وتفعيل الخطة', invoice: updated })
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

  // ── LAYER 12: Merchant Subscription Payments ─────────────────────────────

  // GET merchant payment history for a store
  app.get('/subscription/payments', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as { id: string }).id
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const payments = await prisma.merchantPayment.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send({ payments })
  })

  // POST initiate subscription payment (creates payment record, returns Tap hosted URL)
  app.post('/subscription/initiate', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as { id: string }).id
    const { storeId, invoiceId, amount, paymentMethod } = request.body as {
      storeId: string; invoiceId?: string; amount: number; paymentMethod?: string
    }
    if (!storeId || !amount) return reply.status(400).send({ error: 'storeId و amount مطلوبان' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true, name: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Create a pending payment record
    const payment = await prisma.merchantPayment.create({
      data: {
        storeId,
        merchantId,
        invoiceId: invoiceId ?? null,
        amount,
        currency: 'BHD',
        paymentMethod: paymentMethod ?? null,
        status: 'PENDING',
      },
    })

    // In production: call Tap API to create a charge and get hosted payment URL
    // For now, return a placeholder redirect URL and the payment record
    const tapApiKey = process.env.TAP_SECRET_KEY
    let tapPaymentUrl: string | null = null

    if (tapApiKey) {
      try {
        const res = await fetch('https://api.tap.company/v2/charges', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tapApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            currency: 'BHD',
            description: `اشتراك ${store.name}`,
            redirect: { url: `${process.env.DASHBOARD_URL ?? 'https://app.bazar.bh'}/billing?payment=${payment.id}` },
            source: { id: 'src_all' },
            reference: { merchant: payment.id },
          }),
        })
        if (res.ok) {
          const data = await res.json() as { transaction?: { url?: string }; id?: string }
          tapPaymentUrl = data.transaction?.url ?? null
          if (data.id) {
            await prisma.merchantPayment.update({ where: { id: payment.id }, data: { gatewayRef: data.id, tapPaymentUrl } })
          }
        }
      } catch (err) {
        // Non-fatal — return payment record without redirect URL
      }
    }

    return reply.status(201).send({ payment, tapPaymentUrl })
  })

  // POST Tap webhook callback — update payment status
  app.post('/subscription/tap-callback', async (request, reply) => {
    const { id: chargeId } = request.body as { id?: string }
    if (!chargeId) return reply.status(400).send({ error: 'invalid payload' })

    const payment = await prisma.merchantPayment.findFirst({
      where: { gatewayRef: chargeId },
      include: { store: { include: { settings: true } } },
    })
    if (!payment) return reply.send({ ok: true }) // ignore unknown

    const settings = payment.store.settings
    if (!settings?.tapSecretKey) {
      app.log.warn({ chargeId, paymentId: payment.id }, 'Subscription Tap callback ignored because store is missing tap secret')
      return reply.status(202).send({ ok: true })
    }

    let verifiedCharge: TapBillingChargeResponse
    try {
      verifiedCharge = await fetchTapBillingCharge(chargeId, settings.tapSecretKey)
    } catch (err) {
      app.log.error({ err, chargeId, paymentId: payment.id }, 'Subscription Tap verification failed')
      return reply.status(502).send({ error: 'verification failed' })
    }

    if (!tapBillingChargeMatchesPayment(verifiedCharge, payment)) {
      app.log.warn({ chargeId, paymentId: payment.id }, 'Subscription Tap callback verification mismatch')
      return reply.status(409).send({ error: 'charge mismatch' })
    }

    const status = getTapBillingStatus(verifiedCharge)

    if (status === 'PAID') {
      await prisma.merchantPayment.update({ where: { id: payment.id }, data: { status: 'PAID', paidAt: new Date() } })
      // Extend plan by 30 days from today or from current expiry
      const store = await prisma.store.findUnique({ where: { id: payment.storeId }, select: { planExpiresAt: true } })
      const base = store?.planExpiresAt && store.planExpiresAt > new Date() ? store.planExpiresAt : new Date()
      const newExpiry = new Date(base)
      newExpiry.setDate(newExpiry.getDate() + 30)
      await prisma.store.update({ where: { id: payment.storeId }, data: { planExpiresAt: newExpiry, gracePeriodEnds: null, paymentRetryCount: 0 } })
    } else if (status === 'FAILED') {
      await prisma.merchantPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failedAt: new Date(), retryCount: { increment: 1 } } })
      await prisma.store.update({ where: { id: payment.storeId }, data: { paymentRetryCount: { increment: 1 } } })
    }

    return reply.send({ ok: true })
  })
}
