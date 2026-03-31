import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

async function requireAdmin(request: any, reply: any) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: (request.user as any).id },
    select: { isAdmin: true, isActive: true },
  })
  if (!merchant?.isAdmin) {
    return reply.status(403).send({ error: 'غير مصرح — يخص مشرفي المنصة فقط' })
  }
}

function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d
}
function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

export async function adminRoutes(app: FastifyInstance) {
  // ── One-time setup: grant admin to a merchant account ─────────────────────
  // Call once: POST /api/v1/admin/setup  { email, setupToken }
  app.post('/setup', async (req, reply) => {
    const { email, setupToken } = req.body as { email?: string; setupToken?: string }
    if (!email || !setupToken) {
      return reply.status(400).send({ error: 'email و setupToken مطلوبان' })
    }
    if (setupToken !== process.env.ADMIN_SETUP_TOKEN) {
      return reply.status(403).send({ error: 'رمز الإعداد غير صحيح' })
    }
    const merchant = await prisma.merchant.update({
      where: { email },
      data: { isAdmin: true },
      select: { id: true, email: true, isAdmin: true },
    })
    return reply.send({ message: 'تم تعيين الحساب كمشرف للمنصة ✅', merchant })
  })

  // ── Platform stats ─────────────────────────────────────────────────────────
  app.get('/stats', { preHandler: [authenticate, requireAdmin] }, async (_req, reply) => {
    const [
      totalMerchants,
      totalStores,
      totalOrders,
      totalCustomers,
      newMerchantsThisWeek,
      newStoresThisMonth,
      revenueResult,
      planCounts,
    ] = await Promise.all([
      prisma.merchant.count(),
      prisma.store.count(),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.merchant.count({ where: { createdAt: { gte: startOfWeek() } } }),
      prisma.store.count({ where: { createdAt: { gte: startOfMonth() } } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      }),
      prisma.store.groupBy({ by: ['plan'], _count: { id: true } }),
    ])

    return reply.send({
      totalMerchants,
      totalStores,
      totalOrders,
      totalCustomers,
      newMerchantsThisWeek,
      newStoresThisMonth,
      totalRevenue: Number(revenueResult._sum.total ?? 0),
      planCounts: planCounts.map((p: { plan: string; _count: { id: number } }) => ({
        plan: p.plan,
        count: p._count.id,
      })),
    })
  })

  // ── All merchants ──────────────────────────────────────────────────────────
  app.get('/merchants', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isActive: true,
          isAdmin: true,
          createdAt: true,
          _count: { select: { stores: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.merchant.count({ where }),
    ])

    return reply.send({
      merchants,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    })
  })

  // ── Toggle merchant isActive / isAdmin ─────────────────────────────────────
  app.patch('/merchants/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { isActive, isAdmin: makeAdmin } = req.body as { isActive?: boolean; isAdmin?: boolean }

    const data: Record<string, boolean> = {}
    if (isActive !== undefined) data.isActive = isActive
    if (makeAdmin !== undefined) data.isAdmin = makeAdmin

    const merchant = await prisma.merchant.update({
      where: { id },
      data,
      select: { id: true, isActive: true, isAdmin: true },
    })
    return reply.send({ merchant })
  })

  // ── All stores ─────────────────────────────────────────────────────────────
  app.get('/stores', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
        { merchant: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        select: {
          id: true,
          name: true,
          nameAr: true,
          subdomain: true,
          plan: true,
          isActive: true,
          createdAt: true,
          merchant: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { orders: true, products: true, customers: true } },
          orders: {
            select: { total: true },
            where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.count({ where }),
    ])

    const storesWithRevenue = stores.map((s) => {
      const { orders: rawOrders, ...rest } = s
      return {
        ...rest,
        revenue: rawOrders.reduce((sum, o) => sum + Number(o.total), 0),
      }
    })

    return reply.send({
      stores: storesWithRevenue,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    })
  })

  // ── Toggle store isActive / change plan ────────────────────────────────────
  app.patch('/stores/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { isActive, plan } = req.body as { isActive?: boolean; plan?: string }

    const data: any = {}
    if (isActive !== undefined) data.isActive = isActive
    if (plan) data.plan = plan

    const store = await prisma.store.update({
      where: { id },
      data,
      select: { id: true, isActive: true, plan: true },
    })
    return reply.send({ store })
  })

  // ── MRR / ARR Analytics ────────────────────────────────────────────────────
  app.get('/analytics/mrr', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    // MRR = sum of invoices paid in current month / plan prices
    const now = new Date()
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last12Months = new Date(now.getFullYear() - 1, now.getMonth(), 1)

    const invoices = await prisma.billingInvoice.findMany({
      where: { status: 'PAID', paidAt: { gte: last12Months } },
      select: { amount: true, paidAt: true, storeId: true },
    })

    // Group by month
    const monthlyMap: Record<string, number> = {}
    for (const inv of invoices) {
      if (!inv.paidAt) continue
      const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`
      monthlyMap[key] = (monthlyMap[key] ?? 0) + Number(inv.amount)
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }))

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const mrr = monthlyMap[currentMonthKey] ?? 0
    const arr = mrr * 12

    // Churn: stores that went inactive in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [activeStores, recentlyInactiveStores] = await Promise.all([
      prisma.store.count({ where: { isActive: true } }),
      prisma.store.count({
        where: { isActive: false, updatedAt: { gte: thirtyDaysAgo } },
      }),
    ])

    const churnRate = activeStores + recentlyInactiveStores > 0
      ? (recentlyInactiveStores / (activeStores + recentlyInactiveStores)) * 100
      : 0

    // Plan distribution
    const planCounts = await prisma.store.groupBy({
      by: ['plan'],
      where: { isActive: true },
      _count: { id: true },
    })

    // New stores per month (last 12)
    const newStores = await prisma.store.findMany({
      where: { createdAt: { gte: last12Months } },
      select: { createdAt: true },
    })
    const newStoresMap: Record<string, number> = {}
    for (const s of newStores) {
      const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`
      newStoresMap[key] = (newStoresMap[key] ?? 0) + 1
    }

    return reply.send({
      mrr,
      arr,
      churnRate: Math.round(churnRate * 100) / 100,
      activeStores,
      monthly,
      planDistribution: planCounts.map((p: { plan: string; _count: { id: number } }) => ({
        plan: p.plan,
        count: p._count.id,
      })),
      newStoresMonthly: Object.entries(newStoresMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
    })
  })

  // ── Cohort Analysis ────────────────────────────────────────────────────────
  app.get('/analytics/cohort', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const last6Months: { month: string; new: number; retained: number; churned: number }[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

      const newCount = await prisma.store.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } })
      const retained = await prisma.store.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, isActive: true },
      })
      last6Months.push({ month: key, new: newCount, retained, churned: newCount - retained })
    }

    return reply.send({ cohorts: last6Months })
  })

  // ── Platform Health ────────────────────────────────────────────────────────
  app.get('/health/stats', { preHandler: [authenticate, requireAdmin] }, async (_req, reply) => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [recentWebhookLogs, failedWebhooks, pendingTickets, urgentTickets] = await Promise.all([
      prisma.webhookLog.count({ where: { createdAt: { gte: fiveMinAgo } } }),
      prisma.webhookLog.count({ where: { success: false, createdAt: { gte: oneDayAgo } } }),
      prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.supportTicket.count({ where: { priority: 'URGENT', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    ])

    const totalWebhooksToday = await prisma.webhookLog.count({ where: { createdAt: { gte: oneDayAgo } } })
    const errorRate = totalWebhooksToday > 0 ? (failedWebhooks / totalWebhooksToday) * 100 : 0

    return reply.send({
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      recentActivity: recentWebhookLogs,
      webhookErrorRate: Math.round(errorRate * 100) / 100,
      pendingTickets,
      urgentTickets,
    })
  })

  // ── Auto-suspend expired stores (G1) ─────────────────────────────────────
  // Called by a cron job: POST /api/v1/admin/billing/suspend-expired
  app.post('/billing/suspend-expired', { preHandler: [authenticate, requireAdmin] }, async (_req, reply) => {
    const now = new Date()
    const expired = await prisma.store.findMany({
      where: {
        isActive: true,
        planExpiresAt: { lt: now },
        plan: { not: 'STARTER' }, // STARTER never expires
      },
      select: { id: true, name: true, subdomain: true, planExpiresAt: true },
    })

    if (expired.length === 0) {
      return reply.send({ suspended: 0, stores: [] })
    }

    await prisma.store.updateMany({
      where: { id: { in: expired.map(s => s.id) } },
      data: { isActive: false },
    })

    return reply.send({
      suspended: expired.length,
      stores: expired.map(s => ({
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        expiredAt: s.planExpiresAt,
      })),
    })
  })
}

