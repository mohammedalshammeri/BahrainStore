import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { sendStoreCampaignEmail } from '../lib/email'
import { findMerchantEmailCampaign, findMerchantEmailSubscriber, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

export async function emailMarketingRoutes(fastify: FastifyInstance) {
  // ── CAMPAIGNS ──────────────────────────────────────────────────

  // GET all campaigns
  fastify.get('/email-marketing/campaigns', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const campaigns = await prisma.emailCampaign.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })
    return campaigns
  })

  // POST create campaign
  fastify.post('/email-marketing/campaigns', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, name, subject, subjectAr, body, bodyAr, scheduledAt } = req.body as any
    if (!storeId || !name) return reply.code(400).send({ error: 'storeId and name required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const campaign = await prisma.emailCampaign.create({
      data: {
        storeId,
        name,
        subject: subject ?? null,
        subjectAr: subjectAr ?? null,
        body: body ?? null,
        bodyAr: bodyAr ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    })
    return reply.code(201).send(campaign)
  })

  // PUT update campaign
  fastify.put('/email-marketing/campaigns/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    const data = req.body as any

    const merchantId = req.user.id
    const campaign = await findMerchantEmailCampaign(merchantId, id)
    if (!campaign) return reply.code(403).send({ error: 'غير مصرح' })

    const updatedCampaign = await prisma.emailCampaign.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject ?? null,
        subjectAr: data.subjectAr ?? null,
        body: data.body ?? null,
        bodyAr: data.bodyAr ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.status ?? undefined,
      },
    })
    return updatedCampaign
  })

  // DELETE campaign
  fastify.delete('/email-marketing/campaigns/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any

    const merchantId = req.user.id
    const campaign = await findMerchantEmailCampaign(merchantId, id)
    if (!campaign) return reply.code(403).send({ error: 'غير مصرح' })

    await prisma.emailCampaign.delete({ where: { id } })
    return { success: true }
  })

  fastify.post('/email-marketing/campaigns/:id/send', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any

    const merchantId = req.user.id
    const campaignAccess = await findMerchantEmailCampaign(merchantId, id)
    if (!campaignAccess) return reply.code(403).send({ error: 'غير مصرح' })

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        storeId: true,
        status: true,
        subject: true,
        subjectAr: true,
        body: true,
        bodyAr: true,
        scheduledAt: true,
      },
    })
    if (!campaign) return reply.code(404).send({ error: 'الحملة غير موجودة' })

    if (campaign.status === 'SENT') return reply.code(400).send({ error: 'Already sent' })

    const storeAccess = await findMerchantStore(merchantId, campaign.storeId)
    if (!storeAccess) return reply.code(403).send({ error: 'غير مصرح' })

    const store = await prisma.store.findUnique({
      where: { id: campaign.storeId },
      select: { id: true, name: true, nameAr: true },
    })
    if (!store) return reply.code(404).send({ error: 'المتجر غير موجود' })

    const subscribers = await prisma.emailSubscriber.findMany({
      where: { storeId: campaign.storeId, isActive: true },
      select: { email: true, firstName: true },
    })

    if (subscribers.length === 0) {
      return reply.code(400).send({ error: 'لا يوجد مشتركون نشطون لإرسال الحملة' })
    }

    const subject = campaign.subjectAr ?? campaign.subject
    const body = campaign.bodyAr ?? campaign.body

    if (!subject || !body) {
      return reply.code(400).send({ error: 'موضوع الحملة ومحتواها مطلوبان قبل الإرسال' })
    }

    await prisma.emailCampaign.update({ where: { id }, data: { status: 'SENDING' } })

    let sent = 0

    try {
      for (const subscriber of subscribers) {
        await sendStoreCampaignEmail({
          to: subscriber.email,
          firstName: subscriber.firstName,
          storeName: store.nameAr ?? store.name,
          subject,
          body,
        })
        sent++
      }
    } catch (error: any) {
      await prisma.emailCampaign.update({
        where: { id },
        data: { status: campaign.scheduledAt ? 'SCHEDULED' : 'DRAFT' },
      })

      if (error?.name === 'EMAIL_NOT_CONFIGURED' || error?.message === 'EMAIL_NOT_CONFIGURED') {
        return reply.code(503).send({ error: 'إرسال البريد غير جاهز حالياً. أضف إعدادات SMTP أولاً.' })
      }

      return reply.code(500).send({ error: 'فشل إرسال الحملة البريدية' })
    }

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: sent },
    })
    return reply.send({ campaign: updated, sent })
  })

  // ── SUBSCRIBERS ─────────────────────────────────────────────────

  // GET all subscribers
  fastify.get('/email-marketing/subscribers', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, page = '1', limit = '50', active } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId }
    if (active !== undefined) where.isActive = active === 'true'

    const [subscribers, total] = await Promise.all([
      prisma.emailSubscriber.findMany({ where, skip, take: parseInt(limit), orderBy: { subscribedAt: 'desc' } }),
      prisma.emailSubscriber.count({ where }),
    ])
    return { subscribers, total, page: parseInt(page), limit: parseInt(limit) }
  })

  // POST subscribe (public endpoint for storefront)
  fastify.post('/email-marketing/public/subscribe', async (req: any, reply) => {
    const { storeId, email, firstName, lastName, source = 'STOREFRONT', tags } = req.body as any
    if (!storeId || !email) return reply.code(400).send({ error: 'storeId and email required' })

    const subscriber = await prisma.emailSubscriber.upsert({
      where: { storeId_email: { storeId, email } },
      update: { isActive: true, unsubscribedAt: null },
      create: {
        storeId,
        email,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        tags: tags ?? [],
        source,
      },
    })
    return reply.code(201).send(subscriber)
  })

  // DELETE / unsubscribe
  fastify.delete('/email-marketing/subscribers/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any

    const merchantId = req.user.id
    const subscriber = await findMerchantEmailSubscriber(merchantId, id)
    if (!subscriber) return reply.code(403).send({ error: 'غير مصرح' })

    await prisma.emailSubscriber.update({
      where: { id },
      data: { isActive: false, unsubscribedAt: new Date() },
    })
    return { success: true }
  })

  // POST public unsubscribe by email token
  fastify.post('/email-marketing/public/unsubscribe', async (req: any, reply) => {
    const { storeId, email } = req.body as any
    if (!storeId || !email) return reply.code(400).send({ error: 'storeId and email required' })

    await prisma.emailSubscriber.updateMany({
      where: { storeId, email },
      data: { isActive: false, unsubscribedAt: new Date() },
    })
    return { success: true }
  })

  // GET stats summary
  fastify.get('/email-marketing/stats', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const merchantId = req.user.id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.code(403).send({ error: 'غير مصرح' })

    const [total, active, campaigns] = await Promise.all([
      prisma.emailSubscriber.count({ where: { storeId } }),
      prisma.emailSubscriber.count({ where: { storeId, isActive: true } }),
      prisma.emailCampaign.findMany({
        where: { storeId, status: 'SENT' },
        select: { recipientCount: true, openCount: true, clickCount: true },
      }),
    ])

    const totalSent = campaigns.reduce((s, c) => s + c.recipientCount, 0)
    const totalOpens = campaigns.reduce((s, c) => s + c.openCount, 0)
    const totalClicks = campaigns.reduce((s, c) => s + c.clickCount, 0)

    return {
      totalSubscribers: total,
      activeSubscribers: active,
      campaignsSent: campaigns.length,
      totalSent,
      avgOpenRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
      avgClickRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
    }
  })
}
