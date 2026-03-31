import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'crypto'
import type { WebhookEvent } from '@prisma/client'

// ─────────────────────────────────────────────
// Helper: fire webhook event
// ─────────────────────────────────────────────
export async function fireWebhook(storeId: string, event: WebhookEvent, payload: object) {
  const webhooks = await prisma.webhook.findMany({
    where: { storeId, isActive: true, events: { has: event } },
  })

  for (const wh of webhooks) {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
    const sig = crypto.createHmac('sha256', wh.secret).update(body).digest('hex')

    let success = false
    let statusCode: number | undefined
    let response: string | undefined

    try {
      const res = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bazar-Event': event,
          'X-Bazar-Signature': `sha256=${sig}`,
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      statusCode = res.status
      response = await res.text().catch(() => '')
      success = res.ok
    } catch (err) {
      response = (err as Error).message
    }

    // Log result + update stats (fire-and-forget)
    prisma.webhookLog.create({
      data: { webhookId: wh.id, event, payload, statusCode, response, success },
    }).catch(() => {})

    if (!success) {
      prisma.webhook.update({
        where: { id: wh.id },
        data: { failureCount: { increment: 1 } },
      }).catch(() => {})
    } else {
      prisma.webhook.update({
        where: { id: wh.id },
        data: { lastCalledAt: new Date(), failureCount: 0 },
      }).catch(() => {})
    }
  }
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
export async function webhookRoutes(app: FastifyInstance) {

  // List webhooks
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const webhooks = await prisma.webhook.findMany({
      where: { storeId },
      include: { _count: { select: { logs: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ webhooks })
  })

  // Create webhook
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      url: z.string().url(),
      events: z.array(z.enum([
        'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED',
        'PAYMENT_COMPLETED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED',
        'PRODUCT_DELETED', 'CUSTOMER_CREATED', 'REVIEW_SUBMITTED',
      ])).min(1),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })

    const merchantId = (request.user as any).id
    const { storeId, url, events } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const secret = crypto.randomBytes(32).toString('hex')
    const webhook = await prisma.webhook.create({
      data: { storeId, url, events: events as WebhookEvent[], secret },
    })
    return reply.status(201).send({ webhook, secret })
  })

  // Update webhook
  app.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      url: z.string().url().optional(),
      events: z.array(z.string()).min(1).optional(),
      isActive: z.boolean().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({
      where: { id, store: { merchantId } },
    })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })

    const updated = await prisma.webhook.update({
      where: { id },
      data: result.data as any,
    })
    return reply.send({ webhook: updated })
  })

  // Delete webhook
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({ where: { id, store: { merchantId } } })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })
    await prisma.webhook.delete({ where: { id } })
    return reply.send({ message: 'تم الحذف' })
  })

  // Rotate secret
  app.post('/:id/rotate-secret', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({ where: { id, store: { merchantId } } })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })
    const secret = crypto.randomBytes(32).toString('hex')
    await prisma.webhook.update({ where: { id }, data: { secret } })
    return reply.send({ secret })
  })

  // Webhook delivery logs
  app.get('/:id/logs', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({ where: { id, store: { merchantId } } })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })
    const logs = await prisma.webhookLog.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ logs })
  })

  // Test webhook
  app.post('/:id/test', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({ where: { id, store: { merchantId } } })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })
    await fireWebhook(webhook.storeId, 'ORDER_CREATED', { test: true, message: 'Test webhook from Bazar' })
    return reply.send({ message: 'تم إرسال الاختبار' })
  })
}
