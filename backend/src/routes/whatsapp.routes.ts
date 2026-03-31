import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ── WhatsApp Cloud API helper ──────────────────
async function sendWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
): Promise<boolean> {
  try {
    const phone = to.replace(/\D/g, '')
    const fullPhone = phone.startsWith('973') ? phone : `973${phone}`
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'text',
          text: { body: message },
        }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

// ── Message templates ──────────────────────────
function orderConfirmationMsg(storeName: string, orderNumber: string, total: string, currency: string) {
  return `✅ تم استلام طلبك — ${storeName}

🧾 رقم الطلب: *${orderNumber}*
💰 الإجمالي: *${total} ${currency}*

سيتم التواصل معك لتأكيد الشحن. شكراً لتسوقك معنا! 🛍️`
}

function orderShippedMsg(storeName: string, orderNumber: string, trackingNumber: string, company: string) {
  return `🚚 طلبك في الطريق إليك — ${storeName}

📦 رقم الطلب: *${orderNumber}*
🚢 شركة الشحن: *${company}*
🔍 رقم التتبع: *${trackingNumber}*

يمكنك تتبع شحنتك عبر موقع شركة الشحن. شكراً! 📦`
}

function abandonedCartMsg(storeName: string, customerName: string, storefrontUrl: string, itemCount: number) {
  return `👋 مرحباً *${customerName}*!

نسيت شيئاً في سلة الـ ${storeName}؟ 🛒

لديك *${itemCount} منتج* في سلتك بانتظارك.

🔗 أكمل طلبك الآن: ${storefrontUrl}/cart

*احجز قبل نفاد الكمية!* ⚡`
}

function orderDeliveredMsg(storeName: string, orderNumber: string) {
  return `🎉 تم توصيل طلبك بنجاح — ${storeName}

📦 رقم الطلب: *${orderNumber}*

نتمنى أن يعجبك ما اشتريته! إذا كان لديك أي استفسار نحن هنا لمساعدتك. ❤️`
}

export async function whatsappRoutes(app: FastifyInstance) {
  // ── Send Order Confirmation ────────────────────
  // POST /whatsapp/order-confirmed (internal, called after order creation)
  app.post('/order-confirmed', async (request, reply) => {
    const schema = z.object({
      orderId: z.string().cuid(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const { orderId } = result.data

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, name: true, nameAr: true, currency: true, settings: true } },
        customer: { select: { phone: true, firstName: true } },
      },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const settings = order.store.settings
    if (!settings?.whatsappEnabled || !settings.whatsappPhoneId || !settings.whatsappToken) {
      return reply.send({ message: 'WhatsApp غير مفعّل', sent: false })
    }

    const msg = orderConfirmationMsg(
      order.store.nameAr || order.store.name,
      order.orderNumber,
      Number(order.total).toFixed(3),
      order.store.currency
    )

    const sent = await sendWhatsAppMessage(
      settings.whatsappPhoneId,
      settings.whatsappToken,
      order.customer.phone,
      msg
    )

    return reply.send({ sent, to: order.customer.phone })
  })

  // ── Send Shipping Update ───────────────────────
  app.post('/order-shipped', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string().cuid(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { orderId } = result.data

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, name: true, nameAr: true, merchantId: true, settings: true } },
        customer: { select: { phone: true } },
      },
    })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const settings = order.store.settings
    if (!settings?.whatsappEnabled || !settings.whatsappPhoneId || !settings.whatsappToken) {
      return reply.send({ message: 'WhatsApp غير مفعّل', sent: false })
    }
    if (!order.trackingNumber) {
      return reply.status(400).send({ error: 'لا يوجد رقم تتبع' })
    }

    const msg = orderShippedMsg(
      order.store.nameAr || order.store.name,
      order.orderNumber,
      order.trackingNumber,
      order.shippingCompany ?? 'الشركة'
    )

    const sent = await sendWhatsAppMessage(
      settings.whatsappPhoneId,
      settings.whatsappToken,
      order.customer.phone,
      msg
    )

    return reply.send({ sent })
  })

  // ── Send Delivery Confirmation ─────────────────
  app.post('/order-delivered', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ orderId: z.string().cuid() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { orderId } = result.data

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { name: true, nameAr: true, merchantId: true, settings: true } },
        customer: { select: { phone: true } },
      },
    })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'غير مصرح' })
    }

    const settings = order.store.settings
    if (!settings?.whatsappEnabled || !settings.whatsappPhoneId || !settings.whatsappToken) {
      return reply.send({ message: 'WhatsApp غير مفعّل', sent: false })
    }

    const msg = orderDeliveredMsg(order.store.nameAr || order.store.name, order.orderNumber)
    const sent = await sendWhatsAppMessage(settings.whatsappPhoneId, settings.whatsappToken, order.customer.phone, msg)
    return reply.send({ sent })
  })

  // ── Abandoned Cart Recovery ────────────────────
  // POST /whatsapp/recover-carts — process due carts for a store
  app.post('/recover-carts', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      hoursAgo: z.number().int().min(1).max(72).default(2),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { storeId, hoursAgo } = result.data

    const store = await prisma.store.findFirst({
      where: { id: storeId, merchantId },
      include: { settings: true },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const settings = store.settings
    if (!settings?.whatsappEnabled || !settings.whatsappPhoneId || !settings.whatsappToken) {
      return reply.status(400).send({ error: 'WhatsApp غير مفعّل' })
    }

    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    const carts = await prisma.abandonedCart.findMany({
      where: {
        storeId,
        reminderSent: false,
        recoveredAt: null,
        createdAt: { lte: cutoff },
        phone: { not: null },
      },
      take: 50,
    })

    const storefrontUrl = `https://${store.subdomain}.bazar.bh`
    let sentCount = 0

    for (const cart of carts) {
      if (!cart.phone) continue
      const cartData = cart.cartData as any[]
      const itemCount = cartData?.length ?? 1
      const firstName = cart.firstName ?? 'عزيزي العميل'

      const msg = abandonedCartMsg(store.nameAr || store.name, firstName, storefrontUrl, itemCount)
      const sent = await sendWhatsAppMessage(settings.whatsappPhoneId, settings.whatsappToken, cart.phone, msg)
      if (sent) {
        sentCount++
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { reminderSent: true, reminderSentAt: new Date() },
        })
      }
    }

    return reply.send({ processed: carts.length, sent: sentCount })
  })

  // ── Save Abandoned Cart (from storefront) ───────
  app.post('/save-cart', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      firstName: z.string().optional(),
      cartData: z.any(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const { storeId, email, phone, firstName, cartData } = result.data
    if (!email && !phone) return reply.status(400).send({ error: 'يجب توفير email أو phone' })

    const cartEmail = email ?? `${phone}@nomail.local`

    await prisma.abandonedCart.upsert({
      where: { storeId_email: { storeId, email: cartEmail } },
      create: { storeId, email: cartEmail, phone, firstName, cartData },
      update: { phone, firstName, cartData, reminderSent: false, reminderSentAt: null },
    })

    return reply.send({ message: 'تم حفظ السلة' })
  })

  // ── Mark Cart Recovered (called when order placed) ─
  app.post('/cart-recovered', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({})

    const { storeId, email, phone } = result.data
    const cartEmail = email ?? `${phone}@nomail.local`

    await prisma.abandonedCart.updateMany({
      where: { storeId, email: cartEmail },
      data: { recoveredAt: new Date() },
    }).catch(() => {})

    return reply.send({ message: 'ok' })
  })

  // ── Get Abandoned Carts (dashboard) ────────────
  app.get('/abandoned-carts', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId, page = '1', limit = '20' } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [carts, total] = await Promise.all([
      prisma.abandonedCart.findMany({
        where: { storeId, recoveredAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.abandonedCart.count({ where: { storeId, recoveredAt: null } }),
    ])

    const recoveredTotal = await prisma.abandonedCart.count({ where: { storeId, recoveredAt: { not: null } } })

    return reply.send({ carts, total, recovered: recoveredTotal, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })
}
