import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { getEnv } from '../lib/env'
import { authenticate } from '../middleware/auth.middleware'
import https from 'node:https'
import crypto from 'node:crypto'

function httpGet(url: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers,
      },
      (res) => {
        let raw = ''
        res.on('data', (c) => (raw += c))
        res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

function httpPost(url: string, body: object, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const data = JSON.stringify(body)
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (c) => (raw += c))
        res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function appendFormValue(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return

  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendFormValue(params, `${key}[${index}]`, entry))
    return
  }

  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendFormValue(params, `${key}[${childKey}]`, childValue)
    }
    return
  }

  params.append(key, String(value))
}

function toFormBody(body: Record<string, unknown>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(body)) {
    appendFormValue(params, key, value)
  }

  return params.toString()
}

function httpPostForm(url: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const data = toFormBody(body)
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (c) => (raw += c))
        res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function normalizeGatewayAmount(value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 1000)
}

function resolveGatewayStatus(value: unknown): 'PAID' | 'FAILED' | 'PENDING' {
  const status = String(value ?? '').toUpperCase()

  if (['A', 'APPROVED', 'CAPTURED', 'CONFIRMED', 'COMPLETED', 'PAID'].includes(status)) {
    return 'PAID'
  }

  if (['D', 'DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(status)) {
    return 'FAILED'
  }

  return 'PENDING'
}

async function applyVerifiedGatewayStatus(input: {
  orderId: string
  gatewayRef?: string | null
  status: 'PAID' | 'FAILED' | 'PENDING'
  gatewayResponse: unknown
}) {
  const [payment, order] = await Promise.all([
    prisma.payment.findUnique({
      where: { orderId: input.orderId },
      select: { status: true, paidAt: true, gatewayRef: true },
    }),
    prisma.order.findUnique({
      where: { id: input.orderId },
      select: { paymentStatus: true, paidAt: true },
    }),
  ])

  if (!order) {
    return false
  }

  const currentStatus = payment?.status ?? order.paymentStatus
  const currentGatewayRef = payment?.gatewayRef ?? null

  if (currentStatus === 'PAID' && input.status !== 'PAID') {
    return false
  }

  if (currentStatus === 'FAILED' && input.status === 'PENDING') {
    return false
  }

  if (currentStatus === input.status && (input.gatewayRef ?? currentGatewayRef ?? null) === currentGatewayRef) {
    return false
  }

  const now = input.status === 'PAID' ? payment?.paidAt ?? order.paidAt ?? new Date() : null

  await prisma.payment.updateMany({
    where: { orderId: input.orderId },
    data: {
      status: input.status,
      paidAt: input.status === 'PAID' ? now : undefined,
      gatewayRef: input.gatewayRef ?? undefined,
      gatewayResponse: input.gatewayResponse as any,
    },
  })

  await prisma.order.update({
    where: { id: input.orderId },
    data: {
      paymentStatus: input.status,
      paidAt: input.status === 'PAID' ? now : undefined,
      ...(input.status === 'PAID' ? { status: 'CONFIRMED' as const } : {}),
    },
  })

  return true
}

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const elements = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, ...rest] = part.split('=')
      return [key?.trim(), rest.join('=').trim()]
    }).filter(([key, value]) => key && value)
  ) as Record<string, string>

  const timestamp = elements.t
  const signature = elements.v1
  if (!timestamp || !signature) {
    return false
  }

  const age = Math.abs(Date.now() - Number(timestamp) * 1000)
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
    return false
  }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

type StripeCheckoutSessionWebhook = {
  id?: string
  amount_total?: number | null
  currency?: string | null
  payment_status?: string | null
  metadata?: {
    orderId?: string
    storeId?: string
  }
}

function stripeSessionMatchesOrder(
  session: StripeCheckoutSessionWebhook,
  order: { total: unknown; store: { currency: string } },
  payment: { gatewayRef: string | null }
) {
  if (session.id && payment.gatewayRef && session.id !== payment.gatewayRef) return false

  const expectedAmount = normalizeGatewayAmount(order.total)
  const actualAmount = typeof session.amount_total === 'number' ? session.amount_total : null
  if (expectedAmount !== null && actualAmount !== null && expectedAmount !== actualAmount) return false

  if (session.currency && session.currency.toUpperCase() !== order.store.currency.toUpperCase()) return false

  return true
}

