import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'node:crypto'

// ─── Live Commerce (البث المباشر) Routes ──────────────────────────────────────

function getPlatformHint(platform: string): string {
  switch (platform) {
    case 'YOUTUBE':
      return 'ابدأ البث على YouTube Studio ثم الصق رابط التضمين (embed) أدناه ليظهر في متجرك.'
    case 'TIKTOK':
      return 'ابدأ البث المباشر على TikTok ثم الصق رابط تضمين TikTok Live في متجرك.'
    case 'INSTAGRAM':
      return 'ابدأ البث على Instagram Live. يمكن لزوار متجرك الانضمام عبر رابط ملفك الشخصي.'
    default:
      return 'انسخ رابط RTMP وأضفه في OBS أو أي برنامج بث.'
  }
}

export async function liveCommerceRoutes(app: FastifyInstance) {
  // POST /live-commerce/streams — Create a live stream
  // platform: YOUTUBE | TIKTOK | INSTAGRAM | CUSTOM
  // embedUrl: the iframe embed URL (YouTube/TikTok) OR null for CUSTOM
  app.post('/streams', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      title: z.string().min(1),
      titleAr: z.string().optional(),
      description: z.string().optional(),
      scheduledAt: z.string().datetime().optional(),
      thumbnailUrl: z.string().url().optional(),
      platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'CUSTOM']).default('CUSTOM'),
      embedUrl: z.string().url().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, embedUrl, platform, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const streamKey = crypto.randomBytes(16).toString('hex')

    const stream = await prisma.liveStream.create({
      data: {
        storeId,
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        streamKey,
        platform,
        embedUrl: embedUrl ?? null,
        status: 'SCHEDULED',
      } as any, // platform & embedUrl added via migration 20260403120000
    })

    // For CUSTOM, return our RTMP URL. For social platforms the merchant streams
    // directly to TikTok/YouTube/Instagram — we only embed their stream.
    const response: any = { message: 'تم إنشاء البث المباشر', stream }
    if (platform === 'CUSTOM') {
      response.rtmpUrl = `rtmp://live.bazar.bh/live/${streamKey}`
      response.hint = 'انسخ رابط RTMP وأضفه في OBS أو أي برنامج بث.'
    } else {
      response.hint = getPlatformHint(platform)
    }

    return reply.status(201).send(response)
  })

  // GET /live-commerce/streams?storeId=
  app.get('/streams', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const streams = await prisma.liveStream.findMany({
      where: { storeId },
      include: {
        _count: { select: { products: true, chatMessages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ streams })
  })

  // GET /live-commerce/streams/public/:storeSlug — Public streams for storefront
  app.get('/streams/public/:storeSlug', async (request, reply) => {
    const { storeSlug } = request.params as { storeSlug: string }
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const streams = await prisma.liveStream.findMany({
      where: { storeId: store.id, status: { in: ['LIVE', 'SCHEDULED'] } },
      include: {
        products: { include: { product: { select: { name: true, nameAr: true, price: true, images: { take: 1 } } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    return reply.send({ streams })
  })

  // PATCH /live-commerce/streams/:id/start — Start stream
  app.patch('/streams/:id/start', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const stream = await prisma.liveStream.findFirst({
      where: { id },
      include: { store: true },
    })
    if (!stream || stream.store.merchantId !== merchantId) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.liveStream.update({ where: { id }, data: { status: 'LIVE', startedAt: new Date() } })
    return reply.send({ message: 'بدأ البث المباشر 🔴' })
  })

  // PATCH /live-commerce/streams/:id/end — End stream
  app.patch('/streams/:id/end', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const stream = await prisma.liveStream.findFirst({
      where: { id },
      include: { store: true },
    })
    if (!stream || stream.store.merchantId !== merchantId) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.liveStream.update({ where: { id }, data: { status: 'ENDED', endedAt: new Date() } })
    return reply.send({ message: 'انتهى البث المباشر' })
  })

  // POST /live-commerce/streams/:id/products — Add product to stream
  app.post('/streams/:id/products', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { productId } = request.body as { productId: string }

    const stream = await prisma.liveStream.findUnique({ where: { id }, include: { store: true } })
    const merchantId = (request.user as any).id
    if (!stream || stream.store.merchantId !== merchantId) return reply.status(403).send({ error: 'غير مصرح' })

    const item = await prisma.liveStreamProduct.upsert({
      where: { streamId_productId: { streamId: id, productId } },
      update: {},
      create: { streamId: id, productId },
    })

    return reply.status(201).send({ message: 'تمت إضافة المنتج للبث', item })
  })

  // DELETE /live-commerce/streams/:id/products/:productId — Remove product
  app.delete('/streams/:id/products/:productId', { preHandler: authenticate }, async (request, reply) => {
    const { id, productId } = request.params as { id: string; productId: string }
    await prisma.liveStreamProduct.deleteMany({ where: { streamId: id, productId } })
    return reply.send({ message: 'تم إزالة المنتج من البث' })
  })

  // POST /live-commerce/streams/:id/chat — Send chat message (storefront viewers)
  app.post('/streams/:id/chat', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { senderName, senderId, message } = request.body as {
      senderName: string; senderId?: string; message: string
    }

    if (!senderName || !message) return reply.status(400).send({ error: 'الاسم والرسالة مطلوبان' })
    if (message.length > 200) return reply.status(400).send({ error: 'الرسالة طويلة جداً' })

    const stream = await prisma.liveStream.findFirst({ where: { id, status: 'LIVE' } })
    if (!stream) return reply.status(400).send({ error: 'البث غير متاح حالياً' })

    const msg = await prisma.liveChatMessage.create({
      data: { streamId: id, senderName, senderId, message },
    })

    // Update viewer count
    await prisma.liveStream.update({ where: { id }, data: { viewerCount: { increment: 1 } } })

    return reply.status(201).send({ msg })
  })

  // GET /live-commerce/streams/:id/chat — Get recent chat messages
  app.get('/streams/:id/chat', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { since } = request.query as { since?: string }

    const where: any = { streamId: id, isHidden: false }
    if (since) where.createdAt = { gt: new Date(since) }

    const messages = await prisma.liveChatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return reply.send({ messages })
  })

  // DELETE /live-commerce/chat/:msgId — Hide message (mod action)
  app.delete('/chat/:msgId', { preHandler: authenticate }, async (request, reply) => {
    const { msgId } = request.params as { msgId: string }
    await prisma.liveChatMessage.update({ where: { id: msgId }, data: { isHidden: true } })
    return reply.send({ message: 'تم إخفاء الرسالة' })
  })
}

// ─── Live Chat Support Routes ──────────────────────────────────────────────────

export async function liveChatSupportRoutes(app: FastifyInstance) {
  // POST /live-chat/sessions — Start chat session (storefront visitor)
  app.post('/sessions', async (request, reply) => {
    const { storeId, visitorId, visitorName, visitorEmail } = request.body as {
      storeId: string; visitorId: string; visitorName?: string; visitorEmail?: string
    }

    if (!storeId || !visitorId) return reply.status(400).send({ error: 'storeId و visitorId مطلوبان' })

    // Reuse existing waiting/active session
    const existing = await prisma.liveChatSession.findFirst({
      where: { storeId, visitorId, status: { in: ['WAITING', 'ACTIVE'] } },
    })

    if (existing) return reply.send({ session: existing })

    const session = await prisma.liveChatSession.create({
      data: { storeId, visitorId, visitorName, visitorEmail, status: 'WAITING' },
    })

    return reply.status(201).send({ session })
  })

  // GET /live-chat/sessions?storeId= — Merchant view: all sessions
  app.get('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, status } = request.query as { storeId: string; status?: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const where: any = { storeId }
    if (status) where.status = status

    const sessions = await prisma.liveChatSession.findMany({
      where,
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    })

    return reply.send({ sessions })
  })

  // POST /live-chat/sessions/:id/messages — Send message
  app.post('/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { senderType, senderId, message, fileUrl } = request.body as {
      senderType: 'VISITOR' | 'STAFF'; senderId?: string; message: string; fileUrl?: string
    }

    const session = await prisma.liveChatSession.findUnique({ where: { id } })
    if (!session || session.status === 'CLOSED') {
      return reply.status(400).send({ error: 'الجلسة غير متاحة' })
    }

    const msg = await prisma.liveChatSupportMessage.create({
      data: { sessionId: id, senderType, senderId, message, fileUrl },
    })

    // Update session status to ACTIVE when staff replies
    if (senderType === 'STAFF' && session.status === 'WAITING') {
      await prisma.liveChatSession.update({ where: { id }, data: { status: 'ACTIVE', assignedTo: senderId } })
    }

    return reply.status(201).send({ message: msg })
  })

  // GET /live-chat/sessions/:id/messages — Get messages
  app.get('/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { since } = request.query as { since?: string }

    const where: any = { sessionId: id }
    if (since) where.createdAt = { gt: new Date(since) }

    const messages = await prisma.liveChatSupportMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return reply.send({ messages })
  })

  // PATCH /live-chat/sessions/:id/close — Close session
  app.patch('/sessions/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rating } = request.body as { rating?: number }

    await prisma.liveChatSession.update({
      where: { id },
      data: { status: 'CLOSED', endedAt: new Date(), rating },
    })

    return reply.send({ message: 'تم إغلاق المحادثة' })
  })
}
