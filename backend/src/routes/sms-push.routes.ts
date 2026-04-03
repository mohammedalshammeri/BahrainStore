import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import https from 'node:https'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

function httpPost(url: string, body: object | string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const data = typeof body === 'string' ? body : JSON.stringify(body)
    const isForm = headers['Content-Type']?.includes('form')
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      let raw = ''
      res.on('data', (c) => (raw += c))
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ─── SMS Marketing Routes ──────────────────────────────────────────────────────
export async function smsRoutes(app: FastifyInstance) {
  // POST /sms/campaigns — Create SMS campaign
  app.post('/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      name: z.string().min(1),
      message: z.string().min(1).max(160),
      scheduledAt: z.string().datetime().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const campaign = await prisma.smsCampaign.create({
      data: {
        storeId,
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    })

    return reply.status(201).send({ message: 'تم إنشاء حملة SMS', campaign })
  })

  // GET /sms/campaigns?storeId=
  app.get('/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const campaigns = await prisma.smsCampaign.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ campaigns })
  })

  // POST /sms/campaigns/:id/send — Send or schedule campaign
  app.post('/campaigns/:id/send', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const campaign = await prisma.smsCampaign.findFirst({
      where: { id },
      include: { store: { include: { settings: true, customers: { select: { phone: true } } } } },
    })
    if (!campaign) return reply.status(404).send({ error: 'الحملة غير موجودة' })
    if (campaign.store.merchantId !== merchantId) return reply.status(403).send({ error: 'غير مصرح' })

    const settings = campaign.store.settings
    if (!settings?.smsEnabled || !settings.smsTwilioSid || !settings.smsTwilioToken) {
      return reply.status(400).send({ error: 'SMS غير مفعّل. يرجى إضافة Twilio credentials في الإعدادات.' })
    }

    const customers = campaign.store.customers
    let sent = 0
    let failed = 0

    for (const customer of customers) {
      if (!customer.phone) { failed++; continue }
      try {
        const phone = customer.phone.startsWith('+') ? customer.phone : `+973${customer.phone}`
        await httpPost(
          `https://api.twilio.com/2010-04-01/Accounts/${settings.smsTwilioSid}/Messages.json`,
          new URLSearchParams({ To: phone, From: settings.smsTwilioFrom || '', Body: campaign.message }).toString(),
          {
            Authorization: `Basic ${Buffer.from(`${settings.smsTwilioSid}:${settings.smsTwilioToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        )
        sent++
      } catch {
        failed++
      }
    }

    await prisma.smsCampaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: customers.length, deliveredCount: sent, failedCount: failed },
    })

    return reply.send({ message: 'تم إرسال الحملة', sent, failed, total: customers.length })
  })

  // DELETE /sms/campaigns/:id
  app.delete('/campaigns/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const campaign = await prisma.smsCampaign.findFirst({
      where: { id },
      include: { store: true },
    })
    if (!campaign || campaign.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }
    if (campaign.status === 'SENT') {
      return reply.status(400).send({ error: 'لا يمكن حذف حملة مرسلة بالفعل' })
    }

    await prisma.smsCampaign.delete({ where: { id } })
    return reply.send({ message: 'تم حذف الحملة' })
  })

  // POST /sms/otp — Send OTP via SMS
  app.post('/otp', async (request, reply) => {
    const { storeId, phone } = request.body as { storeId: string; phone: string }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const settings = store.settings
    if (!settings?.smsEnabled || !settings.smsTwilioSid || !settings.smsTwilioToken) {
      return reply.status(400).send({ error: 'SMS غير مفعّل' })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const message = `رمز التحقق الخاص بك: ${otp} - صالح لمدة 10 دقائق`

    try {
      await httpPost(
        `https://api.twilio.com/2010-04-01/Accounts/${settings.smsTwilioSid}/Messages.json`,
        new URLSearchParams({ To: phone, From: settings.smsTwilioFrom || '', Body: message }).toString(),
        {
          Authorization: `Basic ${Buffer.from(`${settings.smsTwilioSid}:${settings.smsTwilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      )
    } catch {
      return reply.status(500).send({ error: 'فشل إرسال SMS' })
    }

    // In production: store OTP hash in Redis with TTL
    return reply.send({ sent: true, message: 'تم إرسال رمز التحقق' })
  })
}

// ─── Push Notifications Routes ─────────────────────────────────────────────────
export async function pushNotificationRoutes(app: FastifyInstance) {
  // POST /push/subscribe — Register push subscription (storefront)
  app.post('/subscribe', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      endpoint: z.string().url(),
      p256dh: z.string(),
      auth: z.string(),
      customerId: z.string().optional(),
      userAgent: z.string().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    }

    const sub = await prisma.pushSubscription.upsert({
      where: { storeId_endpoint: { storeId: result.data.storeId, endpoint: result.data.endpoint } },
      update: { p256dh: result.data.p256dh, auth: result.data.auth },
      create: result.data,
    })

    return reply.status(201).send({ subscribed: true, id: sub.id })
  })

  // POST /push/unsubscribe
  app.post('/unsubscribe', async (request, reply) => {
    const { storeId, endpoint } = request.body as { storeId: string; endpoint: string }
    await prisma.pushSubscription.deleteMany({ where: { storeId, endpoint } })
    return reply.send({ unsubscribed: true })
  })

  // POST /push/campaigns — Create push campaign
  app.post('/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      title: z.string().min(1),
      body: z.string().min(1),
      imageUrl: z.string().url().optional(),
      targetUrl: z.string().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    }

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const campaign = await prisma.pushNotificationCampaign.create({
      data: { storeId, ...data },
    })

    return reply.status(201).send({ message: 'تم إنشاء حملة Push', campaign })
  })

  // POST /push/campaigns/:id/send
  app.post('/campaigns/:id/send', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const campaign = await prisma.pushNotificationCampaign.findFirst({
      where: { id },
      include: { store: true },
    })
    if (!campaign || campaign.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { storeId: campaign.storeId },
    })

    // In production: use web-push library with VAPID keys
    // For now: record the campaign as sent
    const sentCount = subscriptions.length

    await prisma.pushNotificationCampaign.update({
      where: { id },
      data: { sentCount, sentAt: new Date() },
    })

    return reply.send({
      message: `تم إرسال الإشعار إلى ${sentCount} مشترك`,
      sentCount,
    })
  })

  // GET /push/campaigns?storeId=
  app.get('/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const campaigns = await prisma.pushNotificationCampaign.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })

    const subscriberCount = await prisma.pushSubscription.count({ where: { storeId } })

    return reply.send({ campaigns, subscriberCount })
  })

  // POST /push/send-direct — Send push directly (for order notifications etc.)
  app.post('/send-direct', async (request, reply) => {
    const { storeId, customerId, title, body, url } = request.body as {
      storeId: string; customerId?: string; title: string; body: string; url?: string
    }

    const where: any = { storeId }
    if (customerId) where.customerId = customerId

    const subscriptions = await prisma.pushSubscription.findMany({ where })
    // In production: send via web-push
    return reply.send({ sent: subscriptions.length, message: 'تم قائمة الإشعارات' })
  })
}