type PayTabsQueryResponse = {
  tran_ref?: string
  cart_id?: string
  cart_amount?: number | string
  cart_currency?: string
  payment_result?: {
    response_status?: string
  }
}

function payTabsResponseMatchesOrder(
  response: PayTabsQueryResponse,
  order: { orderNumber: string; total: unknown; store: { currency: string } },
  payment: { gatewayRef: string | null }
) {
  if (response.tran_ref && payment.gatewayRef && response.tran_ref !== payment.gatewayRef) return false
  if (response.cart_id && response.cart_id !== order.orderNumber) return false

  const expectedAmount = normalizeGatewayAmount(order.total)
  const actualAmount = normalizeGatewayAmount(response.cart_amount)
  if (expectedAmount !== null && actualAmount !== null && expectedAmount !== actualAmount) return false

  if (response.cart_currency && response.cart_currency !== order.store.currency) return false

  return true
}

type PostpayCheckoutResponse = {
  id?: string
  order_id?: string
  total_amount?: number | string
  amount?: number | string
  currency?: string
  status?: string
}

function postpayResponseMatchesOrder(
  response: PostpayCheckoutResponse,
  order: { orderNumber: string; total: unknown; store: { currency: string } },
  payment: { gatewayRef: string | null }
) {
  if (response.id && payment.gatewayRef && response.id !== payment.gatewayRef) return false
  if (response.order_id && response.order_id !== order.orderNumber) return false

  const expectedAmount = normalizeGatewayAmount(order.total)
  const actualAmount = normalizeGatewayAmount(response.total_amount ?? response.amount)
  if (expectedAmount !== null && actualAmount !== null && expectedAmount !== actualAmount) return false

  if (response.currency && response.currency !== order.store.currency) return false

  return true
}

// ─── New Payment Gateway Routes ───────────────────────────────────────────────
// Stripe, PayTabs, PayPal, STC Pay, mada, HyperPay, Postpay

