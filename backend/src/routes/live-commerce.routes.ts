import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { findMerchantLiveChatMessage, findMerchantLiveChatSession, findMerchantLiveStream, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'node:crypto'

// ─── Live Commerce (البث المباشر) Routes ──────────────────────────────────────
// Supported platforms: YOUTUBE | TIKTOK | INSTAGRAM
// RTMP is NOT supported — merchants stream directly to social platforms
// and embed the stream URL in their store.

const LIVE_VIEWER_TTL_MS = 45 * 1000

// In-memory viewer presence (single-instance only — accurate within a session)
// Falls back to last-written DB value after a server restart.
const liveViewerPresence = new Map<string, Map<string, number>>()

function getPresenceBucket(streamId: string) {
  let bucket = liveViewerPresence.get(streamId)
  if (!bucket) {
    bucket = new Map<string, number>()
    liveViewerPresence.set(streamId, bucket)
  }
  return bucket
}

function sweepViewers(streamId: string): number | null {
  const bucket = liveViewerPresence.get(streamId)
  if (!bucket) return null // not tracked in memory — caller should use DB value

  const cutoff = Date.now() - LIVE_VIEWER_TTL_MS
  for (const [viewerId, timestamp] of bucket.entries()) {
    if (timestamp < cutoff) bucket.delete(viewerId)
  }

  if (bucket.size === 0) {
    liveViewerPresence.delete(streamId)
    return null
  }

  return bucket.size
}

function registerViewerHeartbeat(streamId: string, viewerId: string) {
  const bucket = getPresenceBucket(streamId)
  bucket.set(viewerId, Date.now())
  return sweepViewers(streamId) ?? 1
}

function clearViewerPresence(streamId: string) {
  liveViewerPresence.delete(streamId)
}

// Returns live viewer count: prefers in-memory (accurate), falls back to DB value.
function attachLiveViewerCount<T extends { id: string; status: string; viewerCount: number }>(stream: T) {
  if (stream.status !== 'LIVE') return stream
  const memCount = sweepViewers(stream.id)
  return {
    ...stream,
    viewerCount: memCount ?? stream.viewerCount, // DB value survives restarts
  }
}

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
      platform: z.enum(['YOUTUBE', 'TIKTOK', 'INSTAGRAM']),
      embedUrl: z.string().url('يجب أن يكون رابط تضمين صحيح').optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchantId = (request.user as any).id
    const { storeId, embedUrl, platform, ...data } = result.data

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    if ((platform === 'YOUTUBE' || platform === 'TIKTOK') && !embedUrl) {
      return reply.status(400).send({ error: 'embedUrl مطلوب لمنصات YouTube و TikTok' })
    }

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
      } as any,
    })

    return reply.status(201).send({
      message: 'تم إنشاء البث المباشر',
      stream,
      hint: getPlatformHint(platform),
    })
  })

  // GET /live-commerce/streams?storeId=
  app.get('/streams', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const streams = await prisma.liveStream.findMany({
      where: { storeId },
      include: {
        _count: { select: { products: true, chatMessages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ streams: streams.map((stream) => attachLiveViewerCount(stream)) })
  })

  app.get('/streams/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const ownedStream = await findMerchantLiveStream(merchantId, id)
    if (!ownedStream) return reply.status(403).send({ error: 'غير مصرح' })

    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                price: true,
                stock: true,
                images: { take: 1, select: { url: true } },
              },
            },
          },
          orderBy: { addedAt: 'asc' },
        },
        chatMessages: {
          where: { isHidden: false },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 25,
        },
        _count: { select: { products: true, chatMessages: true } },
      },
    })

    if (!stream) return reply.status(404).send({ error: 'البث غير موجود' })

    return reply.send({ stream: attachLiveViewerCount(stream) })
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

    return reply.send({ streams: streams.map((stream) => attachLiveViewerCount(stream)) })
  })

  // PATCH /live-commerce/streams/:id/start — Start stream
  app.patch('/streams/:id/start', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const stream = await findMerchantLiveStream(merchantId, id)
    if (!stream) return reply.status(403).send({ error: 'غير مصرح' })

    const activeStream = await prisma.liveStream.findFirst({
      where: { storeId: stream.storeId, status: 'LIVE', NOT: { id } },
      select: { id: true, title: true },
    })
    if (activeStream) {
      return reply.status(409).send({ error: `يوجد بث مباشر آخر يعمل حالياً: ${activeStream.title}` })
    }

    await prisma.liveStream.update({ where: { id }, data: { status: 'LIVE', startedAt: new Date(), endedAt: null } })
    return reply.send({ message: 'بدأ البث المباشر 🔴' })
  })

  // PATCH /live-commerce/streams/:id/end — End stream
  app.patch('/streams/:id/end', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const stream = await findMerchantLiveStream(merchantId, id)
    if (!stream) return reply.status(403).send({ error: 'غير مصرح' })

    clearViewerPresence(id)
    await prisma.liveStream.update({ where: { id }, data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 } })
    return reply.send({ message: 'انتهى البث المباشر' })
  })

  // POST /live-commerce/streams/:id/products — Add product to stream
  app.post('/streams/:id/products', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { productId } = request.body as { productId: string }

    const merchantId = (request.user as any).id
    const stream = await findMerchantLiveStream(merchantId, id)
    if (!stream) return reply.status(403).send({ error: 'غير مصرح' })

    const product = await prisma.product.findFirst({ where: { id: productId, storeId: stream.storeId }, select: { id: true } })
    if (!product) return reply.status(403).send({ error: 'المنتج لا يخص هذا المتجر' })

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
    const merchantId = (request.user as any).id

    const stream = await findMerchantLiveStream(merchantId, id)
    if (!stream) return reply.status(403).send({ error: 'غير مصرح' })

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

    return reply.status(201).send({ msg })
  })

  app.post('/streams/:id/viewers/heartbeat', async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({ viewerId: z.string().min(4).max(80) })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'viewerId مطلوب' })

    const stream = await prisma.liveStream.findFirst({
      where: { id, status: 'LIVE' },
      select: { id: true, peakViewers: true },
    })
    if (!stream) return reply.status(400).send({ error: 'البث غير متاح حالياً' })

    const viewerCount = registerViewerHeartbeat(id, parsed.data.viewerId)
    const peakViewers = Math.max(stream.peakViewers, viewerCount)

    await prisma.liveStream.update({ where: { id }, data: { viewerCount, peakViewers } })
    return reply.send({ viewerCount, peakViewers })
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
    const merchantId = (request.user as any).id

    const message = await findMerchantLiveChatMessage(merchantId, msgId)
    if (!message) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.liveChatMessage.update({ where: { id: msgId }, data: { isHidden: true } })
    return reply.send({ message: 'تم إخفاء الرسالة' })
  })

  app.patch('/chat/:msgId/pin', { preHandler: authenticate }, async (request, reply) => {
    const { msgId } = request.params as { msgId: string }
    const schema = z.object({ pinned: z.boolean().default(true) })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const message = await findMerchantLiveChatMessage(merchantId, msgId)
    if (!message) return reply.status(403).send({ error: 'غير مصرح' })

    const updated = await prisma.liveChatMessage.update({
      where: { id: msgId },
      data: { isPinned: parsed.data.pinned },
    })
    return reply.send({ message: 'تم تحديث تثبيت الرسالة', chatMessage: updated })
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
    const { senderType, senderId, visitorId, message, fileUrl } = request.body as {
      senderType: 'VISITOR' | 'STAFF'; senderId?: string; visitorId?: string; message: string; fileUrl?: string
    }

    const session = await prisma.liveChatSession.findUnique({ where: { id } })
    if (!session || session.status === 'CLOSED') {
      return reply.status(400).send({ error: 'الجلسة غير متاحة' })
    }

    if (senderType === 'STAFF') {
      const authHeader = request.headers.authorization
      if (!authHeader) return reply.status(401).send({ error: 'غير مصرح' })

      try {
        await request.jwtVerify()
      } catch {
        return reply.status(401).send({ error: 'غير مصرح' })
      }

      const merchantId = (request.user as any).id
      const ownedSession = await findMerchantLiveChatSession(merchantId, id)
      if (!ownedSession) return reply.status(403).send({ error: 'غير مصرح' })
    } else {
      const effectiveVisitorId = visitorId || senderId
      if (!effectiveVisitorId || effectiveVisitorId !== session.visitorId) {
        return reply.status(403).send({ error: 'غير مصرح' })
      }
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
    const { since, visitorId } = request.query as { since?: string; visitorId?: string }

    const session = await prisma.liveChatSession.findUnique({ where: { id }, select: { visitorId: true } })
    if (!session) return reply.status(404).send({ error: 'الجلسة غير موجودة' })

    const authHeader = request.headers.authorization
    if (authHeader) {
      try {
        await request.jwtVerify()
        const merchantId = (request.user as any).id
        const ownedSession = await findMerchantLiveChatSession(merchantId, id)
        if (!ownedSession) return reply.status(403).send({ error: 'غير مصرح' })
      } catch {
        return reply.status(401).send({ error: 'غير مصرح' })
      }
    } else if (!visitorId || visitorId !== session.visitorId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

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
    const { rating, visitorId } = request.body as { rating?: number; visitorId?: string }

    const session = await prisma.liveChatSession.findUnique({ where: { id }, select: { visitorId: true } })
    if (!session) return reply.status(404).send({ error: 'الجلسة غير موجودة' })

    const authHeader = request.headers.authorization
    if (authHeader) {
      try {
        await request.jwtVerify()
        const merchantId = (request.user as any).id
        const ownedSession = await findMerchantLiveChatSession(merchantId, id)
        if (!ownedSession) return reply.status(403).send({ error: 'غير مصرح' })
      } catch {
        return reply.status(401).send({ error: 'غير مصرح' })
      }
    } else if (!visitorId || visitorId !== session.visitorId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    await prisma.liveChatSession.update({
      where: { id },
      data: { status: 'CLOSED', endedAt: new Date(), rating },
    })

    return reply.send({ message: 'تم إغلاق المحادثة' })
  })
}
