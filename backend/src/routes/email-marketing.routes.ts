import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function emailMarketingRoutes(fastify: FastifyInstance) {
  // ── CAMPAIGNS ──────────────────────────────────────────────────

  // GET all campaigns
  fastify.get('/email-marketing/campaigns', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

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

    const campaign = await prisma.emailCampaign.update({
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
    return campaign
  })

  // DELETE campaign
  fastify.delete('/email-marketing/campaigns/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.emailCampaign.delete({ where: { id } })
    return { success: true }
  })

  // POST send campaign now (simulated – marks as SENT, updates recipientCount)
  fastify.post('/email-marketing/campaigns/:id/send', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' })
    if (campaign.status === 'SENT') return reply.code(400).send({ error: 'Already sent' })

    // Count active subscribers
    const count = await prisma.emailSubscriber.count({
      where: { storeId: campaign.storeId, isActive: true },
    })

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: count },
    })
    return updated
  })

  // ── SUBSCRIBERS ─────────────────────────────────────────────────

  // GET all subscribers
  fastify.get('/email-marketing/subscribers', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, page = '1', limit = '50', active } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

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