export async function newPaymentRoutes(app: FastifyInstance) {
  const env = getEnv()

  // ════════════════════════════════════════════
  // STRIPE
  // ════════════════════════════════════════════
  app.post('/stripe/checkout', async (request, reply) => {
    const { orderId, storeId, successUrl, cancelUrl } = request.body as {
      orderId: string; storeId: string; successUrl: string; cancelUrl: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { customer: true, store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.stripeEnabled || !settings.stripeSecretKey) {
      return reply.status(400).send({ error: 'Stripe غير مفعّلة لهذا المتجر' })
    }

    const session = await httpPostForm(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: order.store.currency.toLowerCase(),
            unit_amount: Math.round(Number(order.total) * 1000),
            product_data: { name: `طلب #${order.orderNumber}` },
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { orderId, storeId },
        customer_email: order.customer.email || undefined,
      },
      { Authorization: `Bearer ${settings.stripeSecretKey}` }
    )

    if (session.error) return reply.status(400).send({ error: session.error.message })

    await prisma.payment.upsert({
      where: { orderId },
      update: { gatewayRef: session.id, status: 'PENDING' },
      create: { orderId, method: 'STRIPE', amount: order.total, currency: order.store.currency, gatewayRef: session.id },
    })

    return reply.send({ checkoutUrl: session.url, sessionId: session.id })
  })

  // Stripe Webhook
  app.post('/stripe/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string
    if (!sig) return reply.status(400).send({ error: 'Missing signature' })

    const payload = typeof (request as any).rawBody === 'string'
      ? (request as any).rawBody
      : Buffer.isBuffer((request as any).rawBody)
        ? (request as any).rawBody.toString('utf8')
        : ''

    if (!payload) {
      return reply.status(400).send({ error: 'Missing raw payload' })
    }

    let candidateEvent: any

    try {
      candidateEvent = JSON.parse(payload)
    } catch {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    const session = candidateEvent?.data?.object as StripeCheckoutSessionWebhook | undefined
    const orderId = session?.metadata?.orderId
    const storeId = session?.metadata?.storeId

    const order = orderId
      ? await prisma.order.findUnique({
          where: { id: orderId },
          include: { payment: true, store: { include: { settings: true } } },
        })
      : null

    const storeSettings = order?.store.settings ?? (storeId
      ? await prisma.store.findUnique({
          where: { id: storeId },
          select: { settings: true },
        }).then((store) => store?.settings ?? null)
      : null)

    if (!storeSettings?.stripeWebhookSecret) {
      app.log.warn({ orderId, storeId }, 'Stripe webhook ignored because webhook secret is missing')
      return reply.status(202).send({ received: true })
    }

    if (!verifyStripeSignature(payload, sig, storeSettings.stripeWebhookSecret)) {
      return reply.status(400).send({ error: 'Invalid signature' })
    }

    const event = candidateEvent

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (!orderId || !order?.payment) {
        return reply.send({ received: true })
      }

      if (!stripeSessionMatchesOrder(session ?? {}, order, order.payment)) {
        app.log.warn({ orderId, stripeSessionId: session?.id }, 'Stripe webhook verification mismatch')
        return reply.status(409).send({ error: 'charge mismatch' })
      }

      await applyVerifiedGatewayStatus({
        orderId,
        gatewayRef: session?.id ?? order.payment.gatewayRef,
        status: resolveGatewayStatus(session?.payment_status ?? 'PAID'),
        gatewayResponse: event,
      })
    }

    if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      if (orderId) {
        await applyVerifiedGatewayStatus({
          orderId,
          gatewayRef: session?.id ?? order?.payment?.gatewayRef,
          status: 'FAILED',
          gatewayResponse: event,
        })
      }
    }

    return reply.send({ received: true })
  })

  // ════════════════════════════════════════════
  // PAYTABS
  // ════════════════════════════════════════════
  app.post('/paytabs/charge', async (request, reply) => {
    const { orderId, storeId, successUrl, cancelUrl } = request.body as {
      orderId: string; storeId: string; successUrl: string; cancelUrl: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { customer: true, address: true, store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.paytabsEnabled || !settings.paytabsProfileId || !settings.paytabsSecretKey) {
      return reply.status(400).send({ error: 'PayTabs غير مفعّلة لهذا المتجر' })
    }

    const region = settings.paytabsRegion || 'SAU'
    const apiUrl = `https://secure.paytabs.${region === 'SAU' ? 'sa' : 'com'}/payment/request`

    const result = await httpPost(apiUrl, {
      profile_id: settings.paytabsProfileId,
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: order.orderNumber,
      cart_currency: order.store.currency,
      cart_amount: Number(order.total),
      cart_description: `طلب #${order.orderNumber}`,
      customer_details: {
        name: `${order.customer.firstName} ${order.customer.lastName}`,
        email: order.customer.email || 'customer@bazar.bh',
        phone: order.customer.phone,
        street1: order.address?.road || 'N/A',
        city: order.address?.city || 'المنامة',
        country: order.address?.country || 'BH',
      },
      return: successUrl,
      callback: `${env.API_BASE_URL}/api/v1/payments/paytabs/webhook`,
    }, { authorization: settings.paytabsSecretKey })

    if (!result.redirect_url) {
      return reply.status(400).send({ error: 'فشل إنشاء جلسة PayTabs', details: result })
    }

    await prisma.payment.upsert({
      where: { orderId },
      update: { gatewayRef: result.tran_ref, status: 'PENDING' },
      create: { orderId, method: 'PAYTABS', amount: order.total, currency: order.store.currency, gatewayRef: result.tran_ref },
    })

    return reply.send({ checkoutUrl: result.redirect_url, tranRef: result.tran_ref })
  })

  app.post('/paytabs/webhook', async (request, reply) => {
    const { tran_ref } = request.body as { tran_ref?: string }
    if (!tran_ref) return reply.status(400).send({ error: 'missing tran_ref' })

    const payment = await prisma.payment.findFirst({
      where: { gatewayRef: tran_ref },
      include: {
        order: { include: { store: { include: { settings: true } } } },
      },
    })
    if (!payment) return reply.send({ status: 'ok' })

    const settings = payment.order.store.settings
    if (!settings?.paytabsProfileId || !settings.paytabsSecretKey) {
      app.log.warn({ tranRef: tran_ref, orderId: payment.orderId }, 'PayTabs webhook ignored because store configuration is incomplete')
      return reply.status(202).send({ status: 'ok' })
    }

    const region = settings.paytabsRegion || 'SAU'
    const apiUrl = `https://secure.paytabs.${region === 'SAU' ? 'sa' : 'com'}/payment/query`

    let verified: PayTabsQueryResponse
    try {
      verified = await httpPost(apiUrl, {
        profile_id: settings.paytabsProfileId,
        tran_ref: tran_ref,
      }, { authorization: settings.paytabsSecretKey })
    } catch (err) {
      app.log.error({ err, tranRef: tran_ref, orderId: payment.orderId }, 'PayTabs webhook verification failed')
      return reply.status(502).send({ error: 'verification failed' })
    }

    if (!payTabsResponseMatchesOrder(verified, payment.order, payment)) {
      app.log.warn({ tranRef: tran_ref, orderId: payment.orderId }, 'PayTabs webhook verification mismatch')
      return reply.status(409).send({ error: 'charge mismatch' })
    }

    const status = resolveGatewayStatus(verified.payment_result?.response_status)
    if (status !== 'PENDING') {
      await applyVerifiedGatewayStatus({
        orderId: payment.orderId,
        gatewayRef: verified.tran_ref ?? tran_ref,
        status,
        gatewayResponse: verified,
      })
    }

    return reply.send({ status: 'ok' })
  })

  // ════════════════════════════════════════════
  // PAYPAL
  // ════════════════════════════════════════════
  app.post('/paypal/create-order', async (request, reply) => {
    const { orderId, storeId, returnUrl, cancelUrl } = request.body as {
      orderId: string; storeId: string; returnUrl: string; cancelUrl: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.paypalEnabled || !settings.paypalClientId || !settings.paypalSecret) {
      return reply.status(400).send({ error: 'PayPal غير مفعّل لهذا المتجر' })
    }

    const isLive = settings.paypalMode === 'live'
    const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

    // Get access token
    const tokenData = await httpPostForm(`${baseUrl}/v1/oauth2/token`, { grant_type: 'client_credentials' }, {
      Authorization: `Basic ${Buffer.from(`${settings.paypalClientId}:${settings.paypalSecret}`).toString('base64')}`,
    })

    if (!tokenData.access_token) {
      return reply.status(500).send({ error: 'فشل الاتصال بـ PayPal' })
    }

    const ppOrder = await httpPost(`${baseUrl}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.orderNumber,
        amount: { currency_code: 'USD', value: Number(order.total).toFixed(2) },
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: order.store.name,
        user_action: 'PAY_NOW',
      },
    }, { Authorization: `Bearer ${tokenData.access_token}` })

    const approvalUrl = ppOrder.links?.find((l: any) => l.rel === 'approve')?.href
    if (!approvalUrl) return reply.status(400).send({ error: 'فشل إنشاء طلب PayPal' })

    await prisma.payment.upsert({
      where: { orderId },
      update: { gatewayRef: ppOrder.id, status: 'PENDING' },
      create: { orderId, method: 'PAYPAL', amount: order.total, currency: 'USD', gatewayRef: ppOrder.id },
    })

    return reply.send({ approvalUrl, paypalOrderId: ppOrder.id })
  })

  app.post('/paypal/capture', async (request, reply) => {
    const { paypalOrderId, orderId, storeId } = request.body as { paypalOrderId: string; orderId: string; storeId: string }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings!
    const isLive = settings.paypalMode === 'live'
    const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

    const tokenData = await httpPostForm(`${baseUrl}/v1/oauth2/token`, { grant_type: 'client_credentials' }, {
      Authorization: `Basic ${Buffer.from(`${settings.paypalClientId}:${settings.paypalSecret}`).toString('base64')}`,
    })

    const capture = await httpPost(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {}, {
      Authorization: `Bearer ${tokenData.access_token}`,
    })

    if (capture.status === 'COMPLETED') {
      await applyVerifiedGatewayStatus({
        orderId,
        gatewayRef: paypalOrderId,
        status: 'PAID',
        gatewayResponse: capture,
      })
    }

    return reply.send({ status: capture.status, capture })
  })

  // ════════════════════════════════════════════
  // STC PAY
  // ════════════════════════════════════════════
  app.post('/stcpay/charge', async (request, reply) => {
    const { orderId, storeId, mobileNumber } = request.body as {
      orderId: string; storeId: string; mobileNumber: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.stcpayEnabled || !settings.stcpayMerchantId || !settings.stcpayApiKey) {
      return reply.status(400).send({ error: 'STC Pay غير مفعّل لهذا المتجر' })
    }

    // STC Pay direct charge API
    const result = await httpPost('https://b2b.stcpay.com.sa/b2b/payment/v1/directPayment/mobile', {
      MerchantID: settings.stcpayMerchantId,
      BranchID: '1',
      TerminalID: '1',
      STCPayPMTReference: `BAZAR-${order.orderNumber}`,
      Amount: Number(order.total),
      CurrencyCode: '682', // SAR
      BankID: '1',
      MobileNo: mobileNumber,
      TransactionID: order.id,
      TransactionDateTime: new Date().toISOString(),
    }, {
      Authorization: `Basic ${Buffer.from(`${settings.stcpayMerchantId}:${settings.stcpayApiKey}`).toString('base64')}`,
    })

    if (result.STCPayPmtReference) {
      await prisma.payment.upsert({
        where: { orderId },
        update: { gatewayRef: result.STCPayPmtReference, status: 'PENDING' },
        create: { orderId, method: 'STC_PAY', amount: order.total, currency: 'SAR', gatewayRef: result.STCPayPmtReference },
      })
      return reply.send({ message: 'تم إرسال طلب الدفع إلى جوالك', reference: result.STCPayPmtReference })
    }

    return reply.status(400).send({ error: 'فشل الدفع عبر STC Pay', details: result })
  })

  app.post('/stcpay/confirm', async (request, reply) => {
    const { orderId, storeId, otp, reference } = request.body as {
      orderId: string; storeId: string; otp: string; reference: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings!

    const result = await httpPost('https://b2b.stcpay.com.sa/b2b/payment/v1/directPayment/confirm', {
      MerchantID: settings.stcpayMerchantId,
      BranchID: '1',
      TerminalID: '1',
      STCPayPmtReference: reference,
      OTP: otp,
    }, {
      Authorization: `Basic ${Buffer.from(`${settings.stcpayMerchantId}:${settings.stcpayApiKey}`).toString('base64')}`,
    })

    if (result.StatusCode === '3004') {
      await applyVerifiedGatewayStatus({
        orderId,
        gatewayRef: reference,
        status: 'PAID',
        gatewayResponse: result,
      })
      return reply.send({ success: true, message: 'تم الدفع بنجاح' })
    }

    return reply.status(400).send({ success: false, error: 'فشل التحقق من OTP', details: result })
  })

  // ════════════════════════════════════════════
  // MADA (via HyperPay)
  // ════════════════════════════════════════════
  app.post('/mada/checkout', async (request, reply) => {
    const { orderId, storeId } = request.body as { orderId: string; storeId: string }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.madaEnabled || !settings.hyperpayAccessToken || !settings.hyperpayEntityId) {
      return reply.status(400).send({ error: 'مدى غير مفعّل لهذا المتجر' })
    }

    return reply.send({
      message: 'مدى متاحة عبر HyperPay',
      accessToken: settings.hyperpayAccessToken,
      entityId: settings.hyperpayEntityId,
      amount: Number(order.total).toFixed(2),
      currency: 'SAR',
      paymentType: 'MADA',
      checkoutUrl: `https://eu-test.oppwa.com/v1/checkouts`,
    })
  })

  // ════════════════════════════════════════════
  // HYPERPAY
  // ════════════════════════════════════════════
  app.post('/hyperpay/checkout', async (request, reply) => {
    const { orderId, storeId, brand = 'VISA' } = request.body as {
      orderId: string; storeId: string; brand?: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { customer: true, store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.hyperpayEnabled || !settings.hyperpayAccessToken || !settings.hyperpayEntityId) {
      return reply.status(400).send({ error: 'HyperPay غير مفعّل لهذا المتجر' })
    }

    // Create HyperPay checkout (real API call)
    const formData = new URLSearchParams({
      entityId: settings.hyperpayEntityId,
      amount: Number(order.total).toFixed(2),
      currency: 'SAR',
      paymentType: 'DB',
      descriptor: `طلب ${order.orderNumber}`,
      'customer.email': order.customer.email || '',
      'customer.givenName': order.customer.firstName,
      'customer.surname': order.customer.lastName,
      'merchant.name': order.store.name,
      'merchantTransactionId': order.id,
    })

    const result = await fetch('https://eu-test.oppwa.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.hyperpayAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    }).then((r) => r.json() as any)

    if (!result.id) return reply.status(400).send({ error: 'فشل إنشاء جلسة HyperPay', details: result })

    await prisma.payment.upsert({
      where: { orderId },
      update: { gatewayRef: result.id, status: 'PENDING' },
      create: { orderId, method: 'HYPERPAY', amount: order.total, currency: 'SAR', gatewayRef: result.id },
    })

    return reply.send({
      checkoutId: result.id,
      brand,
      scriptUrl: `https://eu-test.oppwa.com/v1/paymentWidgets.js?checkoutId=${result.id}`,
    })
  })

  app.post('/hyperpay/status', async (request, reply) => {
    const { checkoutId, resourcePath, orderId, storeId } = request.body as {
      checkoutId: string; resourcePath: string; orderId: string; storeId: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings!

    const result = await fetch(`https://eu-test.oppwa.com${resourcePath}?entityId=${settings.hyperpayEntityId}`, {
      headers: { Authorization: `Bearer ${settings.hyperpayAccessToken}` },
    }).then((r) => r.json() as any)

    if (result.result?.code?.match(/^(000\.000\.|000\.100\.1|000\.[36])/)) {
      await applyVerifiedGatewayStatus({
        orderId,
        gatewayRef: checkoutId,
        status: 'PAID',
        gatewayResponse: result,
      })
      return reply.send({ success: true, result })
    }

    return reply.status(400).send({ success: false, result })
  })

  // ════════════════════════════════════════════
  // POSTPAY
  // ════════════════════════════════════════════
  app.post('/postpay/checkout', async (request, reply) => {
    const { orderId, storeId, successUrl, cancelUrl } = request.body as {
      orderId: string; storeId: string; successUrl: string; cancelUrl: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: true,
        items: { include: { product: { select: { name: true } } } },
        store: { include: { settings: true } },
      },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.postpayEnabled || !settings.postpayApiKey) {
      return reply.status(400).send({ error: 'Postpay غير مفعّل لهذا المتجر' })
    }

    const result = await httpPost(
      `${settings.postpayApiUrl || 'https://api.postpay.io'}/v1/checkouts`,
      {
        total_amount: Math.round(Number(order.total) * 100),
        currency: order.store.currency,
        order_id: order.orderNumber,
        customer: {
          id: order.customerId,
          first_name: order.customer.firstName,
          last_name: order.customer.lastName,
          phone: order.customer.phone,
          email: order.customer.email,
        },
        items: order.items.map((i) => ({
          reference: i.productId,
          name: i.name,
          unit_price: Math.round(Number(i.price) * 100),
          qty: i.quantity,
        })),
        merchant: { confirmation_url: successUrl, cancel_url: cancelUrl },
      },
      { 'x-api-key': settings.postpayApiKey }
    )

    if (!result.redirect_url) {
      return reply.status(400).send({ error: 'فشل إنشاء جلسة Postpay', details: result })
    }

    await prisma.payment.upsert({
      where: { orderId },
      update: { gatewayRef: result.id, status: 'PENDING' },
      create: { orderId, method: 'POSTPAY', amount: order.total, currency: order.store.currency, gatewayRef: result.id },
    })

    return reply.send({ checkoutUrl: result.redirect_url, sessionId: result.id })
  })

  app.post('/postpay/webhook', async (request, reply) => {
    const body = request.body as { id?: string; order_id?: string }
    if (!body.order_id) return reply.send({ received: true })

    const order = await prisma.order.findFirst({
      where: { orderNumber: body.order_id },
      include: { payment: true, store: { include: { settings: true } } },
    })
    if (!order?.payment) return reply.send({ received: true })

    const settings = order.store.settings
    if (!settings?.postpayApiKey) {
      app.log.warn({ orderId: order.id }, 'Postpay webhook ignored because store is missing API key')
      return reply.status(202).send({ received: true })
    }

    const checkoutId = body.id ?? order.payment.gatewayRef
    if (!checkoutId) {
      return reply.status(202).send({ received: true })
    }

    let verified: PostpayCheckoutResponse
    try {
      verified = await httpGet(`${settings.postpayApiUrl || 'https://api.postpay.io'}/v1/checkouts/${checkoutId}`, {
        'x-api-key': settings.postpayApiKey,
      })
    } catch (err) {
      app.log.error({ err, checkoutId, orderId: order.id }, 'Postpay webhook verification failed')
      return reply.status(502).send({ error: 'verification failed' })
    }

    if (!postpayResponseMatchesOrder(verified, order, order.payment)) {
      app.log.warn({ checkoutId, orderId: order.id }, 'Postpay webhook verification mismatch')
      return reply.status(409).send({ error: 'charge mismatch' })
    }

    const status = resolveGatewayStatus(verified.status)
    if (status !== 'PENDING') {
      await applyVerifiedGatewayStatus({
        orderId: order.id,
        gatewayRef: verified.id ?? checkoutId,
        status,
        gatewayResponse: verified,
      })
    }

    return reply.send({ received: true })
  })

  // ════════════════════════════════════════════
  // Stripe Billing (للاشتراكات الشهرية للمنصة)
  // ════════════════════════════════════════════
  app.post('/stripe-billing/setup', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.body as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, include: { merchant: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const stripeKey = process.env.STRIPE_PLATFORM_SECRET_KEY
    if (!stripeKey) return reply.status(500).send({ error: 'Stripe platform key not configured' })

    // Create or get Stripe customer
    const customer = await httpPostForm('https://api.stripe.com/v1/customers', {
      email: store.merchant?.email,
      name: store.name,
      metadata: { storeId, merchantId },
    }, { Authorization: `Bearer ${stripeKey}` })

    return reply.send({
      message: 'تم إعداد Stripe Billing',
      customerId: customer.id,
      setupUrl: `https://billing.stripe.com/p/login/${customer.id}`,
    })
  })

  // Moyasar Billing (لأتمتة الفوترة الشهرية)
  app.post('/moyasar-billing/charge', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, token, amount, description } = request.body as {
      storeId: string; token: string; amount: number; description: string
    }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const moyasarKey = process.env.MOYASAR_PLATFORM_SECRET_KEY
    if (!moyasarKey) return reply.status(500).send({ error: 'Moyasar platform key not configured' })

    const result = await httpPost('https://api.moyasar.com/v1/payments', {
      amount: Math.round(amount * 100),
      currency: 'SAR',
      description,
      source: { type: 'token', token },
      metadata: { storeId },
    }, {
      Authorization: `Basic ${Buffer.from(`${moyasarKey}:`).toString('base64')}`,
    })

    if (result.status === 'paid') {
      const invoice = await prisma.billingInvoice.create({
        data: {
          storeId,
          plan: store.plan,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          amountBD: amount / 2.65,
          status: 'PAID',
          paidAt: new Date(),
          paymentRef: result.id,
          invoiceNumber: `INV-${Date.now()}`,
        },
      })
      return reply.send({ success: true, invoice })
    }

    return reply.status(400).send({ error: 'فشل الدفع', details: result })
  })
}
