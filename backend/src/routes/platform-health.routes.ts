import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import https from 'node:https'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { requireAdmin } from '../middleware/auth.middleware'

// ─── Platform Health Dashboard + Monitoring ───────────────────────────────────

export async function healthDashboardRoutes(app: FastifyInstance) {
  // GET /platform/health — Full platform health status
  app.get('/health', { preHandler: requireAdmin }, async (request, reply) => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600000)
    const oneDayAgo = new Date(now.getTime() - 86400000)

    const [
      activeStores,
      totalMerchants,
      totalOrders,
      recentErrors,
      recentOrdersCount,
      avgResponseTime,
    ] = await Promise.all([
      prisma.store.count({ where: { isActive: true } }),
      prisma.merchant.count(),
      prisma.order.count(),
      prisma.errorLog.count({ where: { createdAt: { gte: oneHourAgo }, level: 'ERROR' } }),
      prisma.order.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.systemMetric.aggregate({
        where: { metricName: 'response_time', recordedAt: { gte: oneHourAgo } },
        _avg: { value: true },
      }),
    ])

    // Record current metric
    await prisma.systemMetric.create({
      data: {
        metricName: 'active_stores',
        value: activeStores,
        unit: 'count',
      },
    })

    return reply.send({
      status: recentErrors > 50 ? 'degraded' : 'healthy',
      uptime: process.uptime(),
      timestamp: now.toISOString(),
      metrics: {
        activeStores,
        totalMerchants,
        totalOrders,
        recentErrors,
        recentOrders24h: recentOrdersCount,
        avgResponseTimeMs: avgResponseTime._avg.value || 0,
        memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
      },
    })
  })

  // GET /platform/errors — Error log viewer
  app.get('/errors', { preHandler: requireAdmin }, async (request, reply) => {
    const { page = 1, limit = 50, level, storeId } = request.query as {
      page?: number; limit?: number; level?: string; storeId?: string
    }

    const where: any = {}
    if (level) where.level = level
    if (storeId) where.storeId = storeId

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.errorLog.count({ where }),
    ])

    return reply.send({ errors, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // POST /platform/errors — Log an error (internal)
  app.post('/errors', async (request, reply) => {
    const schema = z.object({
      level: z.enum(['ERROR', 'WARN', 'INFO']).default('ERROR'),
      message: z.string(),
      stack: z.string().optional(),
      path: z.string().optional(),
      method: z.string().optional(),
      storeId: z.string().optional(),
      userId: z.string().optional(),
      metadata: z.any().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'invalid' })

    const errorLog = await prisma.errorLog.create({ data: result.data })
    return reply.status(201).send({ id: errorLog.id })
  })

  // GET /platform/metrics — System metrics history
  app.get('/metrics', { preHandler: requireAdmin }, async (request, reply) => {
    const { metricName, hours = 24 } = request.query as { metricName?: string; hours?: number }

    const since = new Date(Date.now() - Number(hours) * 3600000)

    const where: any = { recordedAt: { gte: since } }
    if (metricName) where.metricName = metricName

    const metrics = await prisma.systemMetric.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 1000,
    })

    // Group by metricName
    const grouped: Record<string, any[]> = {}
    for (const m of metrics) {
      if (!grouped[m.metricName]) grouped[m.metricName] = []
      grouped[m.metricName].push({ value: m.value, unit: m.unit, time: m.recordedAt })
    }

    return reply.send({ metrics: grouped })
  })

  // POST /platform/metrics — Record a metric
  app.post('/metrics', async (request, reply) => {
    const { metricName, value, unit } = request.body as { metricName: string; value: number; unit?: string }
    const metric = await prisma.systemMetric.create({ data: { metricName, value, unit } })
    return reply.status(201).send({ metric })
  })

  // GET /platform/alerts — Alert configurations
  app.get('/alerts', { preHandler: requireAdmin }, async (request, reply) => {
    const alerts = await prisma.systemAlertConfig.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ alerts })
  })

  // POST /platform/alerts — Create alert
  app.post('/alerts', { preHandler: requireAdmin }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      metricName: z.string().min(1),
      threshold: z.number(),
      comparison: z.enum(['GT', 'LT', 'EQ']).default('GT'),
      channel: z.enum(['EMAIL', 'SLACK']).default('EMAIL'),
      destination: z.string().min(1),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const alert = await prisma.systemAlertConfig.create({ data: result.data })
    return reply.status(201).send({ alert })
  })

  // DELETE /platform/alerts/:id
  app.delete('/alerts/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.systemAlertConfig.delete({ where: { id } })
    return reply.send({ message: 'تم حذف التنبيه' })
  })

  // GET /platform/store-usage/:storeId — Per-store resource usage
  app.get('/store-usage/:storeId', { preHandler: requireAdmin }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }

    const [productCount, orderCount, customerCount, apiCalls] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId } }),
      prisma.customer.count({ where: { storeId } }),
      prisma.systemMetric.aggregate({
        where: { metricName: `api_calls_${storeId}`, recordedAt: { gte: new Date(Date.now() - 86400000) } },
        _sum: { value: true },
      }),
    ])

    return reply.send({
      storeId,
      productCount,
      orderCount,
      customerCount,
      apiCalls24h: apiCalls._sum.value || 0,
    })
  })

  // GET /platform/country-map — Orders + merchants by country
  app.get('/country-map', { preHandler: requireAdmin }, async (request, reply) => {
    const pageViewsByCountry = await prisma.pageView.groupBy({
      by: ['country'],
      _count: { id: true },
      where: { country: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    })

    const ordersByCountry = await prisma.address.groupBy({
      by: ['country'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    return reply.send({
      pageViewsByCountry: pageViewsByCountry.map((r) => ({ country: r.country, count: r._count.id })),
      ordersByCountry: ordersByCountry.map((r) => ({ country: r.country, count: r._count.id })),
    })
  })

  // GET /platform/conversion-funnel — Registration→paid conversion
  app.get('/conversion-funnel', { preHandler: requireAdmin }, async (request, reply) => {
    const [registered, onboarded, firstOrder, paid] = await Promise.all([
      prisma.merchant.count(),
      prisma.onboarding.count({ where: { completedAt: { not: null } } }),
      prisma.store.count({ where: { orders: { some: {} } } }),
      prisma.store.count({ where: { orders: { some: { paymentStatus: 'PAID' } } } }),
    ])

    return reply.send({
      funnel: [
        { stage: 'تسجيل التجار', count: registered, pct: 100 },
        { stage: 'إكمال Onboarding', count: onboarded, pct: Math.round((onboarded / registered) * 100) },
        { stage: 'أول طلب', count: firstOrder, pct: Math.round((firstOrder / registered) * 100) },
        { stage: 'طلب مدفوع', count: paid, pct: Math.round((paid / registered) * 100) },
      ],
    })
  })

  // POST /platform/notify — Send alert (Slack/Email)
  app.post('/notify', { preHandler: requireAdmin }, async (request, reply) => {
    const { channel, destination, message, subject } = request.body as {
      channel: 'EMAIL' | 'SLACK'; destination: string; message: string; subject?: string
    }

    if (channel === 'SLACK') {
      try {
        await fetch(destination, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `🚨 Bazar Alert: ${message}` }),
        })
      } catch {
        return reply.status(500).send({ error: 'فشل إرسال Slack notification' })
      }
    }

    // EMAIL: use platform email service
    return reply.send({ sent: true, channel, destination })
  })
}
