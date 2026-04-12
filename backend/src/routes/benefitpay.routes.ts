import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { findMerchantOrder, findMerchantPaymentByGatewayRef, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'
import https from 'node:https'
import crypto from 'node:crypto'
import { processLoanRepayment } from '../lib/finance-repayment'

// ─── BenefitPay (BENEFIT Bahrain) Payment Gateway Integration ────────────────
// Official payment gateway in Bahrain — connects to Benefit Payment Gateway (BPG)
// API Docs: https://www.benefit.com.bh/
// Typical Flow: 1) Initiate session → 2) Redirect customer → 3) Webhook on completion

const BENEFIT_PGW_URL = process.env.BENEFIT_PGW_URL || 'https://pgw.benefit.com.bh/pgw/api/v1'
const BENEFIT_MERCHANT_ID = process.env.BENEFIT_MERCHANT_ID || ''
const BENEFIT_SECRET_KEY = process.env.BENEFIT_SECRET_KEY || ''
const BENEFIT_CHECKOUT_URL = process.env.BENEFIT_CHECKOUT_URL || 'https://pgw.benefit.com.bh/pgw/payment'
const APP_URL = process.env.APP_URL || 'https://app.bazar.bh'

function isBenefitPayConfigured(): boolean {
  return Boolean(BENEFIT_MERCHANT_ID && BENEFIT_SECRET_KEY)
}

// ─── Helper: HTTPS POST to BenefitPay gateway ────────────────────────────────
function benefitPost(path: string, body: Record<string, any>, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const url = new URL(path.startsWith('http') ? path : BENEFIT_PGW_URL + path)
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let raw = ''
        res.on('data', d => raw += d)
        res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve({ raw }) } })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ─── Generate HMAC-SHA256 signature (BenefitPay standard) ────────────────────
function signRequest(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const payload = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
  return crypto.createHmac('sha256', BENEFIT_SECRET_KEY).update(payload).digest('hex').toUpperCase()
}

// ─── Verify inbound webhook signature ────────────────────────────────────────
function verifyWebhookSignature(payload: Record<string, string>, signature: string): boolean {
  if (!BENEFIT_SECRET_KEY) return false

  const normalizedSignature = signature.trim().toUpperCase()
  if (!/^[A-F0-9]+$/.test(normalizedSignature)) return false

  const computed = signRequest(payload)
  if (computed.length !== normalizedSignature.length) return false

  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(normalizedSignature, 'hex'))
}

export async function issueBenefitPayRefund(params: {
  merchantId: string
  orderId: string
  amount?: number
  reason?: string
}) {
  if (!isBenefitPayConfigured()) {
    return {
      ok: false as const,
      statusCode: 503,
      body: {
        error: 'BenefitPay غير مهيأ في البيئة الحالية',
        status: 'NOT_READY',
      },
    }
  }

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, store: { merchantId: params.merchantId } },
    select: { id: true, total: true, paymentStatus: true, payment: { select: { gatewayRef: true } } },
  })

  if (!order) {
    return {
      ok: false as const,
      statusCode: 404,
      body: { error: 'الطلب غير موجود' },
    }
  }

  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
    return {
      ok: false as const,
      statusCode: 400,
      body: { error: 'لا يمكن استرداد طلب غير مدفوع' },
    }
  }

  const refundAmount = params.amount || Number(order.total)
  if (refundAmount > Number(order.total)) {
    return {
      ok: false as const,
      statusCode: 400,
      body: { error: 'مبلغ الاسترداد أكبر من قيمة الطلب' },
    }
  }

  const requestParams: Record<string, string> = {
    merchantId: BENEFIT_MERCHANT_ID,
    originalOrderId: order.payment?.gatewayRef || params.orderId,
    refundAmount: refundAmount.toFixed(3),
    currency: 'BHD',
    reason: params.reason || 'Customer refund request',
  }
  requestParams['signature'] = signRequest(requestParams)

  try {
    const refundResponse = await benefitPost('/refund/create', requestParams, {
      'X-Merchant-ID': BENEFIT_MERCHANT_ID,
    })

    if (refundResponse.status === 'SUCCESS' || refundResponse.refundId) {
      await prisma.order.update({
        where: { id: params.orderId },
        data: {
          paymentStatus: refundAmount >= Number(order.total) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          notes: `BenefitPay Refund: ${refundResponse.refundId} | ${refundAmount.toFixed(3)} BHD`,
        },
      })

      return {
        ok: true as const,
        body: {
          success: true,
          refundId: refundResponse.refundId,
          amount: refundAmount,
          currency: 'BHD',
          message: 'تم إصدار الاسترداد بنجاح',
        },
      }
    }

    return {
      ok: false as const,
      statusCode: 400,
      body: { error: 'فشل إصدار الاسترداد', details: refundResponse },
    }
  } catch (error: any) {
    return {
      ok: false as const,
      statusCode: 502,
      body: {
        error: 'تعذر إصدار الاسترداد عبر BenefitPay',
        status: 'GATEWAY_UNAVAILABLE',
        details: error?.message ?? 'unknown_error',
      },
    }
  }
}

