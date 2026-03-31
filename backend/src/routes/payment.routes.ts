import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import https from 'node:https'

// ─── Helper: HTTPS POST (no external deps) ────────────────────────────────────
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
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch {
            resolve(raw)
          }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

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
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch {
            resolve(raw)
          }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

export async function paymentRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────────────────────────────────
  // TAP PAYMENTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /payment/tap/charge
   * Create a Tap Payments charge and return the redirect URL.
   * Body: { orderId, storeId, successUrl, cancelUrl }
   */
  app.post('/tap/charge', async (request, reply) => {
    const { orderId, storeId, successUrl, cancelUrl } = request.body as {
      orderId: string
      storeId: string
      successUrl: string
      cancelUrl: string
    }

    // Fetch order + store settings
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: true,
        store: { include: { settings: true } },
      },
    })

    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.tapEnabled || !settings.tapSecretKey) {
      return reply.status(400).send({ error: 'بوابة Tap غير مفعّلة لهذا المتجر' })
    }

    const amount = Number(order.total)
    const currency = order.store.currency

    const chargeBody = {
      amount,
      currency,
      customer: {
        first_name: order.customer.firstName,
        last_name: order.customer.lastName,
        phone: { country_code: '973', number: order.customer.phone.replace(/^\+?973/, '') },
      },
      source: { id: 'src_all' },
      redirect: { url: successUrl },
      post: { url: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/api/v1/payment/tap/webhook` },
      description: `طلب #${order.orderNumber}`,
      metadata: { orderId: order.id, storeId: order.storeId },
    }

    try {
      const tapRes = await httpPost('https://api.tap.company/v2/charges', chargeBody, {
        Authorization: `Bearer ${settings.tapSecretKey}`,
      })

      if (!tapRes?.id) {
        return reply.status(502).send({ error: 'خطأ من Tap Payments', details: tapRes })
      }

      // Store gatewayRef in Payment record
      await prisma.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: 'TAP_PAYMENTS',
          amount: order.total,
          currency,
          status: 'PENDING',
          gatewayRef: tapRes.id,
        },
        update: {
          gatewayRef: tapRes.id,
          status: 'PENDING',
        },
      })

      return reply.send({
        chargeId: tapRes.id,
        redirectUrl: tapRes.transaction?.url ?? tapRes.redirect?.url ?? '',
      })
    } catch (err) {
      app.log.error(err)
      return reply.status(502).send({ error: 'تعذر الاتصال بـ Tap Payments' })
    }
  })

  /**
   * POST /payment/tap/webhook
   * Tap posts charge updates here.
   */
  app.post('/tap/webhook', async (request, reply) => {
    const body = request.body as any
    const chargeId = body?.id ?? body?.object?.id
    if (!chargeId) return reply.status(400).send({ error: 'missing charge id' })

    const payment = await prisma.payment.findFirst({
      where: { gatewayRef: chargeId },
      include: { order: true },
    })
    if (!payment) return reply.send({ ok: true })

    const tapStatus: string = (body?.status ?? body?.object?.status ?? '').toUpperCase()
    const newPayStatus = tapStatus === 'CAPTURED' ? 'PAID' : tapStatus === 'DECLINED' ? 'FAILED' : null

    if (newPayStatus) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newPayStatus as any,
          gatewayResponse: body,
          paidAt: newPayStatus === 'PAID' ? new Date() : undefined,
        },
      })
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: newPayStatus as any,
          status: newPayStatus === 'PAID' ? 'CONFIRMED' : payment.order.status,
          paidAt: newPayStatus === 'PAID' ? new Date() : undefined,
        },
      })
    }

    return reply.send({ ok: true })
  })

  /**
   * GET /payment/tap/verify?chargeId=chg_xxx&orderId=xxx
   * Verify a Tap charge after redirect (called by storefront callback page).
   */
  app.get('/tap/verify', async (request, reply) => {
    const { chargeId, orderId } = request.query as { chargeId: string; orderId: string }

    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.tapSecretKey) return reply.status(400).send({ error: 'Tap غير مفعّل' })

    try {
      const tapRes = await httpGet(`https://api.tap.company/v2/charges/${chargeId}`, {
        Authorization: `Bearer ${settings.tapSecretKey}`,
      })

      const tapStatus: string = (tapRes?.status ?? '').toUpperCase()
      const newPayStatus = tapStatus === 'CAPTURED' ? 'PAID' : tapStatus === 'DECLINED' ? 'FAILED' : 'PENDING'

      await prisma.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: 'TAP_PAYMENTS',
          amount: order.total,
          currency: order.store.currency,
          status: newPayStatus as any,
          gatewayRef: chargeId,
          gatewayResponse: tapRes,
          paidAt: newPayStatus === 'PAID' ? new Date() : undefined,
        },
        update: {
          status: newPayStatus as any,
          gatewayRef: chargeId,
          gatewayResponse: tapRes,
          paidAt: newPayStatus === 'PAID' ? new Date() : undefined,
        },
      })

      if (newPayStatus === 'PAID') {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID', status: 'CONFIRMED', paidAt: new Date() },
        })
      }

      return reply.send({ status: newPayStatus, orderNumber: order.orderNumber })
    } catch (err) {
      app.log.error(err)
      return reply.status(502).send({ error: 'تعذر التحقق من Tap' })
    }
  })

  // ─────────────────────────────────────────────────────────────────
  // MOYASAR
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /payment/moyasar/charge
   * Create a Moyasar payment and return the redirect URL.
   */
  app.post('/moyasar/charge', async (request, reply) => {
    const { orderId, storeId, successUrl, backUrl } = request.body as {
      orderId: string
      storeId: string
      successUrl: string
      backUrl: string
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: true,
        store: { include: { settings: true } },
      },
    })

    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.moyasarEnabled || !settings.moyasarSecretKey) {
      return reply.status(400).send({ error: 'بوابة Moyasar غير مفعّلة لهذا المتجر' })
    }

    // Moyasar uses amount in smallest currency unit (halalas/fils)
    const amountInFils = Math.round(Number(order.total) * 1000)
    const currency = order.store.currency
    const auth = Buffer.from(`${settings.moyasarSecretKey}:`).toString('base64')

    const paymentBody = {
      amount: amountInFils,
      currency,
      description: `طلب #${order.orderNumber}`,
      source: { type: 'creditcard' },
      callback_url: successUrl,
      metadata: { orderId: order.id, storeId: order.storeId },
    }

    try {
      const moyasarRes = await httpPost('https://api.moyasar.com/v1/payments', paymentBody, {
        Authorization: `Basic ${auth}`,
      })

      if (!moyasarRes?.id) {
        return reply.status(502).send({ error: 'خطأ من Moyasar', details: moyasarRes })
      }

      await prisma.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: 'MOYASAR',
          amount: order.total,
          currency,
          status: 'PENDING',
          gatewayRef: moyasarRes.id,
        },
        update: {
          gatewayRef: moyasarRes.id,
          status: 'PENDING',
        },
      })

      // Moyasar returns redirect URL in source.transaction_url
      const redirectUrl = moyasarRes?.source?.transaction_url ?? ''
      return reply.send({ paymentId: moyasarRes.id, redirectUrl })
    } catch (err) {
      app.log.error(err)
      return reply.status(502).send({ error: 'تعذر الاتصال بـ Moyasar' })
    }
  })

  /**
   * GET /payment/moyasar/verify?id=xxx&orderId=xxx
   * Moyasar redirects to callback_url with ?id=xxx&status=paid
   */
  app.get('/moyasar/verify', async (request, reply) => {
    const { id: paymentId, orderId } = request.query as { id: string; orderId: string }

    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: { store: { include: { settings: true } } },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.moyasarSecretKey) return reply.status(400).send({ error: 'Moyasar غير مفعّل' })

    const auth = Buffer.from(`${settings.moyasarSecretKey}:`).toString('base64')
    try {
      const moyasarRes = await httpGet(`https://api.moyasar.com/v1/payments/${paymentId}`, {
        Authorization: `Basic ${auth}`,
      })

      const status: string = (moyasarRes?.status ?? '').toLowerCase()
      const newPayStatus = status === 'paid' ? 'PAID' : status === 'failed' ? 'FAILED' : 'PENDING'

      await prisma.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: 'MOYASAR',
          amount: order.total,
          currency: order.store.currency,
          status: newPayStatus as any,
          gatewayRef: paymentId,
          gatewayResponse: moyasarRes,
          paidAt: newPayStatus === 'PAID' ? new Date() : undefined,
        },
        update: {
          status: newPayStatus as any,
          gatewayRef: paymentId,
          gatewayResponse: moyasarRes,
          paidAt: newPayStatus === 'PAID' ? new Date() : undefined,
        },
      })

      if (newPayStatus === 'PAID') {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID', status: 'CONFIRMED', paidAt: new Date() },
        })
      }

      return reply.send({ status: newPayStatus, orderNumber: order.orderNumber })
    } catch (err) {
      app.log.error(err)
      return reply.status(502).send({ error: 'تعذر التحقق من Moyasar' })
    }
  })

  // ─────────────────────────────────────────────────────────────────
  // GENERIC: Get payment status for an order
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /payment/:orderId/status
   * Returns the current payment status for an order (merchant use).
   */
  app.get('/:orderId/status', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string }
    const merchantId = (request.user as any).id

    const order = await prisma.order.findFirst({
      where: { id: orderId, store: { merchantId } },
      include: { payment: true },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    return reply.send({
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      payment: order.payment ?? null,
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // TABBY (BNPL – اشتري الآن وادفع لاحقاً)
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /payment/tabby/create-session
   * Creates a Tabby checkout session.
   * Body: { orderId, storeId, returnUrl, cancelUrl }
   */
  app.post('/tabby/create-session', async (request, reply) => {
    const { orderId, storeId, returnUrl, cancelUrl } = request.body as any

    const [order, settings] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, storeId },
        include: { customer: true, items: { include: { product: true } }, store: true, address: true },
      }),
      prisma.storeSettings.findUnique({ where: { storeId } }),
    ])

    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (!settings?.tabbyEnabled || !settings.tabbyPublicKey) {
      return reply.status(400).send({ error: 'Tabby is not enabled for this store' })
    }

    const payload = {
      payment: {
        amount: Number(order.total).toFixed(2),
        currency: order.store.currency || 'BHD',
        description: `Order #${order.orderNumber}`,
        buyer: {
          phone: order.customer?.phone ?? '',
          email: order.customer?.email ?? '',
          name: order.customer?.firstName + ' ' + (order.customer?.lastName ?? ''),
          dob: null,
        },
        buyer_history: { registered_since: order.customer?.createdAt?.toISOString() ?? new Date().toISOString(), loyalty_level: 0, wishlist_count: 0, is_social_networks_connected: false, is_phone_number_verified: false, is_email_verified: false },
        order: {
        tax_amount: Number(order.vatAmount ?? 0).toFixed(2),
          shipping_amount: Number(order.shippingCost ?? 0).toFixed(2),
          discount_amount: '0.00',
          updated_at: order.updatedAt.toISOString(),
          reference_id: order.orderNumber,
          items: order.items.map(i => ({
            title: i.product?.name ?? '',
            description: i.product?.description ?? '',
            id: i.productId,
            category: 'other',
            quantity: i.quantity,
            unit_price: Number(i.price).toFixed(2),
            discount_amount: '0.00',
            reference_id: i.id,
            image_url: null,
            product_url: null,
            gender: null,
            color: null,
            product_material: null,
            size_type: null,
            size: null,
            brand: null,
          })),
        },
        shipping_address: {
          city: order.address?.city ?? '',
          address: [order.address?.block, order.address?.road, order.address?.building].filter(Boolean).join(', '),
          zip: '',
        },
        meta: { order_id: order.id, customer: order.customer?.id },
      },
      lang: 'ar',
      merchant_code: settings.tabbyPublicKey,
      merchant_urls: {
        success: returnUrl ?? `${process.env.STOREFRONT_URL ?? ''}/checkout/success`,
        cancel: cancelUrl ?? `${process.env.STOREFRONT_URL ?? ''}/checkout/cancel`,
        failure: cancelUrl ?? `${process.env.STOREFRONT_URL ?? ''}/checkout/cancel`,
      },
    }

    try {
      const tabbyRes = await httpPost('https://api.tabby.ai/api/v2/checkout', payload, {
        Authorization: `Bearer ${settings.tabbySecretKey}`,
      })
      return reply.send(tabbyRes)
    } catch (err) {
      app.log.error(err)
      return reply.status(502).send({ error: 'Tabby request failed' })
    }
  })

  // ─────────────────────────────────────────────────────────────────
  // TAMARA (BNPL – اشتري الآن وادفع لاحقاً)
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /payment/tamara/create-order
   * Creates a Tamara checkout order.
   * Body: { orderId, storeId, returnUrl, cancelUrl }
   */
  app.post('/tamara/create-order', async (request, reply) => {
    const { orderId, storeId, returnUrl, cancelUrl } = request.body as any

    const [order, settings] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, storeId },
        include: { customer: true, items: { include: { product: true } }, store: true, address: true },
      }),
      prisma.storeSettings.findUnique({ where: { storeId } }),
    ])

    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (!settings?.tamaraEnabled || !settings.tamaraToken) {
      return reply.status(400).send({ error: 'Tamara is not enabled for this store' })
    }

    const payload = {
      order_reference_id: order.orderNumber,
      order_number: order.orderNumber,
      total_amount: { amount: Number(order.total).toFixed(2), currency: order.store.currency || 'BHD' },
      description: `Order #${order.orderNumber}`,
      country_code: 'BH',
      payment_type: 'PAY_BY_INSTALMENTS',
      instalments: 3,
      locale: 'ar_SA',
      items: order.items.map(i => ({
        reference_id: i.id,
        type: 'Digital',
        name: i.product?.name ?? '',
        sku: i.product?.sku ?? '',
        quantity: i.quantity,
        unit_price: { amount: Number(i.price).toFixed(2), currency: order.store.currency || 'BHD' },
        discount_amount: { amount: '0.00', currency: order.store.currency || 'BHD' },
        tax_amount: { amount: '0.00', currency: order.store.currency || 'BHD' },
        total_amount: { amount: (Number(i.price) * i.quantity).toFixed(2), currency: order.store.currency || 'BHD' },
        image_url: '',
        product_url: '',
      })),
      consumer: {
        first_name: order.customer?.firstName ?? '',
        last_name: order.customer?.lastName ?? '',
        phone_number: order.customer?.phone ?? '',
        email: order.customer?.email ?? '',
      },
      billing_address: {
        first_name: order.customer?.firstName ?? '',
        last_name: order.customer?.lastName ?? '',
        line1: [order.address?.block, order.address?.road, order.address?.building].filter(Boolean).join(', '),
        city: order.address?.city ?? '',
        country_code: 'BH',
        phone_number: order.customer?.phone ?? '',
      },
      shipping_address: {
        first_name: order.customer?.firstName ?? '',
        last_name: order.customer?.lastName ?? '',
        line1: [order.address?.block, order.address?.road, order.address?.building].filter(Boolean).join(', '),
        city: order.address?.city ?? '',
        country_code: 'BH',
        phone_number: order.customer?.phone ?? '',
      },
      discount: { amount: { amount: '0.00', currency: order.store.currency || 'BHD' }, name: '' },
      tax_amount: { amount: Number(order.vatAmount ?? 0).toFixed(2), currency: order.store.currency || 'BHD' },
      shipping_amount: { amount: Number(order.shippingCost ?? 0).toFixed(2), currency: order.store.currency || 'BHD' },
      merchant_url: {
        success: returnUrl ?? `${process.env.STOREFRONT_URL ?? ''}/checkout/success`,
        failure: cancelUrl ?? `${process.env.STOREFRONT_URL ?? ''}/checkout/cancel`,
        cancel: cancelUrl ?? `${process.env.STOREFRONT_URL ?? ''}/checkout/cancel`,
        notification: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/api/v1/payment/tamara/webhook`,
      },
      platform: 'others',
    }

    try {
      const tamaraRes = await httpPost('https://api.tamara.co/checkout', payload, {
        Authorization: `Bearer ${settings.tamaraToken}`,
      })
      return reply.send(tamaraRes)
    } catch (err) {
      app.log.error(err)
      return reply.status(502).send({ error: 'Tamara request failed' })
    }
  })

  // Tamara webhook
  app.post('/tamara/webhook', async (request, reply) => {
    const { order_id, order_status } = request.body as any
    if (!order_id) return reply.send({ ok: true })

    const order = await prisma.order.findFirst({ where: { orderNumber: order_id } })
    if (!order) return reply.send({ ok: true })

    if (order_status === 'approved') {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', status: 'CONFIRMED', paidAt: new Date() },
      })
    }
    return reply.send({ ok: true })
  })
}
