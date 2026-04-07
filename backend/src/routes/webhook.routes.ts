import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'crypto'
import type { WebhookEvent } from '@prisma/client'

const supportedWebhookEvents = [
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'ORDER_CANCELLED',
  'PAYMENT_COMPLETED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DELETED',
  'CUSTOMER_CREATED',
  'REVIEW_SUBMITTED',
] as const

const webhookEventSchema = z.enum(supportedWebhookEvents)

const WEBHOOK_CONTRACT = {
  version: '2026-04-07',
  timeoutMs: 10000,
  headers: {
    event: 'X-Bazar-Event',
    signature: 'X-Bazar-Signature',
    deliveryId: 'X-Bazar-Delivery',
    timestamp: 'X-Bazar-Timestamp',
    webhookId: 'X-Bazar-Webhook',
  },
  signature: {
    algorithm: 'HMAC-SHA256',
    format: 'sha256=<hex-digest>',
    signedPayload: JSON.stringify({
      event: 'ORDER_CREATED',
      payload: { id: 'ord_123' },
      timestamp: '2026-04-07T12:00:00.000Z',
      deliveryId: 'delivery_123',
      test: false,
    }),
  },
  events: [
    { key: 'ORDER_CREATED', label: 'Order created', description: 'Raised when a new order is created.' },
    { key: 'ORDER_UPDATED', label: 'Order updated', description: 'Raised when order status or details change.' },
    { key: 'ORDER_CANCELLED', label: 'Order cancelled', description: 'Raised when an order is cancelled.' },
    { key: 'PAYMENT_COMPLETED', label: 'Payment completed', description: 'Raised after a successful payment confirmation.' },
    { key: 'PRODUCT_CREATED', label: 'Product created', description: 'Raised when a product is created.' },
    { key: 'PRODUCT_UPDATED', label: 'Product updated', description: 'Raised when a product is updated.' },
    { key: 'PRODUCT_DELETED', label: 'Product deleted', description: 'Raised when a product is deleted.' },
    { key: 'CUSTOMER_CREATED', label: 'Customer created', description: 'Raised when a customer profile is created.' },
    { key: 'REVIEW_SUBMITTED', label: 'Review submitted', description: 'Raised when a customer submits a review.' },
  ],
  retryRoute: 'POST /api/v1/webhooks/:id/logs/:logId/retry',
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildDeliveryEnvelope(event: WebhookEvent, payload: object, test = false, deliveryId = crypto.randomUUID(), timestamp = new Date().toISOString()) {
  return {
    event,
    payload,
    timestamp,
    deliveryId,
    test,
  }
}

function formatWebhookLog(log: { id: string; event: string; payload: unknown; statusCode: number | null; response: string | null; success: boolean; createdAt: Date }) {
  const payloadRecord = isRecord(log.payload) ? log.payload : null
  const envelopePayload = payloadRecord && 'payload' in payloadRecord ? payloadRecord.payload : log.payload
  const deliveryId = payloadRecord && typeof payloadRecord.deliveryId === 'string' ? payloadRecord.deliveryId : log.id
  const timestamp = payloadRecord && typeof payloadRecord.timestamp === 'string' ? payloadRecord.timestamp : log.createdAt.toISOString()
  const test = payloadRecord?.test === true

  return {
    ...log,
    deliveryId,
    timestamp,
    test,
    payload: envelopePayload,
  }
}

async function deliverWebhookToTarget(
  webhook: { id: string; url: string; secret: string },
  event: WebhookEvent,
  payload: object,
  options?: { test?: boolean }
) {
  const envelope = buildDeliveryEnvelope(event, payload, options?.test === true)
  const body = JSON.stringify(envelope)
  const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')

  let success = false
  let statusCode: number | undefined
  let response: string | undefined

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bazar-Event': event,
        'X-Bazar-Signature': `sha256=${signature}`,
        'X-Bazar-Delivery': envelope.deliveryId,
        'X-Bazar-Timestamp': envelope.timestamp,
        'X-Bazar-Webhook': webhook.id,
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_CONTRACT.timeoutMs),
    })
    statusCode = res.status
    response = await res.text().catch(() => '')
    success = res.ok
  } catch (error) {
    response = (error as Error).message
  }

  const log = await prisma.webhookLog.create({
    data: {
      webhookId: webhook.id,
      event,
      payload: envelope,
      statusCode,
      response,
      success,
    },
  })

  if (!success) {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { failureCount: { increment: 1 } },
    }).catch(() => {})
  } else {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { lastCalledAt: new Date(), failureCount: 0 },
    }).catch(() => {})
  }

  return {
    success,
    statusCode,
    response,
    deliveryId: envelope.deliveryId,
    log: formatWebhookLog(log),
  }
}

// ─────────────────────────────────────────────
// Helper: fire webhook event
// ─────────────────────────────────────────────
export async function fireWebhook(storeId: string, event: WebhookEvent, payload: object) {
  const webhooks = await prisma.webhook.findMany({
    where: { storeId, isActive: true, events: { has: event } },
  })

  for (const wh of webhooks) {
    await deliverWebhookToTarget(wh, event, payload)
  }
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
export async function webhookRoutes(app: FastifyInstance) {

  app.get('/contract', { preHandler: authenticate }, async (_request, reply) => {
    return reply.send(WEBHOOK_CONTRACT)
  })

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
    return reply.send({ webhooks, total: webhooks.length })
  })

  // Create webhook
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      url: z.string().url(),
      events: z.array(webhookEventSchema).min(1),
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
      events: z.array(webhookEventSchema).min(1).optional(),
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
    return reply.send({ logs: logs.map(formatWebhookLog) })
  })

  // Test webhook
  app.post('/:id/test', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ event: webhookEventSchema.optional() }).safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({ where: { id, store: { merchantId } } })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })

    const event = body.data.event ?? (webhook.events[0] ?? 'ORDER_CREATED')
    const result = await deliverWebhookToTarget(webhook, event, {
      test: true,
      message: 'Test webhook from Bazar',
      webhookId: webhook.id,
      subscribedEvents: webhook.events,
    }, { test: true })

    return reply.send({
      message: 'تم إرسال الاختبار',
      delivery: result,
    })
  })

  app.post('/:id/logs/:logId/retry', { preHandler: authenticate }, async (request, reply) => {
    const { id, logId } = request.params as { id: string; logId: string }
    const merchantId = (request.user as any).id
    const webhook = await prisma.webhook.findFirst({ where: { id, store: { merchantId } } })
    if (!webhook) return reply.status(404).send({ error: 'غير موجود' })

    const log = await prisma.webhookLog.findFirst({ where: { id: logId, webhookId: id } })
    if (!log) return reply.status(404).send({ error: 'سجل التسليم غير موجود' })

    const payloadRecord = isRecord(log.payload) ? log.payload : null
    const payload = payloadRecord && 'payload' in payloadRecord && isRecord(payloadRecord.payload)
      ? payloadRecord.payload
      : isRecord(log.payload)
        ? log.payload
        : { raw: log.payload }

    const retried = await deliverWebhookToTarget(webhook, log.event as WebhookEvent, payload, {
      test: payloadRecord?.test === true,
    })

    return reply.send({
      message: 'تمت إعادة المحاولة',
      delivery: retried,
    })
  })
}