export async function benefitPayRoutes(app: FastifyInstance) {
  // ─── POST /benefitpay/initiate — Start a BenefitPay payment session ───────
  app.post('/initiate', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string().cuid(),
      returnUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    if (!isBenefitPayConfigured()) {
      return reply.status(503).send({
        error: 'BenefitPay غير مهيأ في البيئة الحالية',
        status: 'NOT_READY',
      })
    }

    const merchantId = (request.user as any).id
    const { orderId, returnUrl, cancelUrl } = parsed.data

    const ownedOrder = await findMerchantOrder(merchantId, orderId)
    if (!ownedOrder) return reply.status(403).send({ error: 'غير مصرح' })

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { name: true, currency: true } },
        customer: { select: { email: true, firstName: true, lastName: true, phone: true } },
      },
    })

    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })
    if (order.paymentStatus === 'PAID') return reply.status(400).send({ error: 'الطلب مدفوع بالفعل' })

    // BenefitPay only supports BHD
    const currency = order.store.currency || 'BHD'
    const amountFormatted = order.total.toFixed(3) // BHD uses 3 decimal places

    const trackingId = `BAZAR-${orderId.substring(0, 8).toUpperCase()}-${Date.now()}`

    const callbackUrl = `${APP_URL}/api/v1/benefitpay/webhook`
    const successUrl = returnUrl || `${APP_URL}/payment/success?orderId=${orderId}`
    const failureUrl = cancelUrl || `${APP_URL}/payment/failed?orderId=${orderId}`

    // Build request to BenefitPay initiate endpoint
    const requestParams: Record<string, string> = {
      merchantId: BENEFIT_MERCHANT_ID,
      orderId: trackingId,
      amount: amountFormatted,
      currency,
      language: 'AR',
      callbackUrl,
      successUrl,
      failureUrl,
      customerEmail: order.customer?.email || '',
      customerName: `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim(),
    }

    requestParams['signature'] = signRequest(requestParams)

    try {
      const pgwResponse = await benefitPost('/session/create', requestParams, {
        'X-Merchant-ID': BENEFIT_MERCHANT_ID,
      })

      if (!pgwResponse.sessionId) {
        return reply.status(502).send({
          error: 'بوابة BenefitPay لم تُرجع sessionId صالحاً',
          status: 'GATEWAY_UNAVAILABLE',
          details: pgwResponse,
        })
      }

      // Upsert payment record with tracking reference
      await prisma.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          method: 'BENEFIT_PAY',
          amount: order.total,
          currency,
          status: 'PENDING',
          gatewayRef: trackingId,
        },
        update: { gatewayRef: trackingId, status: 'PENDING' },
      })

      return reply.send({
        sessionId: pgwResponse.sessionId,
        paymentUrl: `${BENEFIT_CHECKOUT_URL}?sessionId=${pgwResponse.sessionId}`,
        trackingId,
        orderId,
        amount: amountFormatted,
        currency,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry
      })
    } catch (err: any) {
      return reply.status(502).send({ error: 'تعذر إنشاء جلسة الدفع', details: err.message })
    }
  })

  // ─── POST /benefitpay/verify — Verify a payment by transaction ID ─────────
  app.post('/verify', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string().cuid(),
      transactionId: z.string().min(4),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { orderId, transactionId } = parsed.data

    const ownedOrder = await findMerchantOrder(merchantId, orderId)
    if (!ownedOrder) return reply.status(403).send({ error: 'غير مصرح' })

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, total: true, paymentStatus: true, storeId: true, payment: { select: { gatewayRef: true } } },
    })

    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    // If already paid, return success immediately
    if (order.paymentStatus === 'PAID') {
      return reply.send({ status: 'PAID', message: 'تم الدفع بنجاح', orderId })
    }

    const requestParams: Record<string, string> = {
      merchantId: BENEFIT_MERCHANT_ID,
      transactionId,
      orderId: order.payment?.gatewayRef || orderId,
    }
    requestParams['signature'] = signRequest(requestParams)

    try {
      const verifyResponse = await benefitPost('/transaction/verify', requestParams, {
        'X-Merchant-ID': BENEFIT_MERCHANT_ID,
      })

      if (verifyResponse.transactionStatus === 'CAPTURED' || verifyResponse.status === 'SUCCESS') {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'CONFIRMED' },
        })
        await prisma.payment.updateMany({
          where: { orderId },
          data: { status: 'PAID', paidAt: new Date(), gatewayRef: transactionId },
        })

        // Deduct from active Bazar Finance loan (fire-and-forget)
        processLoanRepayment(order.storeId, orderId, Number(order.total)).catch(console.error)

        return reply.send({ status: 'PAID', orderId, transactionId, message: 'تم التحقق من الدفع بنجاح' })
      }

      return reply.send({
        status: verifyResponse.transactionStatus || 'PENDING',
        orderId,
        transactionId,
        message: 'لم يكتمل الدفع بعد',
      })
    } catch {
      return reply.status(502).send({ error: 'تعذر التحقق من حالة الدفع' })
    }
  })

  // ─── POST /benefitpay/webhook — Receive async payment notifications ────────
  // This endpoint is hit by BenefitPay servers — NO auth middleware
  app.post('/webhook', async (request, reply) => {
    const body = request.body as Record<string, string>

    // Verify signature from BenefitPay
    const { signature, ...params } = body

    if (BENEFIT_SECRET_KEY) {
      if (!signature) {
        app.log.warn('BenefitPay webhook missing signature')
        return reply.status(401).send({ error: 'Missing signature' })
      }

      const isValid = verifyWebhookSignature(params, signature)
      if (!isValid) {
        app.log.warn('BenefitPay webhook signature mismatch')
        return reply.status(401).send({ error: 'Invalid signature' })
      }
    }

    const { orderId: trackingId, transactionId, transactionStatus, amount, currency } = body

    // Find our order by tracking ID stored on Payment.gatewayRef
    if (!trackingId) return reply.send({ received: true })

    const payment = await prisma.payment.findFirst({
      where: { gatewayRef: trackingId },
      include: { order: { select: { id: true, storeId: true, paymentStatus: true, total: true } } },
    })

    if (!payment) {
      app.log.warn(`BenefitPay webhook: order not found for trackingId ${trackingId}`)
      return reply.send({ received: true })
    }

    if (transactionStatus === 'CAPTURED' || transactionStatus === 'SUCCESS') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: new Date(), gatewayRef: transactionId || trackingId, gatewayResponse: body as any },
      })
      await prisma.order.update({
        where: { id: payment.order.id },
        data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'CONFIRMED' },
      })
      // Deduct from active Bazar Finance loan (fire-and-forget)
      processLoanRepayment(payment.order.storeId, payment.order.id, Number(payment.order.total)).catch(console.error)
    } else if (transactionStatus === 'DECLINED' || transactionStatus === 'FAILED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } })
      await prisma.order.update({ where: { id: payment.order.id }, data: { paymentStatus: 'FAILED' } })
    }

    // Always return 200 to acknowledge receipt
    return reply.send({ received: true })
  })

  // ─── GET /benefitpay/config — Get store's BenefitPay configuration ────────
  app.get('/config/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await findMerchantStore(merchantId, storeId)

    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Check if BenefitPay is configured
    const isConfigured = !!(BENEFIT_MERCHANT_ID && BENEFIT_SECRET_KEY)
    const isTestMode = !BENEFIT_MERCHANT_ID || BENEFIT_MERCHANT_ID.startsWith('TEST')

    return reply.send({
      storeId,
      gateway: 'benefit_pay',
      isConfigured,
      isTestMode,
      supportedCurrencies: ['BHD'],
      merchantId: BENEFIT_MERCHANT_ID ? `${BENEFIT_MERCHANT_ID.substring(0, 4)}****` : null,
      webhookUrl: `${APP_URL}/api/v1/benefitpay/webhook`,
      instructions: isConfigured ? null : {
        ar: 'قم بتسجيل الدخول إلى بوابة بنفت واحصل على Merchant ID وSecret Key',
        en: 'Log in to Benefit merchant portal to get your Merchant ID and Secret Key',
        portalUrl: 'https://merchant.benefit.com.bh',
      },
    })
  })

  // ─── POST /benefitpay/refund — Issue a refund via BenefitPay ─────────────
  app.post('/refund', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string().cuid(),
      amount: z.number().positive().optional(), // partial refund support
      reason: z.string().max(200).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { orderId, amount, reason } = parsed.data
    const merchantId = (request.user as any).id
    const refundResult = await issueBenefitPayRefund({ merchantId, orderId, amount, reason })
    if (!refundResult.ok) {
      return reply.status(refundResult.statusCode).send(refundResult.body)
    }

    return reply.send(refundResult.body)
  })

  // ─── GET /benefitpay/status/:trackingId — Query payment status by order ───
  app.get('/status/:trackingId', { preHandler: authenticate }, async (request, reply) => {
    const { trackingId } = request.params as { trackingId: string }
    const merchantId = (request.user as any).id

    const payment = await findMerchantPaymentByGatewayRef(merchantId, trackingId)
    if (!payment) return reply.status(403).send({ error: 'غير مصرح' })

    const requestParams: Record<string, string> = {
      merchantId: BENEFIT_MERCHANT_ID,
      orderId: trackingId,
    }
    requestParams['signature'] = signRequest(requestParams)

    try {
      const statusResponse = await benefitPost('/transaction/status', requestParams, {
        'X-Merchant-ID': BENEFIT_MERCHANT_ID,
      })

      return reply.send({
        trackingId,
        status: statusResponse.transactionStatus || statusResponse.status || 'UNKNOWN',
        transactionId: statusResponse.transactionId,
        amount: statusResponse.amount,
        currency: statusResponse.currency,
        timestamp: statusResponse.transactionDate,
      })
    } catch {
      return reply.send({ trackingId, status: 'UNAVAILABLE', message: 'تعذر الاتصال ببوابة الدفع' })
    }
  })
}
