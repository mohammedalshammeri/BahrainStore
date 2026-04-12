import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, requireFullPlatformAdmin, requirePlatformPermission, resolvePlatformAccess } from '../middleware/auth.middleware'
import { sendPasswordResetEmail, sendCustomAdminEmail, sendKycDecisionEmail } from '../lib/email'
import { sendSms } from '../lib/sms'
import { THEME_CHANGELOG_ASSET_KEYS, THEME_MANIFEST_ASSET_KEY, buildThemeManifestAsset, buildThemePackageBuffer, parseThemePackageBuffer, resolveThemeChangelogFromAssets, resolveThemeManifestFromAssets, themePackageManifestSchema } from '../lib/theme-package'
import { adminKycRoutes } from './admin-kyc.routes'
import crypto from 'crypto'
import { getEnv } from '../lib/env'

const adminThemeSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  nameAr: z.string().min(1),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  downloadUrl: z.string().url().optional(),
  authorName: z.string().min(1),
  authorEmail: z.string().email().optional(),
  version: z.string().min(1).default('1.0.0'),
  changelog: z.string().optional(),
  price: z.number().min(0).default(0),
  isPremium: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
})

async function syncThemeMetadataAssets(input: {
  themeId: string
  manifest: z.infer<typeof themePackageManifestSchema>
  changelog?: string
}) {
  await prisma.themeAsset.upsert({
    where: { themeId_key: { themeId: input.themeId, key: THEME_MANIFEST_ASSET_KEY } },
    create: { themeId: input.themeId, key: THEME_MANIFEST_ASSET_KEY, content: JSON.stringify(input.manifest, null, 2), mimeType: 'application/json' },
    update: { content: JSON.stringify(input.manifest, null, 2), mimeType: 'application/json' },
  })

  const changelogKey = THEME_CHANGELOG_ASSET_KEYS[0]
  if (input.changelog?.trim()) {
    await prisma.themeAsset.upsert({
      where: { themeId_key: { themeId: input.themeId, key: changelogKey } },
      create: { themeId: input.themeId, key: changelogKey, content: input.changelog.trim(), mimeType: 'text/markdown' },
      update: { content: input.changelog.trim(), mimeType: 'text/markdown' },
    })
  } else {
    await prisma.themeAsset.deleteMany({ where: { themeId: input.themeId, key: { in: [...THEME_CHANGELOG_ASSET_KEYS] } } })
  }
}

function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d
}
function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

export async function adminRoutes(app: FastifyInstance) {
  await adminKycRoutes(app)

  // ── One-time setup: grant admin to a merchant account ─────────────────────
  // Call once: POST /api/v1/admin/setup  { email, setupToken }
  app.post('/setup', async (req, reply) => {
    const { email, setupToken } = req.body as { email?: string; setupToken?: string }
    if (!email || !setupToken) {
      return reply.status(400).send({ error: 'email و setupToken مطلوبان' })
    }
    if (setupToken !== getEnv().ADMIN_SETUP_TOKEN) {
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
  app.get('/stats', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
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
  app.get('/merchants', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
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

  // ── Get single merchant detail ──────────────────────────────────────────────
  app.get('/merchants/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const merchant = await prisma.merchant.findUnique({
      where: { id },
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
        stores: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            subdomain: true,
            plan: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: { orders: true, products: true, customers: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { stores: true, sessions: true } },
      },
    })

    if (!merchant) return reply.status(404).send({ error: 'Merchant not found' })
    return reply.send({ merchant })
  })

  // ── Toggle merchant isActive / isAdmin ─────────────────────────────────────
  app.patch('/merchants/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
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

  // ── Reset merchant password ─────────────────────────────────────────────────
  app.post('/merchants/:id/reset-password', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true },
    })
    if (!merchant) return reply.status(404).send({ error: 'Merchant not found' })

    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 3600000) // 1 hour

    await prisma.merchant.update({
      where: { id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    })

    const resetUrl = `${process.env.DASHBOARD_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`
    await sendPasswordResetEmail({ to: merchant.email, firstName: merchant.firstName, resetUrl })

    return reply.send({ success: true, message: 'تم إرسال رابط إعادة تعيين كلمة المرور' })
  })

  // ── Send direct email to merchant ──────────────────────────────────────────
  app.post('/merchants/:id/email', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { subject, body } = req.body as { subject: string; body: string }

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      select: { email: true, firstName: true },
    })
    if (!merchant) return reply.status(404).send({ error: 'Merchant not found' })

    await sendCustomAdminEmail({ to: merchant.email, firstName: merchant.firstName, subject, body })
    return reply.send({ success: true, message: 'تم إرسال الإيميل بنجاح' })
  })

  // ── Internal notes: list ────────────────────────────────────────────────────
  app.get('/merchants/:id/notes', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const notes = await prisma.adminNote.findMany({
      where: { merchantId: id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ notes })
  })

  // ── Internal notes: add ─────────────────────────────────────────────────────
  app.post('/merchants/:id/notes', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { content } = req.body as { content: string }
    const adminMerchant = await prisma.merchant.findUnique({
      where: { id: (req.user as any).id },
      select: { firstName: true, lastName: true, email: true },
    })

    const note = await prisma.adminNote.create({
      data: {
        merchantId: id,
        content,
        authorEmail: adminMerchant?.email ?? '',
        authorName: `${adminMerchant?.firstName ?? ''} ${adminMerchant?.lastName ?? ''}`.trim(),
      },
    })
    return reply.status(201).send({ note })
  })

  // ── Internal notes: delete ──────────────────────────────────────────────────
  app.delete('/merchants/:id/notes/:noteId', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { noteId } = req.params as { id: string; noteId: string }
    await prisma.adminNote.delete({ where: { id: noteId } })
    return reply.send({ success: true })
  })

  // ── All stores ─────────────────────────────────────────────────────────────
  app.get('/stores', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
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

  // ── Store detail (full stats) ─────────────────────────────────────────────
  app.get('/stores/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        merchant: {
          select: {
            id: true, email: true, firstName: true, lastName: true,
            phone: true, isVerified: true, isAdmin: true, createdAt: true,
          },
        },
        _count: {
          select: { products: true, orders: true, customers: true, staff: true },
        },
      },
    })

    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const [revenueResult, recentOrders, topProducts] = await Promise.all([
      prisma.order.aggregate({
        where: { storeId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        _sum: { total: true },
        _avg: { total: true },
      }),
      prisma.order.findMany({
        where: { storeId: id },
        select: {
          id: true, orderNumber: true, total: true, status: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { storeId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ])

    const productIds = topProducts.map((p) => p.productId)
    const productNames = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(productNames.map((p) => [p.id, p.name]))

    return reply.send({
      store,
      revenue: Number(revenueResult._sum.total ?? 0),
      avgOrderValue: Number(revenueResult._avg.total ?? 0),
      recentOrders,
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: nameMap[p.productId] ?? 'غير معروف',
        totalSold: p._sum.quantity ?? 0,
      })),
    })
  })

  // ── Toggle store isActive / change plan ────────────────────────────────────
  app.patch('/stores/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
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

  // ── Extend store trial ──────────────────────────────────────────────────────
  app.post('/stores/:id/extend-trial', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { days = 7 } = req.body as { days?: number }

    const store = await prisma.store.findUnique({
      where: { id },
      select: { trialEndsAt: true, planExpiresAt: true },
    })
    if (!store) return reply.status(404).send({ error: 'Store not found' })

    const base = store.trialEndsAt ?? store.planExpiresAt ?? new Date()
    const newDate = new Date(base)
    newDate.setDate(newDate.getDate() + days)

    await prisma.store.update({ where: { id }, data: { trialEndsAt: newDate } })
    return reply.send({ success: true, trialEndsAt: newDate })
  })

  // ── Impersonate merchant (generate short-lived token) ──────────────────────
  app.post('/stores/:id/impersonate', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const store = await prisma.store.findUnique({
      where: { id },
      select: { merchantId: true, subdomain: true },
    })
    if (!store) return reply.status(404).send({ error: 'Store not found' })

    const adminId = (req.user as any).id
    const token = (app as any).jwt.sign(
      { id: store.merchantId, impersonatedBy: adminId },
      { expiresIn: '10m' }
    )

    return reply.send({
      token,
      merchantId: store.merchantId,
      dashboardUrl: `${process.env.DASHBOARD_URL ?? 'http://localhost:3000'}?impersonate=${token}`,
    })
  })

  // ── Store activity log ──────────────────────────────────────────────────────
  app.get('/stores/:id/activity', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const [recentOrders, recentProducts, recentCustomers] = await Promise.all([
      prisma.order.findMany({
        where: { storeId: id },
        select: {
          id: true, orderNumber: true, total: true, status: true, createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.product.findMany({
        where: { storeId: id },
        select: { id: true, nameAr: true, name: true, price: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.customer.findMany({
        where: { storeId: id },
        select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const activities = [
      ...recentOrders.map((o) => ({
        type: 'order',
        id: o.id,
        title: `طلب #${o.orderNumber}`,
        subtitle: `${o.customer.firstName} ${o.customer.lastName}`,
        meta: Number(o.total),
        status: o.status,
        createdAt: o.createdAt,
      })),
      ...recentProducts.map((p) => ({
        type: 'product',
        id: p.id,
        title: `منتج: ${p.nameAr || p.name}`,
        subtitle: null,
        meta: Number(p.price),
        status: null,
        createdAt: p.createdAt,
      })),
      ...recentCustomers.map((c) => ({
        type: 'customer',
        id: c.id,
        title: `عميل جديد: ${c.firstName} ${c.lastName}`,
        subtitle: c.email,
        meta: null,
        status: null,
        createdAt: c.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 25)

    return reply.send({ activities })
  })

  // ── Apps marketplace (CRUD) ────────────────────────────────────────────────
  app.get('/apps', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { nameAr: { contains: search, mode: 'insensitive' } }] }
      : {}

    const [apps, total] = await Promise.all([
      prisma.app.findMany({
        where,
        include: { _count: { select: { installs: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.app.count({ where }),
    ])

    return reply.send({ apps, total, pages: Math.ceil(total / parseInt(limit)) })
  })

  app.post('/apps', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const body = req.body as any
    const app_ = await prisma.app.create({ data: body })
    return reply.status(201).send({ app: app_ })
  })

  app.patch('/apps/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    const app_ = await prisma.app.update({ where: { id }, data: body })
    return reply.send({ app: app_ })
  })

  app.delete('/apps/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.app.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Themes marketplace (CRUD) ──────────────────────────────────────────────
  app.get('/themes', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { nameAr: { contains: search, mode: 'insensitive' } }] }
      : {}

    const [themes, total] = await Promise.all([
      prisma.theme.findMany({
        where,
        include: { _count: { select: { purchases: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.theme.count({ where }),
    ])

    return reply.send({ themes, total, pages: Math.ceil(total / parseInt(limit)) })
  })

  app.post('/themes', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const body = req.body as any
    const theme = await prisma.theme.create({ data: body })
    return reply.status(201).send({ theme })
  })

  app.patch('/themes/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    const theme = await prisma.theme.update({ where: { id }, data: body })
    return reply.send({ theme })
  })

  app.delete('/themes/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.theme.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Support tickets (platform-wide) ──────────────────────────────────────
  app.get('/support', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (req, reply) => {
    const { page = '1', limit = '20', status, priority } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, subdomain: true } },
          messages: { orderBy: { createdAt: 'asc' }, take: 1 },
          _count: { select: { messages: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.supportTicket.count({ where }),
    ])

    return reply.send({ tickets, total, pages: Math.ceil(total / parseInt(limit)) })
  })

  app.patch('/support/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status, priority } = req.body as { status?: string; priority?: string }
    const data: any = {}
    if (status) { data.status = status; if (status === 'RESOLVED') data.resolvedAt = new Date() }
    if (priority) data.priority = priority

    const ticket = await prisma.supportTicket.update({ where: { id }, data })
    return reply.send({ ticket })
  })

  // ── Support: ticket detail + reply + assign ────────────────────────────────
  app.get('/support/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (_req, reply) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [open, inProgress, resolved, todayCount, urgent, avgResolve] = await Promise.all([
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { createdAt: { gte: today } } }),
      prisma.supportTicket.count({ where: { priority: 'URGENT', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.supportTicket.findMany({
        where: { status: 'RESOLVED', resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 100,
        orderBy: { resolvedAt: 'desc' },
      }),
    ])
    const totalMs = avgResolve.reduce((sum, t) => {
      if (!t.resolvedAt) return sum
      return sum + (t.resolvedAt.getTime() - t.createdAt.getTime())
    }, 0)
    const avgHours = avgResolve.length > 0 ? Math.round(totalMs / avgResolve.length / 3600000) : 0
    return reply.send({ open, inProgress, resolved, todayCount, urgent, avgResolveHours: avgHours })
  })

  app.get('/support/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, nameAr: true, subdomain: true, merchant: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' })
    return reply.send({ ticket })
  })

  app.post('/support/:id/reply', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { body: msgBody } = req.body as { body: string }
    const adminId = (req as any).user?.id ?? 'admin'

    const [message] = await Promise.all([
      prisma.ticketMessage.create({
        data: { ticketId: id, senderType: 'ADMIN', senderId: adminId, body: msgBody, attachments: [] },
      }),
      prisma.supportTicket.update({ where: { id }, data: { status: 'IN_PROGRESS', updatedAt: new Date() } }),
    ])
    return reply.status(201).send({ message })
  })

  app.patch('/support/:id/assign', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { assignedTo, assignedToName } = req.body as { assignedTo: string; assignedToName: string }
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { assignedTo, assignedToName },
    })
    return reply.send({ ticket })
  })

  // ── Health: recent webhook logs ────────────────────────────────────────────
  app.get('/health/recent-requests', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (_req, reply) => {
    const logs = await prisma.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        webhook: { select: { event: true, url: true, store: { select: { name: true, subdomain: true } } } },
      },
    })
    return reply.send({ logs })
  })

  // ── Plans stats (per-plan store counts + revenue) ─────────────────────────
  app.get('/plans/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (_req, reply) => {
    const [planCounts, planRevenue] = await Promise.all([
      prisma.store.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
      prisma.order.groupBy({
        by: ['storeId'],
        where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        _sum: { total: true },
      }),
    ])

    // Map store revenue to plan
    const storeRevMap: Record<string, number> = {}
    for (const r of planRevenue) {
      storeRevMap[r.storeId] = Number(r._sum.total ?? 0)
    }

    // Get plan per store
    const stores = await prisma.store.findMany({
      select: { id: true, plan: true },
    })

    const planRevMapByPlan: Record<string, number> = {}
    for (const s of stores) {
      planRevMapByPlan[s.plan] = (planRevMapByPlan[s.plan] ?? 0) + (storeRevMap[s.id] ?? 0)
    }

    return reply.send({
      planCounts: planCounts.map((p) => ({
        plan: p.plan,
        count: p._count.id,
        revenue: planRevMapByPlan[p.plan] ?? 0,
      })),
    })
  })

  // ── MRR / ARR Analytics ────────────────────────────────────────────────────
  app.get('/analytics/mrr', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    // MRR = sum of invoices paid in current month / plan prices
    const now = new Date()
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last12Months = new Date(now.getFullYear() - 1, now.getMonth(), 1)

    const invoices = await prisma.billingInvoice.findMany({
      where: { status: 'PAID', paidAt: { gte: last12Months } },
      select: { amountBD: true, paidAt: true, storeId: true },
    })

    // Group by month
    const monthlyMap: Record<string, number> = {}
    for (const inv of invoices) {
      if (!inv.paidAt) continue
      const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`
      monthlyMap[key] = (monthlyMap[key] ?? 0) + Number(inv.amountBD)
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
  app.get('/analytics/cohort', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
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
  app.get('/health/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (_req, reply) => {
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
  app.post('/billing/suspend-expired', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
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

  // ─────────────────────────── PLANS ADMIN ─────────────────────────────────────

  // ── List plans with configs + counts + revenue ──
  app.get('/plans', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (_req, reply) => {
    const PLAN_ORDER = ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']
    const DEFAULTS: Record<string, { priceBD: number; maxProducts: number; maxOrders: number; maxStaff: number; maxApps: number; features: string[] }> = {
      STARTER:    { priceBD: 0,   maxProducts: 100,  maxOrders: 50,   maxStaff: 1,  maxApps: 0,  features: ['100 منتج', '50 طلب/شهر', 'متجر واحد', 'دعم البريد'] },
      GROWTH:     { priceBD: 19,  maxProducts: 1000, maxOrders: 500,  maxStaff: 3,  maxApps: 5,  features: ['1,000 منتج', '500 طلب/شهر', 'كوبونات', 'إحصائيات متقدمة', 'دعم واتساب'] },
      PRO:        { priceBD: 49,  maxProducts: -1,   maxOrders: -1,   maxStaff: 10, maxApps: 20, features: ['منتجات غير محدودة', 'طلبات غير محدودة', 'API عامة', 'نقاط الولاء', 'أولوية الدعم'] },
      ENTERPRISE: { priceBD: 149, maxProducts: -1,   maxOrders: -1,   maxStaff: -1, maxApps: -1, features: ['كل مزايا Pro', 'مدير حساب مخصص', 'SLA 99.9%', 'تكامل مخصص', 'تقارير مخصصة'] },
    }

    const [configs, storeCounts, allStores] = await Promise.all([
      prisma.planConfig.findMany(),
      prisma.store.groupBy({ by: ['plan'], _count: { id: true } }),
      prisma.store.findMany({ select: { id: true, plan: true } }),
    ])

    const configMap = Object.fromEntries(configs.map(c => [c.plan, c]))
    const countMap = Object.fromEntries(storeCounts.map(s => [s.plan, s._count.id]))
    const storePlanMap = Object.fromEntries(allStores.map(s => [s.id, s.plan]))

    const invoices = await prisma.billingInvoice.findMany({
      where: { status: 'PAID' },
      select: { storeId: true, amountBD: true },
    })
    const revenueMap: Record<string, number> = {}
    for (const inv of invoices) {
      const plan = storePlanMap[inv.storeId]
      if (plan) revenueMap[plan] = (revenueMap[plan] ?? 0) + Number(inv.amountBD)
    }

    const plans = PLAN_ORDER.map(plan => {
      const db = configMap[plan]
      const def = DEFAULTS[plan]
      return {
        plan,
        priceBD: db ? Number(db.priceBD) : def.priceBD,
        maxProducts: db ? db.maxProducts : def.maxProducts,
        maxOrders: db ? db.maxOrders : def.maxOrders,
        maxStaff: db ? db.maxStaff : def.maxStaff,
        maxApps: db ? db.maxApps : def.maxApps,
        features: db ? db.features : def.features,
        storeCount: countMap[plan] ?? 0,
        revenue: revenueMap[plan] ?? 0,
      }
    })

    return reply.send({ plans })
  })

  // ── Upsert plan config ──
  app.put('/plans/:plan', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req, reply) => {
    const { plan } = req.params as { plan: string }
    if (!['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return reply.status(400).send({ error: 'Invalid plan' })
    }
    const { priceBD, maxProducts, maxOrders, maxStaff, maxApps, features } = req.body as any
    const config = await prisma.planConfig.upsert({
      where: { plan: plan as any },
      create: { plan: plan as any, priceBD, maxProducts, maxOrders, maxStaff, maxApps, features: features ?? [] },
      update: { priceBD, maxProducts, maxOrders, maxStaff, maxApps, features: features ?? [] },
    })
    return reply.send({ success: true, config })
  })

  // ─────────────────────────── BILLING ADMIN ───────────────────────────────────

  // ── List all invoices (admin) ──
  app.get('/billing/invoices', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    const { page = '1', limit = '20', status, search } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (status && status !== 'ALL') where.status = status
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { store: { name: { contains: search, mode: 'insensitive' } } },
        { store: { nameAr: { contains: search, mode: 'insensitive' } } },
        { store: { subdomain: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [invoices, total, paidAgg, pendingAgg, overdueAgg, cancelledAgg] = await Promise.all([
      prisma.billingInvoice.findMany({
        where,
        include: {
          store: {
            select: {
              id: true, name: true, nameAr: true, subdomain: true, plan: true,
              merchant: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.billingInvoice.count({ where }),
      prisma.billingInvoice.aggregate({ where: { status: 'PAID' }, _sum: { amountBD: true } }),
      prisma.billingInvoice.aggregate({ where: { status: 'PENDING' }, _sum: { amountBD: true } }),
      prisma.billingInvoice.aggregate({ where: { status: 'OVERDUE' }, _sum: { amountBD: true } }),
      prisma.billingInvoice.aggregate({ where: { status: 'CANCELLED' }, _sum: { amountBD: true } }),
    ])

    return reply.send({
      invoices,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stats: {
        paid: Number(paidAgg._sum.amountBD ?? 0),
        pending: Number(pendingAgg._sum.amountBD ?? 0),
        overdue: Number(overdueAgg._sum.amountBD ?? 0),
        cancelled: Number(cancelledAgg._sum.amountBD ?? 0),
      },
    })
  })

  // ── Invoice detail ──
  app.get('/billing/invoices/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true, name: true, nameAr: true, subdomain: true, plan: true,
            merchant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    })
    if (!invoice) return reply.status(404).send({ error: 'Invoice not found' })
    return reply.send({ invoice })
  })

  // ── Update invoice (cancel / markPaid / markOverdue / discount) ──
  app.patch('/billing/invoices/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { action, paymentRef, discountBD, discountNote } = req.body as any

    const invoice = await prisma.billingInvoice.findUnique({ where: { id } })
    if (!invoice) return reply.status(404).send({ error: 'Invoice not found' })

    let data: any = {}
    if (action === 'cancel')      data = { status: 'CANCELLED' }
    else if (action === 'markPaid')   data = { status: 'PAID', paidAt: new Date(), paymentRef: paymentRef ?? invoice.paymentRef }
    else if (action === 'markOverdue') data = { status: 'OVERDUE' }
    else if (action === 'discount') {
      const newAmount = Math.max(0, Number(invoice.amountBD) - Number(discountBD ?? 0))
      data = { amountBD: newAmount, discountBD, discountNote: discountNote ?? null, notes: discountNote ?? invoice.notes }
    } else {
      return reply.status(400).send({ error: 'Unknown action' })
    }

    const updated = await prisma.billingInvoice.update({ where: { id }, data })
    return reply.send({ success: true, invoice: updated })
  })

  // ── Create manual invoice ──
  app.post('/billing/invoices', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    const { storeId, plan, amountBD, periodStart, periodEnd, status, paymentRef, notes } = req.body as any
    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (!store) return reply.status(404).send({ error: 'Store not found' })

    const now = new Date()
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const rand = Math.floor(Math.random() * 9000) + 1000
    const invoiceNumber = `INV-${yyyymm}-${rand}`

    const invoice = await prisma.billingInvoice.create({
      data: {
        storeId,
        plan: plan ?? store.plan,
        amountBD,
        periodStart: periodStart ? new Date(periodStart) : now,
        periodEnd: periodEnd ? new Date(periodEnd) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: status ?? 'PENDING',
        paidAt: status === 'PAID' ? now : null,
        paymentRef: paymentRef ?? null,
        notes: notes ?? null,
        invoiceNumber,
      },
    })
    return reply.status(201).send({ invoice })
  })

  // ── Revenue report (last 12 months breakdown) ──
  app.get('/billing/revenue-report', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (_req, reply) => {
    const now = new Date()
    const last12 = new Date(now.getFullYear() - 1, now.getMonth(), 1)

    const invoices = await prisma.billingInvoice.findMany({
      where: { createdAt: { gte: last12 } },
      select: { amountBD: true, status: true, createdAt: true },
    })

    const monthMap: Record<string, { paid: number; pending: number; overdue: number; cancelled: number }> = {}
    for (const inv of invoices) {
      const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap[key]) monthMap[key] = { paid: 0, pending: 0, overdue: 0, cancelled: 0 }
      const amount = Number(inv.amountBD)
      if (inv.status === 'PAID') monthMap[key].paid += amount
      else if (inv.status === 'PENDING') monthMap[key].pending += amount
      else if (inv.status === 'OVERDUE') monthMap[key].overdue += amount
      else if (inv.status === 'CANCELLED') monthMap[key].cancelled += amount
    }

    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    const totals = {
      paid: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amountBD), 0),
      pending: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.amountBD), 0),
      overdue: invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.amountBD), 0),
      cancelled: invoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + Number(i.amountBD), 0),
    }

    return reply.send({ monthly, totals })
  })

  // ─────────────────────────── SUBSCRIPTIONS ADMIN ─────────────────────────────

  // ── Expired subscriptions ──
  app.get('/subscriptions/expired', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req, reply) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const now = new Date()

    const where: any = { planExpiresAt: { lt: now }, plan: { not: 'STARTER' } }
    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          merchant: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { orders: true, customers: true } },
        },
        orderBy: { planExpiresAt: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.store.count({ where }),
    ])
    return reply.send({ stores, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })

  // ── Trial subscriptions ──
  app.get('/subscriptions/trial', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req, reply) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const now = new Date()

    const where = { trialEndsAt: { gte: now } }
    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          merchant: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { orders: true, customers: true } },
        },
        orderBy: { trialEndsAt: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.store.count({ where }),
    ])
    return reply.send({ stores, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })

  // ── Notify expiring subscriptions (7/3/1 day marks) ──
  app.post('/billing/notify-expiring', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (_req, reply) => {
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const expiringStores = await prisma.store.findMany({
      where: {
        isActive: true,
        plan: { not: 'STARTER' as any },
        planExpiresAt: { gte: now, lte: in7Days },
      },
      include: { merchant: { select: { firstName: true, email: true } } },
    })

    let notified = 0
    for (const store of expiringStores) {
      const daysLeft = store.planExpiresAt
        ? Math.ceil((store.planExpiresAt.getTime() - now.getTime()) / 86400000)
        : 0
      if (![7, 3, 1].includes(daysLeft)) continue

      await sendCustomAdminEmail({
        to: store.merchant.email,
        firstName: store.merchant.firstName,
        subject: `تنبيه: اشتراكك في ${store.nameAr || store.name} ينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`,
        body: `اشتراكك في متجر "${store.nameAr || store.name}" على باقة ${store.plan} سينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}. يرجى تجديد الاشتراك للحفاظ على استمرارية متجرك.`,
      }).catch(() => {})

      notified++
    }

    return reply.send({ notified, total: expiringStores.length })
  })

  // ── Apps: action routes ────────────────────────────────────────────────────
  app.get('/apps/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (_req, reply) => {
    const [total, pending, official, installs] = await Promise.all([
      prisma.app.count(),
      prisma.app.count({ where: { isApproved: false, isActive: true } }),
      prisma.app.count({ where: { isOfficial: true } }),
      prisma.installedApp.count({ where: { isActive: true } }),
    ])
    return reply.send({ total, pending, official, totalInstalls: installs })
  })

  app.post('/apps/:id/approve', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.app.update({ where: { id }, data: { isApproved: true, isActive: true } })
    return reply.send({ app: updated })
  })

  app.post('/apps/:id/reject', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.app.update({ where: { id }, data: { isApproved: false, isActive: false } })
    return reply.send({ app: updated })
  })

  app.post('/apps/:id/disable-all', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const [app_, affected] = await Promise.all([
      prisma.app.update({ where: { id }, data: { isActive: false } }),
      prisma.installedApp.updateMany({ where: { appId: id }, data: { isActive: false } }),
    ])
    return reply.send({ app: app_, affected: affected.count })
  })

  app.post('/apps/:id/enable', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.app.update({ where: { id }, data: { isActive: true } })
    return reply.send({ app: updated })
  })

  // ── Themes: action routes ──────────────────────────────────────────────────
  app.get('/themes/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (_req, reply) => {
    const [total, pending, featured, revenueAgg] = await Promise.all([
      prisma.theme.count(),
      prisma.theme.count({ where: { isApproved: false, isActive: true } }),
      prisma.theme.count({ where: { isFeatured: true } }),
      prisma.themePurchase.aggregate({ _sum: { amount: true } }),
    ])
    return reply.send({ total, pending, featured, totalRevenue: Number(revenueAgg._sum.amount ?? 0) })
  })

  app.post('/themes/:id/approve', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.theme.update({ where: { id }, data: { isApproved: true, isActive: true } })
    return reply.send({ theme: updated })
  })

  app.post('/themes/:id/reject', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.theme.update({ where: { id }, data: { isApproved: false, isActive: false } })
    return reply.send({ theme: updated })
  })

  app.post('/themes/:id/toggle-featured', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const current = await prisma.theme.findUnique({ where: { id }, select: { isFeatured: true } })
    if (!current) return reply.status(404).send({ error: 'Theme not found' })
    const updated = await prisma.theme.update({ where: { id }, data: { isFeatured: !current.isFeatured } })
    return reply.send({ theme: updated })
  })

  app.get('/themes', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { page = '1', limit = '18', search = '' } = req.query as Record<string, string>
    const take = Math.max(1, Math.min(100, parseInt(limit, 10) || 18))
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take
    const query = search.trim()

    const where: any = query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { nameAr: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { authorName: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        }
      : {}

    const [themes, total] = await Promise.all([
      prisma.theme.findMany({
        where,
        include: { _count: { select: { purchases: true } }, assets: { where: { key: { in: [THEME_MANIFEST_ASSET_KEY, ...THEME_CHANGELOG_ASSET_KEYS] } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.theme.count({ where }),
    ])

    return reply.send({
      themes: themes.map((theme) => {
        const manifest = resolveThemeManifestFromAssets(theme.assets, {
          slug: theme.slug,
          name: theme.name,
          nameAr: theme.nameAr,
          description: theme.description ?? undefined,
          descriptionAr: theme.descriptionAr ?? undefined,
          version: '1.0.0',
          price: Number(theme.price),
          tags: theme.tags,
          previewUrl: theme.previewUrl ?? undefined,
          thumbnailUrl: theme.thumbnailUrl ?? undefined,
          demoUrl: theme.demoUrl ?? undefined,
        })
        return {
          ...theme,
          version: manifest.version,
          changelog: resolveThemeChangelogFromAssets(theme.assets),
        }
      }),
      total,
      pages: Math.max(1, Math.ceil(total / take)),
    })
  })

  app.post('/themes', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const result = adminThemeSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const theme = await prisma.theme.create({
      data: {
        slug: result.data.slug,
        name: result.data.name,
        nameAr: result.data.nameAr,
        description: result.data.description,
        descriptionAr: result.data.descriptionAr,
        thumbnailUrl: result.data.thumbnailUrl,
        previewUrl: result.data.previewUrl,
        demoUrl: result.data.demoUrl,
        downloadUrl: result.data.downloadUrl,
        authorName: result.data.authorName,
        authorEmail: result.data.authorEmail,
        price: result.data.price,
        isPremium: result.data.isPremium || result.data.price > 0,
        tags: result.data.tags,
      },
      include: { _count: { select: { purchases: true } } },
    })

    await syncThemeMetadataAssets({
      themeId: theme.id,
      manifest: themePackageManifestSchema.parse({
        slug: result.data.slug,
        name: result.data.name,
        nameAr: result.data.nameAr,
        description: result.data.description,
        descriptionAr: result.data.descriptionAr,
        version: result.data.version,
        price: result.data.price,
        tags: result.data.tags,
        previewUrl: result.data.previewUrl,
        thumbnailUrl: result.data.thumbnailUrl,
        demoUrl: result.data.demoUrl,
      }),
      changelog: result.data.changelog,
    })

    return reply.status(201).send({ theme })
  })

  app.patch('/themes/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const result = adminThemeSchema.partial().safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const data = { ...result.data } as Record<string, unknown>
    const nextVersion = typeof data.version === 'string' ? data.version : undefined
    const nextChangelog = typeof data.changelog === 'string' ? data.changelog : undefined
    delete data.version
    delete data.changelog
    if (typeof data.price === 'number' && typeof data.isPremium !== 'boolean') {
      data.isPremium = data.price > 0
    }

    const theme = await prisma.theme.update({
      where: { id },
      data,
      include: { _count: { select: { purchases: true } }, assets: true },
    })

    const currentManifest = resolveThemeManifestFromAssets(theme.assets, {
      slug: theme.slug,
      name: theme.name,
      nameAr: theme.nameAr,
      description: theme.description ?? undefined,
      descriptionAr: theme.descriptionAr ?? undefined,
      version: '1.0.0',
      price: Number(theme.price),
      tags: theme.tags,
      previewUrl: theme.previewUrl ?? undefined,
      thumbnailUrl: theme.thumbnailUrl ?? undefined,
      demoUrl: theme.demoUrl ?? undefined,
    })

    await syncThemeMetadataAssets({
      themeId: theme.id,
      manifest: themePackageManifestSchema.parse({
        slug: theme.slug,
        name: theme.name,
        nameAr: theme.nameAr,
        description: theme.description ?? undefined,
        descriptionAr: theme.descriptionAr ?? undefined,
        version: nextVersion ?? currentManifest.version,
        price: Number(theme.price),
        tags: theme.tags,
        previewUrl: theme.previewUrl ?? undefined,
        thumbnailUrl: theme.thumbnailUrl ?? undefined,
        demoUrl: theme.demoUrl ?? undefined,
      }),
      changelog: nextChangelog ?? resolveThemeChangelogFromAssets(theme.assets) ?? undefined,
    })

    return reply.send({ theme })
  })

  app.delete('/themes/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.theme.delete({ where: { id } })
    return reply.send({ success: true })
  })

  app.post('/themes/import-package', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const file = await req.file()
    if (!file) return reply.status(400).send({ error: 'ملف الحزمة مطلوب' })

    try {
      const parsedPackage = parseThemePackageBuffer(await file.toBuffer())
      const manifest = themePackageManifestSchema.parse(parsedPackage.manifest)
      const adminMerchant = await prisma.merchant.findUnique({
        where: { id: (req.user as any).id },
        select: { email: true, firstName: true, lastName: true },
      })

      const existingTheme = await prisma.theme.findUnique({ where: { slug: manifest.slug } })
      const theme = existingTheme
        ? await prisma.theme.update({
            where: { id: existingTheme.id },
            data: {
              name: manifest.name,
              nameAr: manifest.nameAr,
              description: manifest.description,
              descriptionAr: manifest.descriptionAr,
              previewUrl: manifest.previewUrl,
              thumbnailUrl: manifest.thumbnailUrl,
              demoUrl: manifest.demoUrl,
              price: manifest.price,
              isPremium: manifest.price > 0,
              tags: manifest.tags,
              isApproved: false,
            },
          })
        : await prisma.theme.create({
            data: {
              slug: manifest.slug,
              name: manifest.name,
              nameAr: manifest.nameAr,
              description: manifest.description,
              descriptionAr: manifest.descriptionAr,
              previewUrl: manifest.previewUrl,
              thumbnailUrl: manifest.thumbnailUrl,
              demoUrl: manifest.demoUrl,
              price: manifest.price,
              isPremium: manifest.price > 0,
              tags: manifest.tags,
              authorName: `${adminMerchant?.firstName ?? ''} ${adminMerchant?.lastName ?? ''}`.trim() || adminMerchant?.email || 'Bazar Admin',
              authorEmail: adminMerchant?.email,
              isApproved: false,
            },
          })

      await prisma.themeAsset.deleteMany({ where: { themeId: theme.id } })
      await prisma.themeAsset.createMany({
        data: [buildThemeManifestAsset(manifest), ...parsedPackage.assets].map((asset) => ({
          themeId: theme.id,
          key: asset.key,
          content: asset.content,
          mimeType: asset.mimeType,
        })),
      })

      return reply.send({
        message: existingTheme ? 'تم تحديث حزمة الثيم وإعادتها للمراجعة' : 'تم استيراد حزمة الثيم بنجاح',
        theme,
        assetsCount: parsedPackage.assets.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر استيراد الحزمة'
      return reply.status(400).send({ error: message })
    }
  })

  app.get('/themes/:id/export-package', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const theme = await prisma.theme.findUnique({
      where: { id },
      include: { assets: { orderBy: { key: 'asc' } } },
    })

    if (!theme) return reply.status(404).send({ error: 'القالب غير موجود' })

    const manifest = resolveThemeManifestFromAssets(theme.assets, {
      slug: theme.slug,
      name: theme.name,
      nameAr: theme.nameAr,
      description: theme.description ?? undefined,
      descriptionAr: theme.descriptionAr ?? undefined,
      version: '1.0.0',
      price: Number(theme.price),
      tags: theme.tags,
      previewUrl: theme.previewUrl ?? undefined,
      thumbnailUrl: theme.thumbnailUrl ?? undefined,
      demoUrl: theme.demoUrl ?? undefined,
    })

    const packageBuffer = buildThemePackageBuffer({
      manifest,
      assets: theme.assets,
    })

    reply.header('Content-Type', 'application/zip')
    reply.header('Content-Disposition', `attachment; filename="${theme.slug}.zip"`)
    return reply.send(packageBuffer)
  })

  // ─────────────────────────── ANNOUNCEMENTS (ADMIN) ──────────────────────────

  // GET all announcements (admin)
  app.get('/admin/announcements', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })
    return reply.send({ announcements })
  })

  // POST create announcement
  app.post('/admin/announcements', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { title, titleAr, body, bodyAr, type, isActive, isPinned, targetPlan, startsAt, endsAt } = req.body as any
    if (!title || !titleAr) return reply.code(400).send({ error: 'title and titleAr required' })
    const ann = await prisma.announcement.create({
      data: {
        title, titleAr,
        body: body ?? null, bodyAr: bodyAr ?? null,
        type: type ?? 'INFO',
        isActive: isActive ?? true,
        isPinned: isPinned ?? false,
        targetPlan: targetPlan ?? null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    })
    return reply.code(201).send({ announcement: ann })
  })

  // PUT update announcement
  app.put('/admin/announcements/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const d = req.body as any
    const ann = await prisma.announcement.update({
      where: { id },
      data: {
        title: d.title, titleAr: d.titleAr,
        body: d.body ?? null, bodyAr: d.bodyAr ?? null,
        type: d.type ?? undefined,
        isActive: d.isActive ?? undefined,
        isPinned: d.isPinned ?? undefined,
        targetPlan: d.targetPlan ?? null,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
      },
    })
    return reply.send({ announcement: ann })
  })

  // DELETE announcement
  app.delete('/admin/announcements/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.announcement.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // PATCH toggle active
  app.patch('/admin/announcements/:id/toggle', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const current = await prisma.announcement.findUnique({ where: { id }, select: { isActive: true } })
    if (!current) return reply.status(404).send({ error: 'Announcement not found' })
    const ann = await prisma.announcement.update({ where: { id }, data: { isActive: !current.isActive } })
    return reply.send({ announcement: ann })
  })

  // ─────────────────────────── PLATFORM BLOG ───────────────────────────────────

  // GET all platform blog posts (admin)
  app.get('/admin/platform-blog', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { category, published } = req.query as any
    const where: any = {}
    if (category) where.category = category
    if (published === 'true') where.isPublished = true
    if (published === 'false') where.isPublished = false

    const posts = await prisma.platformBlogPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, titleAr: true, slug: true,
        category: true, isPublished: true, publishedAt: true,
        authorName: true, tags: true, views: true,
        excerpt: true, coverImage: true, createdAt: true, updatedAt: true,
      },
    })
    return reply.send({ posts })
  })

  // GET single platform blog post
  app.get('/admin/platform-blog/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const post = await prisma.platformBlogPost.findUnique({ where: { id } })
    if (!post) return reply.status(404).send({ error: 'Post not found' })
    return reply.send({ post })
  })

  // POST create platform blog post
  app.post('/admin/platform-blog', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { title, titleAr, slug, content, contentAr, excerpt, excerptAr, coverImage, category, isPublished, tags, authorName } = req.body as any
    if (!title || !titleAr || !slug || !content) return reply.code(400).send({ error: 'title, titleAr, slug, content required' })
    const post = await prisma.platformBlogPost.create({
      data: {
        title, titleAr, slug,
        content, contentAr: contentAr ?? null,
        excerpt: excerpt ?? null, excerptAr: excerptAr ?? null,
        coverImage: coverImage ?? null,
        category: category ?? 'news',
        isPublished: isPublished ?? false,
        publishedAt: isPublished ? new Date() : null,
        tags: tags ?? [],
        authorName: authorName ?? 'فريق المنصة',
      },
    })
    return reply.code(201).send({ post })
  })

  // PUT update platform blog post
  app.put('/admin/platform-blog/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const d = req.body as any
    const post = await prisma.platformBlogPost.update({
      where: { id },
      data: {
        title: d.title, titleAr: d.titleAr,
        slug: d.slug, content: d.content,
        contentAr: d.contentAr ?? null,
        excerpt: d.excerpt ?? null, excerptAr: d.excerptAr ?? null,
        coverImage: d.coverImage ?? null,
        category: d.category ?? undefined,
        tags: d.tags ?? undefined,
        authorName: d.authorName ?? undefined,
      },
    })
    return reply.send({ post })
  })

  // PATCH toggle publish
  app.patch('/admin/platform-blog/:id/publish', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const current = await prisma.platformBlogPost.findUnique({ where: { id }, select: { isPublished: true } })
    if (!current) return reply.status(404).send({ error: 'Post not found' })
    const post = await prisma.platformBlogPost.update({
      where: { id },
      data: {
        isPublished: !current.isPublished,
        publishedAt: !current.isPublished ? new Date() : null,
      },
    })
    return reply.send({ post })
  })

  // DELETE platform blog post
  app.delete('/admin/platform-blog/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.platformBlogPost.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─────────────────────────── EMAIL TEMPLATES ─────────────────────────────────

  // GET all email templates
  app.get('/admin/email-templates', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const templates = await prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } })

    // Seed defaults if empty
    if (templates.length === 0) {
      const defaults = [
        {
          key: 'welcome',
          name: 'Welcome Email',
          nameAr: 'إيميل الترحيب',
          subject: 'Welcome to BahrainStore!',
          subjectAr: 'مرحباً بك في متجر البحرين!',
          body: `<h1>Welcome, {{merchant_name}}!</h1><p>Your store <strong>{{store_name}}</strong> is now live.<br>Start selling at <a href="{{store_url}}">{{store_url}}</a></p>`,
          bodyAr: `<h1>أهلاً {{merchant_name}}!</h1><p>متجرك <strong>{{store_name}}</strong> جاهز الآن.<br>ابدأ البيع على <a href="{{store_url}}">{{store_url}}</a></p>`,
          vars: ['{{merchant_name}}', '{{store_name}}', '{{store_url}}'],
        },
        {
          key: 'subscription_renewal',
          name: 'Subscription Renewal',
          nameAr: 'تجديد الاشتراك',
          subject: 'Your subscription has been renewed — {{store_name}}',
          subjectAr: 'تم تجديد اشتراكك — {{store_name}}',
          body: `<h2>Subscription Renewed</h2><p>Hi {{merchant_name}},<br>Your <strong>{{plan_name}}</strong> plan for {{store_name}} has been renewed until {{expiry_date}}.</p>`,
          bodyAr: `<h2>تم تجديد الاشتراك</h2><p>مرحباً {{merchant_name}},<br>تم تجديد خطة <strong>{{plan_name}}</strong> لمتجر {{store_name}} حتى {{expiry_date}}.</p>`,
          vars: ['{{merchant_name}}', '{{store_name}}', '{{plan_name}}', '{{expiry_date}}', '{{amount}}'],
        },
        {
          key: 'subscription_expiry_warning',
          name: 'Subscription Expiry Warning',
          nameAr: 'تحذير انتهاء الاشتراك',
          subject: 'Your subscription expires in {{days_left}} days — {{store_name}}',
          subjectAr: 'اشتراكك ينتهي خلال {{days_left}} أيام — {{store_name}}',
          body: `<h2>Subscription Expiring Soon</h2><p>Hi {{merchant_name}},<br>Your <strong>{{plan_name}}</strong> plan for {{store_name}} expires on <strong>{{expiry_date}}</strong>.<br><a href="{{renewal_url}}">Renew now</a></p>`,
          bodyAr: `<h2>تنبيه: اشتراكك على وشك الانتهاء</h2><p>مرحباً {{merchant_name}},<br>خطة <strong>{{plan_name}}</strong> لمتجر {{store_name}} تنتهي في <strong>{{expiry_date}}</strong>.<br><a href="{{renewal_url}}">جدد الآن</a></p>`,
          vars: ['{{merchant_name}}', '{{store_name}}', '{{plan_name}}', '{{expiry_date}}', '{{days_left}}', '{{renewal_url}}'],
        },
      ]
      const created = await Promise.all(defaults.map(d => prisma.emailTemplate.create({ data: d })))
      return reply.send({ templates: created })
    }

    return reply.send({ templates })
  })

  // PUT update email template
  app.put('/admin/email-templates/:key', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { key } = req.params as any
    const { subject, subjectAr, body, bodyAr, name, nameAr, vars } = req.body as any
    const template = await prisma.emailTemplate.update({
      where: { key },
      data: {
        subject: subject ?? undefined,
        subjectAr: subjectAr ?? undefined,
        body: body ?? undefined,
        bodyAr: bodyAr ?? undefined,
        name: name ?? undefined,
        nameAr: nameAr ?? undefined,
        vars: vars ?? undefined,
      },
    })
    return reply.send({ template })
  })

  // GET preview email template (replace vars with sample data)
  app.get('/admin/email-templates/:key/preview', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req: any, reply) => {
    const { key } = req.params as any
    const { lang } = req.query as any
    const template = await prisma.emailTemplate.findUnique({ where: { key } })
    if (!template) return reply.status(404).send({ error: 'Template not found' })

    const sampleVars: Record<string, string> = {
      '{{merchant_name}}': 'محمد العلي',
      '{{store_name}}': 'متجر النخبة',
      '{{store_url}}': 'https://elite.bahrainstore.com',
      '{{plan_name}}': 'PRO',
      '{{expiry_date}}': '2026-06-01',
      '{{days_left}}': '7',
      '{{renewal_url}}': 'https://dashboard.bahrainstore.com/billing',
      '{{amount}}': '29.99 BHD',
    }

    const isAr = lang === 'ar'
    let html = isAr ? template.bodyAr : template.body
    let subject = isAr ? template.subjectAr : template.subject
    Object.entries(sampleVars).forEach(([k, v]) => {
      html = html.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v)
      subject = subject.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v)
    })

    return reply.send({ subject, html, lang: isAr ? 'ar' : 'en' })
  })

  // ─────────────────────────── PLATFORM ROLES ──────────────────────────────────

  // GET all roles
  app.get('/admin/roles', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const roles = await prisma.platformRole.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ roles })
  })

  // POST create role
  app.post('/admin/roles', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { name, nameAr, description, canViewMerchants, canDisableStore, canReplyTickets, canEditPlans, canManageApps, canViewFinancials, canViewAuditLog, canManageContent, canReviewKYC, canManageTeam } = req.body as any
    if (!name || !nameAr) return reply.code(400).send({ error: 'name and nameAr required' })
    const role = await prisma.platformRole.create({
      data: {
        name: name.toUpperCase(),
        nameAr,
        description: description ?? null,
        canViewMerchants: canViewMerchants ?? false,
        canDisableStore: canDisableStore ?? false,
        canReplyTickets: canReplyTickets ?? false,
        canEditPlans: canEditPlans ?? false,
        canManageApps: canManageApps ?? false,
        canViewFinancials: canViewFinancials ?? false,
        canViewAuditLog: canViewAuditLog ?? false,
        canManageContent: canManageContent ?? false,
        canReviewKYC: canReviewKYC ?? false,
        canManageTeam: canManageTeam ?? false,
      },
    })
    await prisma.auditLog.create({
      data: {
        actorId: (req.user as any).id,
        actorType: 'ADMIN',
        actorName: `${(req.user as any).firstName ?? ''} ${(req.user as any).lastName ?? ''}`.trim(),
        actorEmail: (req.user as any).email ?? '',
        action: 'CREATE_ROLE',
        entityType: 'ROLE',
        entityId: role.id,
        entityName: role.name,
        ip: req.ip,
      },
    })
    return reply.code(201).send({ role })
  })

  // PUT update role
  app.put('/admin/roles/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const d = req.body as any
    const existing = await prisma.platformRole.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Role not found' })
    if (existing.isSystem) return reply.status(400).send({ error: 'لا يمكن تعديل الدور النظامي' })
    const role = await prisma.platformRole.update({
      where: { id },
      data: {
        nameAr: d.nameAr ?? undefined,
        description: d.description ?? null,
        canViewMerchants: d.canViewMerchants ?? undefined,
        canDisableStore: d.canDisableStore ?? undefined,
        canReplyTickets: d.canReplyTickets ?? undefined,
        canEditPlans: d.canEditPlans ?? undefined,
        canManageApps: d.canManageApps ?? undefined,
        canViewFinancials: d.canViewFinancials ?? undefined,
        canViewAuditLog: d.canViewAuditLog ?? undefined,
        canManageContent: d.canManageContent ?? undefined,
        canReviewKYC: d.canReviewKYC ?? undefined,
        canManageTeam: d.canManageTeam ?? undefined,
      },
    })
    await prisma.auditLog.create({
      data: {
        actorId: (req.user as any).id,
        actorType: 'ADMIN',
        actorName: `${(req.user as any).firstName ?? ''} ${(req.user as any).lastName ?? ''}`.trim(),
        actorEmail: (req.user as any).email ?? '',
        action: 'UPDATE_ROLE',
        entityType: 'ROLE',
        entityId: role.id,
        entityName: role.name,
        ip: req.ip,
      },
    })
    return reply.send({ role })
  })

  // DELETE role (only non-system roles with no members)
  app.delete('/admin/roles/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const role = await prisma.platformRole.findUnique({ where: { id }, include: { _count: { select: { members: true } } } })
    if (!role) return reply.status(404).send({ error: 'Role not found' })
    if (role.isSystem) return reply.status(400).send({ error: 'Cannot delete system role' })
    if (role._count.members > 0) return reply.status(400).send({ error: `الدور مُعيَّن لـ ${role._count.members} موظف` })
    await prisma.platformRole.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─────────────────────────── PLATFORM TEAM ───────────────────────────────────

  // GET staff list
  app.get('/admin/team', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { status } = req.query as any
    const where: any = {}
    if (status === 'active') where.isActive = true
    if (status === 'inactive') where.isActive = false

    const staff = await prisma.platformStaff.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ staff })
  })

  // POST invite staff member
  app.post('/admin/team', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { email, firstName, lastName, roleId } = req.body as any
    if (!email || !firstName || !lastName || !roleId) {
      return reply.code(400).send({ error: 'email, firstName, lastName, roleId required' })
    }
    const role = await prisma.platformRole.findUnique({ where: { id: roleId } })
    if (!role) return reply.status(404).send({ error: 'Role not found' })

    const inviteToken = crypto.randomBytes(32).toString('hex')
    const existing = await prisma.platformStaff.findUnique({ where: { email } })
    if (existing) return reply.status(409).send({ error: 'موظف بهذا الإيميل موجود بالفعل' })

    const member = await prisma.platformStaff.create({
      data: { email, firstName, lastName, roleId, inviteToken },
      include: { role: true },
    })

    await prisma.auditLog.create({
      data: {
        actorId: (req.user as any).id,
        actorType: 'ADMIN',
        actorName: `${(req.user as any).firstName ?? ''} ${(req.user as any).lastName ?? ''}`.trim(),
        actorEmail: (req.user as any).email ?? '',
        action: 'INVITE_STAFF',
        entityType: 'STAFF',
        entityId: member.id,
        entityName: `${firstName} ${lastName}`,
        details: { email, role: role.name },
        ip: req.ip,
      },
    })

    return reply.code(201).send({ member })
  })

  // PATCH update staff (role / active)
  app.patch('/admin/team/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const { roleId, isActive } = req.body as any
    const existing = await prisma.platformStaff.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Staff not found' })

    if (roleId) {
      const role = await prisma.platformRole.findUnique({ where: { id: roleId }, select: { id: true } })
      if (!role) return reply.status(404).send({ error: 'Role not found' })
    }

    const member = await prisma.platformStaff.update({
      where: { id },
      data: {
        roleId: roleId ?? undefined,
        isActive: isActive ?? undefined,
      },
      include: { role: true },
    })

    await prisma.auditLog.create({
      data: {
        actorId: (req.user as any).id,
        actorType: 'ADMIN',
        actorName: `${(req.user as any).firstName ?? ''} ${(req.user as any).lastName ?? ''}`.trim(),
        actorEmail: (req.user as any).email ?? '',
        action: isActive === false ? 'DISABLE_STAFF' : roleId ? 'UPDATE_STAFF_ROLE' : 'UPDATE_STAFF',
        entityType: 'STAFF',
        entityId: id,
        entityName: `${existing.firstName} ${existing.lastName}`,
        ip: req.ip,
      },
    })

    return reply.send({ member })
  })

  // DELETE staff
  app.delete('/admin/team/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageTeam')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const existing = await prisma.platformStaff.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Staff not found' })
    await prisma.platformStaff.delete({ where: { id } })
    await prisma.auditLog.create({
      data: {
        actorId: (req.user as any).id,
        actorType: 'ADMIN',
        actorName: `${(req.user as any).firstName ?? ''} ${(req.user as any).lastName ?? ''}`.trim(),
        actorEmail: (req.user as any).email ?? '',
        action: 'DELETE_STAFF',
        entityType: 'STAFF',
        entityId: id,
        entityName: `${existing.firstName} ${existing.lastName}`,
        ip: req.ip,
      },
    })
    return reply.send({ success: true })
  })

  // ─────────────────────────── AUDIT LOG ───────────────────────────────────────

  // GET audit logs (paginated, filterable)
  app.get('/admin/audit', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (req: any, reply) => {
    const { page = '1', limit = '50', actorId, action, entityType, from, to } = req.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (actorId) where.actorId = actorId
    if (action) where.action = action
    if (entityType) where.entityType = entityType
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ])

    return reply.send({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  // GET audit log stats (actor breakdown, action counts)
  app.get('/admin/audit/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (req: any, reply) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [total, todayCount, topActions] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ])
    return reply.send({ total, todayCount, topActions: topActions.map(a => ({ action: a.action, count: a._count.action })) })
  })

  // GET distinct action types (for filter dropdown)
  app.get('/admin/audit/actions', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (req: any, reply) => {
    const actions = await prisma.auditLog.groupBy({
      by: ['action'],
      orderBy: { _count: { action: 'desc' } },
      _count: { action: true },
    })
    return reply.send({ actions: actions.map(a => a.action) })
  })

  // ─────────────────────────── PARTNERS (برنامج الشركاء) ───────────────────────

  // GET all partners
  app.get('/admin/partners', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { status } = req.query as any
    const where: any = {}
    if (status) where.status = status
    const partners = await prisma.partner.findMany({
      where,
      include: { _count: { select: { referrals: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const stats = {
      total: await prisma.partner.count(),
      pending: await prisma.partner.count({ where: { status: 'PENDING' } }),
      approved: await prisma.partner.count({ where: { status: 'APPROVED' } }),
    }
    return reply.send({ partners, stats })
  })

  // GET partner referrals
  app.get('/admin/partners/:id/referrals', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { id } = req.params as any
    const referrals = await prisma.partnerReferral.findMany({
      where: { partnerId: id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ referrals })
  })

  // POST create partner manually
  app.post('/admin/partners', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { companyName, contactName, email, phone, website, type, commissionRate } = req.body as any
    if (!companyName || !contactName || !email) return reply.code(400).send({ error: 'companyName, contactName, email required' })
    const existing = await prisma.partner.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'شريك بهذا الإيميل موجود بالفعل' })
    const referralCode = `PARTNER-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const partner = await prisma.partner.create({
      data: {
        companyName, contactName, email,
        phone: phone ?? null,
        website: website ?? null,
        type: type ?? 'AGENCY',
        commissionRate: commissionRate ?? 0.20,
        referralCode,
        status: 'APPROVED',
      },
    })
    return reply.code(201).send({ partner })
  })

  // PATCH update partner (commission, badge, status)
  app.patch('/admin/partners/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { id } = req.params as any
    const { commissionRate, certifiedBadge, status, companyName, contactName } = req.body as any
    const partner = await prisma.partner.update({
      where: { id },
      data: {
        commissionRate: commissionRate ?? undefined,
        certifiedBadge: certifiedBadge ?? undefined,
        status: status ?? undefined,
        companyName: companyName ?? undefined,
        contactName: contactName ?? undefined,
      },
    })
    return reply.send({ partner })
  })

  // POST record commission payment
  app.post('/admin/partners/:id/pay', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { id } = req.params as any
    const { amount } = req.body as any
    if (!amount || isNaN(parseFloat(amount))) return reply.code(400).send({ error: 'amount required' })
    const partner = await prisma.partner.update({
      where: { id },
      data: { totalPaid: { increment: parseFloat(amount) } },
    })
    // Mark referrals as paid
    await prisma.partnerReferral.updateMany({
      where: { partnerId: id, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        actorId: (req.user as any).id,
        actorType: 'ADMIN',
        actorName: `${(req.user as any).firstName ?? ''} ${(req.user as any).lastName ?? ''}`.trim(),
        actorEmail: (req.user as any).email ?? '',
        action: 'PARTNER_PAYMENT',
        entityType: 'PARTNER',
        entityId: id,
        entityName: partner.companyName,
        details: { amount },
        ip: req.ip,
      },
    })
    return reply.send({ partner })
  })

  // DELETE partner
  app.delete('/admin/partners/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.partner.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─────────────────────────── SUBSCRIPTION COUPONS (كوبونات الاشتراك) ──────────

  // GET all coupons
  app.get('/admin/subscription-coupons', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req: any, reply) => {
    const coupons = await prisma.subscriptionCoupon.findMany({
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ coupons })
  })

  // POST create coupon
  app.post('/admin/subscription-coupons', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req: any, reply) => {
    const { code, description, type, value, maxUses, applicablePlan, validFrom, validTo } = req.body as any
    if (!code || !type || value === undefined) return reply.code(400).send({ error: 'code, type, value required' })
    const existing = await prisma.subscriptionCoupon.findUnique({ where: { code: code.toUpperCase() } })
    if (existing) return reply.code(409).send({ error: 'الكود مستخدم بالفعل' })
    const coupon = await prisma.subscriptionCoupon.create({
      data: {
        code: code.toUpperCase(),
        description: description ?? null,
        type,
        value: parseFloat(value),
        maxUses: maxUses ? parseInt(maxUses) : null,
        applicablePlan: applicablePlan ?? null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
      },
    })
    return reply.code(201).send({ coupon })
  })

  // PATCH update coupon
  app.patch('/admin/subscription-coupons/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req: any, reply) => {
    const { id } = req.params as any
    const { isActive, description, maxUses, validFrom, validTo, commissionRate } = req.body as any
    const coupon = await prisma.subscriptionCoupon.update({
      where: { id },
      data: {
        isActive: isActive ?? undefined,
        description: description ?? undefined,
        maxUses: maxUses !== undefined ? (maxUses === null ? null : parseInt(maxUses)) : undefined,
        validFrom: validFrom !== undefined ? (validFrom ? new Date(validFrom) : null) : undefined,
        validTo: validTo !== undefined ? (validTo ? new Date(validTo) : null) : undefined,
      },
    })
    return reply.send({ coupon })
  })

  // DELETE coupon
  app.delete('/admin/subscription-coupons/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canEditPlans')] }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.subscriptionCoupon.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─────────────────────────── MERCHANT REFERRALS (إحالات التجار) ────────────

  // GET all merchant referrals
  app.get('/admin/merchant-referrals', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { status, page = '1' } = req.query as any
    const where: any = {}
    if (status) where.status = status
    const skip = (parseInt(page) - 1) * 50
    const [referrals, total] = await Promise.all([
      prisma.merchantReferral.findMany({
        where, skip, take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.merchantReferral.count({ where }),
    ])
    const stats = {
      total: await prisma.merchantReferral.count(),
      pending: await prisma.merchantReferral.count({ where: { status: 'PENDING' } }),
      registered: await prisma.merchantReferral.count({ where: { status: 'REGISTERED' } }),
      rewarded: await prisma.merchantReferral.count({ where: { status: 'REWARDED' } }),
    }
    return reply.send({ referrals, total, stats, page: parseInt(page) })
  })

  // PATCH mark referral as rewarded
  app.patch('/admin/merchant-referrals/:id/reward', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req: any, reply) => {
    const { id } = req.params as any
    const { rewardAmount } = req.body as any
    const referral = await prisma.merchantReferral.update({
      where: { id },
      data: {
        status: 'REWARDED',
        rewardedAt: new Date(),
        rewardAmount: parseFloat(rewardAmount ?? 0),
      },
    })
    return reply.send({ referral })
  })

  // ─── ADVANCED ANALYTICS ─────────────────────────────────────────────────────

  app.get('/admin/analytics/advanced', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (_req, reply) => {
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const [totalRevenue, merchantCount, activeStoreCount, thisMoRevenue, lastMoRevenue] = await Promise.all([
      prisma.billingInvoice.aggregate({ where: { status: 'PAID' }, _sum: { amountBD: true } }),
      prisma.merchant.count(),
      prisma.store.count({ where: { isActive: true } }),
      prisma.billingInvoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfThisMonth } },
        _sum: { amountBD: true },
      }),
      prisma.billingInvoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amountBD: true },
      }),
    ])

    const ltv = merchantCount > 0
      ? Number(totalRevenue._sum.amountBD ?? 0) / merchantCount
      : 0
    const mrr = Number(thisMoRevenue._sum.amountBD ?? 0)
    const arpu = activeStoreCount > 0 ? mrr / activeStoreCount : 0
    const prevMrr = Number(lastMoRevenue._sum.amountBD ?? 0)
    const growthRate = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0

    return reply.send({ ltv, arpu, growthRate, mrr, prevMrr })
  })

  app.get('/admin/analytics/at-risk', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (_req, reply) => {
    const now = new Date()
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const ago60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const stores = await prisma.store.findMany({
      where: {
        isActive: true,
        OR: [
          { planExpiresAt: { lte: in14Days } },
          {
            billingInvoices: {
              none: { status: 'PAID', paidAt: { gte: ago60Days } },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        plan: true,
        planExpiresAt: true,
        billingInvoices: {
          where: { status: 'PAID' },
          orderBy: { paidAt: 'desc' },
          take: 1,
          select: { paidAt: true },
        },
      },
      take: 100,
    })

    const result = stores.map((s) => ({
      storeId: s.id,
      name: s.name,
      plan: s.plan,
      planExpiresAt: s.planExpiresAt,
      lastPaidAt: s.billingInvoices[0]?.paidAt ?? null,
    }))

    return reply.send({ stores: result })
  })

  // ─── CSV EXPORTS ─────────────────────────────────────────────────────────────

  app.get('/admin/export/invoices', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (_req, reply) => {
    const invoices = await prisma.billingInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        store: { include: { merchant: { select: { email: true } } } },
      },
    })

    const rows = [
      ['ID', 'Store ID', 'Store Name', 'Merchant Email', 'Amount (BD)', 'Status', 'Paid At', 'Created At'],
      ...invoices.map((inv) => [
        inv.id,
        inv.storeId ?? '',
        inv.store?.name ?? '',
        inv.store?.merchant?.email ?? '',
        inv.amountBD?.toString() ?? '0',
        inv.status,
        inv.paidAt ? inv.paidAt.toISOString() : '',
        inv.createdAt.toISOString(),
      ]),
    ]

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', 'attachment; filename="invoices.csv"')
    return reply.send(csv)
  })

  app.get('/admin/export/merchants', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewMerchants')] }, async (_req, reply) => {
    const merchants = await prisma.merchant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { stores: true } } },
    })

    const rows = [
      ['ID', 'Email', 'First Name', 'Last Name', 'Verified', 'Active', 'Stores Count', 'Created At'],
      ...merchants.map((m) => [
        m.id,
        m.email,
        m.firstName ?? '',
        m.lastName ?? '',
        (m as any).isVerified ? 'Yes' : 'No',
        m.isActive ? 'Yes' : 'No',
        m._count.stores.toString(),
        m.createdAt.toISOString(),
      ]),
    ]

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', 'attachment; filename="merchants.csv"')
    return reply.send(csv)
  })

  app.get('/admin/export/financial-report', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    const { year, month } = req.query as { year?: string; month?: string }
    const now = new Date()
    const y = year ? parseInt(year) : now.getFullYear()
    const mo = month ? parseInt(month) - 1 : now.getMonth()
    const from = new Date(y, mo, 1)
    const to = new Date(y, mo + 1, 0, 23, 59, 59)

    const invoices = await prisma.billingInvoice.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      include: {
        store: { include: { merchant: { select: { email: true } } } },
      },
    })

    const rows = [
      ['Invoice ID', 'Store ID', 'Store Name', 'Plan', 'Merchant Email', 'Amount (BD)', 'Status', 'Paid At', 'Created At'],
      ...invoices.map((inv) => [
        inv.id,
        inv.storeId ?? '',
        inv.store?.name ?? '',
        inv.store?.plan ?? '',
        inv.store?.merchant?.email ?? '',
        inv.amountBD?.toString() ?? '0',
        inv.status,
        inv.paidAt ? inv.paidAt.toISOString() : '',
        inv.createdAt.toISOString(),
      ]),
    ]

    const label = `${y}-${String(mo + 1).padStart(2, '0')}`
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', `attachment; filename="financial-report-${label}.csv"`)
    return reply.send(csv)
  })

  // ─── LAYER 9: BLACKLIST ───────────────────────────────────────────────────────

  app.get('/admin/blacklist', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { type, search, page = '1' } = req.query as { type?: string; search?: string; page?: string }
    const take = 20
    const skip = (parseInt(page) - 1) * take
    const where: any = {}
    if (type) where.type = type
    if (search) where.value = { contains: search, mode: 'insensitive' }
    const [items, total] = await Promise.all([
      prisma.blacklist.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.blacklist.count({ where }),
    ])
    return reply.send({ items, total, pages: Math.ceil(total / take) })
  })

  app.post('/admin/blacklist', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { type, value, reason } = req.body as { type: string; value: string; reason?: string }
    const admin = (req as any).user
    try {
      const item = await prisma.blacklist.create({
        data: { type, value: value.toLowerCase().trim(), reason, createdBy: admin.email },
      })
      return reply.status(201).send({ item })
    } catch {
      return reply.status(409).send({ error: 'هذا المدخل موجود بالفعل في القائمة السوداء' })
    }
  })

  app.delete('/admin/blacklist/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    await prisma.blacklist.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  app.patch('/admin/blacklist/:id/toggle', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const item = await prisma.blacklist.findUniqueOrThrow({ where: { id } })
    const updated = await prisma.blacklist.update({ where: { id }, data: { isActive: !item.isActive } })
    return reply.send({ item: updated })
  })

  // ─── LAYER 9: LEGAL PAGES ────────────────────────────────────────────────────

  app.get('/admin/legal/:type', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req, reply) => {
    const { type } = req.params as { type: string }
    const page = await prisma.legalPage.findUnique({ where: { type } })
    return reply.send({ page: page ?? null })
  })

  app.put('/admin/legal/:type', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req, reply) => {
    const { type } = req.params as { type: string }
    const { title, content } = req.body as { title: string; content: string }
    const admin = (req as any).user
    const page = await prisma.legalPage.upsert({
      where: { type },
      create: { type, title, content, updatedBy: admin.email },
      update: { title, content, updatedBy: admin.email },
    })
    return reply.send({ page })
  })

  // GET /admin/terms-acceptance — log of merchants accepting terms
  app.get('/admin/terms-acceptance', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { page = '1' } = req.query as { page?: string }
    const take = 30
    const skip = (parseInt(page) - 1) * take
    const [entries, total] = await Promise.all([
      prisma.termsAcceptance.findMany({
        skip,
        take,
        orderBy: { acceptedAt: 'desc' },
        include: {
          merchant: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.termsAcceptance.count(),
    ])
    return reply.send({ entries, total, pages: Math.ceil(total / take) })
  })

  // ─── LAYER 9: PLATFORM SETTINGS ──────────────────────────────────────────────

  app.get('/admin/platform-settings', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const rows = await prisma.platformSetting.findMany()
    const settings: Record<string, string> = {}
    rows.forEach((r) => { settings[r.key] = r.value })
    return reply.send({ settings })
  })

  app.put('/admin/platform-settings', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const updates = req.body as Record<string, string>
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.platformSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      )
    )
    return reply.send({ ok: true })
  })

  // ─── LAYER 10: FEATURE FLAGS ──────────────────────────────────────────────────

  app.get('/admin/feature-flags', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ flags })
  })

  app.post('/admin/feature-flags', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { key, name, description } = req.body as any
    const flag = await prisma.featureFlag.create({
      data: { key: key.trim().toLowerCase().replace(/\s+/g, '_'), name, description },
    })
    return reply.status(201).send({ flag })
  })

  app.patch('/admin/feature-flags/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const { isEnabled, enabledForPlans, betaMerchantIds, name, description } = req.body as any
    const data: any = {}
    if (isEnabled !== undefined) data.isEnabled = isEnabled
    if (enabledForPlans !== undefined) data.enabledForPlans = enabledForPlans
    if (betaMerchantIds !== undefined) data.betaMerchantIds = betaMerchantIds
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    const flag = await prisma.featureFlag.update({ where: { id }, data })
    return reply.send({ flag })
  })

  app.delete('/admin/feature-flags/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    await prisma.featureFlag.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ─── LAYER 10: MAINTENANCE MODE ───────────────────────────────────────────────

  app.get('/admin/maintenance', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const windows = await prisma.maintenanceWindow.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
    const active = windows.find((w) => w.isActive) ?? null
    return reply.send({ windows, active })
  })

  app.post('/admin/maintenance', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { title, message, scheduledStart, scheduledEnd, notifyMerchants } = req.body as any
    const admin = (req as any).user
    const window = await prisma.maintenanceWindow.create({
      data: {
        title,
        message,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        notifyMerchants: notifyMerchants ?? true,
        createdBy: admin.email,
      },
    })
    return reply.status(201).send({ window })
  })

  app.patch('/admin/maintenance/:id/activate', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    // Deactivate all others first
    await prisma.maintenanceWindow.updateMany({ where: { isActive: true }, data: { isActive: false } })
    const window = await prisma.maintenanceWindow.update({ where: { id }, data: { isActive: true } })
    return reply.send({ window })
  })

  app.patch('/admin/maintenance/:id/deactivate', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const window = await prisma.maintenanceWindow.update({ where: { id }, data: { isActive: false } })
    return reply.send({ window })
  })

  app.delete('/admin/maintenance/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    await prisma.maintenanceWindow.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ─── LAYER 10: RATE LIMIT CONFIGS ────────────────────────────────────────────

  app.get('/admin/rate-limits', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const configs = await prisma.rateLimitConfig.findMany({ orderBy: { plan: 'asc' } })
    return reply.send({ configs })
  })

  app.put('/admin/rate-limits/:plan', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { plan } = req.params as any
    const { reqPerMinute, reqPerDay, burstLimit } = req.body as any
    const config = await prisma.rateLimitConfig.upsert({
      where: { plan },
      create: { plan, reqPerMinute, reqPerDay, burstLimit },
      update: { reqPerMinute, reqPerDay, burstLimit },
    })
    return reply.send({ config })
  })

  // ─── LAYER 10: QUEUE MONITORING ───────────────────────────────────────────────

  app.get('/admin/queue/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (_req, reply) => {
    const [pending, running, done, failed, recentErrors] = await Promise.all([
      prisma.importJob.count({ where: { status: 'PENDING' } }),
      prisma.importJob.count({ where: { status: 'RUNNING' } }),
      prisma.importJob.count({ where: { status: 'DONE' } }),
      prisma.importJob.count({ where: { status: 'FAILED' } }),
      prisma.errorLog.findMany({
        where: { level: 'ERROR', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, level: true, message: true, path: true, method: true, storeId: true, createdAt: true },
      }),
    ])
    return reply.send({ jobs: { pending, running, done, failed }, recentErrors })
  })

  app.get('/admin/queue/jobs', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (req, reply) => {
    const { status, page = '1' } = req.query as { status?: string; page?: string }
    const take = 20
    const skip = (parseInt(page) - 1) * take
    const where: any = {}
    if (status) where.status = status
    const [jobs, total] = await Promise.all([
      prisma.importJob.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { name: true } } },
      }),
      prisma.importJob.count({ where }),
    ])
    return reply.send({ jobs, total, pages: Math.ceil(total / take) })
  })

  // ─── LAYER 10: CACHE MANAGEMENT ───────────────────────────────────────────────

  // In-memory store-level cache invalidation signal (stores a timestamp per storeId)
  // The storefront reads this to know it must re-fetch
  const cacheInvalidations: Record<string, number> = {}

  app.post('/admin/cache/invalidate', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { storeId } = req.body as { storeId?: string }
    if (storeId) {
      cacheInvalidations[storeId] = Date.now()
    } else {
      // Global invalidation
      cacheInvalidations['__global__'] = Date.now()
    }
    return reply.send({ ok: true, timestamp: Date.now(), storeId: storeId ?? 'global' })
  })

  app.get('/admin/cache/status', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (_req, reply) => {
    const entries = Object.entries(cacheInvalidations).map(([storeId, ts]) => ({
      storeId,
      invalidatedAt: new Date(ts).toISOString(),
    }))
    return reply.send({ invalidations: entries })
  })

  // ─── LAYER 11: BULK CAMPAIGNS (Email + SMS) ────────────────────────────────

  app.get('/admin/communications/campaigns', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const campaigns = await prisma.bulkCampaign.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ campaigns })
  })

  app.post('/admin/communications/campaigns', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { type, subject, body, targetPlan, targetRegion, scheduledAt } = req.body as {
      type: string; subject?: string; body: string; targetPlan?: string; targetRegion?: string; scheduledAt?: string
    }
    if (!type || !body) return reply.status(400).send({ error: 'type و body مطلوبان' })
    if (type === 'EMAIL' && !subject) return reply.status(400).send({ error: 'subject مطلوب للإيميل' })
    const campaign = await prisma.bulkCampaign.create({
      data: { type, subject, body, targetPlan: targetPlan || null, targetRegion: targetRegion || null, scheduledAt: scheduledAt ? new Date(scheduledAt) : null },
    })
    return reply.status(201).send({ campaign })
  })

  app.post('/admin/communications/campaigns/:id/send', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const campaign = await prisma.bulkCampaign.findUnique({ where: { id } })
    if (!campaign) return reply.status(404).send({ error: 'الحملة غير موجودة' })
    if (campaign.status === 'SENT') return reply.status(400).send({ error: 'الحملة أُرسلت مسبقاً' })

    await prisma.bulkCampaign.update({ where: { id }, data: { status: 'SENDING' } })

    // Gather target merchants
    const where: Record<string, unknown> = { isActive: true }
    if (campaign.targetPlan) {
      where.stores = { some: { plan: campaign.targetPlan, isActive: true } }
    }
    const merchants = await prisma.merchant.findMany({
      where,
      select: { email: true, phone: true, firstName: true },
    })

    let sent = 0
    if (campaign.type === 'EMAIL') {
      for (const m of merchants) {
        try {
          await sendCustomAdminEmail({ to: m.email, firstName: m.firstName, subject: campaign.subject!, body: campaign.body })
          sent++
        } catch { /* log and continue */ }
      }
    } else if (campaign.type === 'SMS') {
      const smsConfig = {
        accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
        authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
        from: process.env.TWILIO_FROM ?? '',
      }
      if (smsConfig.accountSid) {
        for (const m of merchants) {
          if (m.phone) {
            try { await sendSms(m.phone, campaign.body, smsConfig); sent++ } catch { /* continue */ }
          }
        }
      }
    }

    const updated = await prisma.bulkCampaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), totalSent: sent },
    })
    return reply.send({ campaign: updated, sent })
  })

  app.delete('/admin/communications/campaigns/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.bulkCampaign.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ─── LAYER 11: STATUS PAGE INCIDENTS ──────────────────────────────────────

  app.get('/admin/status/incidents', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const incidents = await prisma.platformIncident.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return reply.send({ incidents })
  })

  app.post('/admin/status/incidents', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { title, type, status, isPublic, message } = req.body as {
      title: string; type?: string; status?: string; isPublic?: boolean; message?: string
    }
    if (!title) return reply.status(400).send({ error: 'title مطلوب' })
    const firstUpdate = message ? [{ message, createdAt: new Date().toISOString() }] : []
    const incident = await prisma.platformIncident.create({
      data: { title, type: type ?? 'NOTICE', status: status ?? 'INVESTIGATING', isPublic: isPublic ?? true, updates: firstUpdate },
    })
    return reply.status(201).send({ incident })
  })

  app.patch('/admin/status/incidents/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status, title, isPublic, updateMessage } = req.body as {
      status?: string; title?: string; isPublic?: boolean; updateMessage?: string
    }
    const existing = await prisma.platformIncident.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'الحادثة غير موجودة' })

    const updates = (existing.updates as { message: string; createdAt: string }[]) ?? []
    if (updateMessage) updates.push({ message: updateMessage, createdAt: new Date().toISOString() })

    const data: Record<string, unknown> = { updates }
    if (status) { data.status = status; if (status === 'RESOLVED') data.resolvedAt = new Date() }
    if (title) data.title = title
    if (isPublic !== undefined) data.isPublic = isPublic

    const incident = await prisma.platformIncident.update({ where: { id }, data })
    return reply.send({ incident })
  })

  app.delete('/admin/status/incidents/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.platformIncident.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ─── LAYER 12: MERCHANT SUBSCRIPTION PAYMENTS (Admin) ─────────────────────

  app.get('/admin/merchant-payments', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (req, reply) => {
    const { page = '1', status, storeId } = req.query as { page?: string; status?: string; storeId?: string }
    const take = 30
    const skip = (parseInt(page) - 1) * take
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (storeId) where.storeId = storeId

    const [payments, total] = await Promise.all([
      prisma.merchantPayment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { name: true, slug: true, plan: true } } },
      }),
      prisma.merchantPayment.count({ where }),
    ])
    return reply.send({ payments, total, page: parseInt(page), pages: Math.ceil(total / take) })
  })

  app.patch('/admin/merchant-payments/:id/grace', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { days = 7 } = req.body as { days?: number }
    const payment = await prisma.merchantPayment.findUnique({ where: { id } })
    if (!payment) return reply.status(404).send({ error: 'السجل غير موجود' })

    const gracePeriodEnds = new Date()
    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + days)

    await prisma.store.update({ where: { id: payment.storeId }, data: { gracePeriodEnds } })
    return reply.send({ ok: true, gracePeriodEnds })
  })

  app.patch('/admin/merchant-payments/:id/paid', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.merchantPayment.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paymentMethod: 'MANUAL' },
    })
    // Clear grace period on the store
    await prisma.store.update({ where: { id: updated.storeId }, data: { gracePeriodEnds: null, paymentRetryCount: 0 } })
    return reply.send({ payment: updated })
  })

  // ─── LAYER 13: API MANAGEMENT ────────────────────────────────────────────

  // GET  /admin/api-keys — list all stores with API key info
  app.get('/admin/api-keys', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        apiKey: true,
        apiKeyEnabled: true,
        _count: {
          select: {
            apiUsageLogs: {
              where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = stores.map((s) => ({
      id: s.id,
      name: s.name,
      subdomain: s.subdomain,
      plan: s.plan,
      hasKey: !!s.apiKey,
      keyMasked: s.apiKey
        ? `${s.apiKey.slice(0, 8)}...${s.apiKey.slice(-4)}`
        : null,
      apiKeyEnabled: s.apiKeyEnabled,
      usageLast30d: s._count.apiUsageLogs,
    }))

    return reply.send({ stores: result })
  })

  // POST /admin/api-keys/:storeId/regenerate — regenerate API key for a store
  app.post('/admin/api-keys/:storeId/regenerate', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { storeId } = req.params as { storeId: string }
    const newKey = `bz_sk_${crypto.randomBytes(24).toString('hex')}`
    const store = await prisma.store.update({
      where: { id: storeId },
      data: { apiKey: newKey },
      select: { id: true, name: true, apiKey: true },
    })
    return reply.send({
      storeId: store.id,
      name: store.name,
      keyMasked: `${newKey.slice(0, 8)}...${newKey.slice(-4)}`,
    })
  })

  // PATCH /admin/api-keys/:storeId/toggle — enable/disable API key
  app.patch('/admin/api-keys/:storeId/toggle', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { storeId } = req.params as { storeId: string }
    const { enabled } = req.body as { enabled: boolean }
    const store = await prisma.store.update({
      where: { id: storeId },
      data: { apiKeyEnabled: enabled },
      select: { id: true, name: true, apiKeyEnabled: true },
    })
    return reply.send({ storeId: store.id, apiKeyEnabled: store.apiKeyEnabled })
  })

  // GET /admin/api-keys/:storeId/usage — paginated usage logs for one store
  app.get('/admin/api-keys/:storeId/usage', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { storeId } = req.params as { storeId: string }
    const { page = 1, limit = 50 } = req.query as { page?: number; limit?: number }
    const skip = (Number(page) - 1) * Number(limit)

    const [logs, total] = await Promise.all([
      prisma.apiUsageLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.apiUsageLog.count({ where: { storeId } }),
    ])

    return reply.send({ logs, total, page: Number(page), limit: Number(limit) })
  })

  // GET /admin/api-keys/usage/stats — platform-wide usage stats
  app.get('/admin/api-keys/usage/stats', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [reqToday, reqWeek, reqMonth, topStoresRaw, endpointRaw, errorRaw] = await Promise.all([
      prisma.apiUsageLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.apiUsageLog.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.apiUsageLog.count({ where: { createdAt: { gte: monthStart } } }),
      // top 10 stores by usage last 30 days
      prisma.apiUsageLog.groupBy({
        by: ['storeId'],
        where: { createdAt: { gte: monthStart } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // endpoint breakdown
      prisma.apiUsageLog.groupBy({
        by: ['endpoint', 'method'],
        where: { createdAt: { gte: monthStart } },
        _count: { id: true },
        _avg: { duration: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      // error counts
      prisma.apiUsageLog.groupBy({
        by: ['statusCode'],
        where: { createdAt: { gte: monthStart }, statusCode: { gte: 400 } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ])

    // enrich top stores with name
    const storeIds = topStoresRaw.map((r) => r.storeId)
    const storeNames = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true, subdomain: true, plan: true },
    })
    const storeMap = Object.fromEntries(storeNames.map((s) => [s.id, s]))

    const topStores = topStoresRaw.map((r) => ({
      storeId: r.storeId,
      name: storeMap[r.storeId]?.name ?? r.storeId,
      subdomain: storeMap[r.storeId]?.subdomain,
      plan: storeMap[r.storeId]?.plan,
      requests: r._count.id,
    }))

    const endpoints = endpointRaw.map((r) => ({
      endpoint: r.endpoint,
      method: r.method,
      requests: r._count.id,
      avgDurationMs: Math.round(r._avg.duration ?? 0),
    }))

    const errors = errorRaw.map((r) => ({ statusCode: r.statusCode, count: r._count.id }))

    return reply.send({
      summary: { reqToday, reqWeek, reqMonth },
      topStores,
      endpoints,
      errors,
    })
  })

  // ── Launch readiness review ──────────────────────────────────────────────
  app.get('/launch-readiness', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewAuditLog')] }, async (_req, reply) => {
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      pendingApps,
      approvedApps,
      pendingThemes,
      approvedThemes,
      pendingPartners,
      approvedPartners,
      webhookDeliveries,
      failedWebhookDeliveries,
      activeIncidents,
      publishedChangelogCount,
      latestChangelog,
    ] = await Promise.all([
      prisma.app.count({ where: { isApproved: false, isActive: true } }),
      prisma.app.count({ where: { isApproved: true, isActive: true } }),
      prisma.theme.count({ where: { isApproved: false, isActive: true } }),
      prisma.theme.count({ where: { isApproved: true, isActive: true } }),
      prisma.partner.count({ where: { status: 'PENDING' } }),
      prisma.partner.count({ where: { status: 'APPROVED' } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: last7d }, success: false } }),
      prisma.platformIncident.count({ where: { status: { not: 'RESOLVED' } } }),
      prisma.apiChangelog.count({ where: { isPublished: true } }),
      prisma.apiChangelog.findFirst({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        select: { version: true, title: true, publishedAt: true },
      }),
    ])

    const webhookFailureRate = webhookDeliveries > 0
      ? Number(((failedWebhookDeliveries / webhookDeliveries) * 100).toFixed(1))
      : 0

    const checklist = [
      {
        id: 'governance-queue',
        title: 'Marketplace governance queue',
        status: pendingApps + pendingThemes + pendingPartners === 0 ? 'pass' : 'block',
        detail: pendingApps + pendingThemes + pendingPartners === 0
          ? 'لا توجد عناصر pending في apps/themes/partners.'
          : `يوجد ${pendingApps} تطبيقات و${pendingThemes} ثيمات و${pendingPartners} شركاء بانتظار القرار.`,
      },
      {
        id: 'webhook-reliability',
        title: 'Webhook delivery reliability',
        status: webhookFailureRate <= 5 ? 'pass' : webhookFailureRate <= 15 ? 'warn' : 'block',
        detail: webhookDeliveries === 0
          ? 'لا توجد deliveries خلال آخر 7 أيام، راقب أول موجة تشغيلية قبل sign-off.'
          : `معدل الفشل ${webhookFailureRate}% عبر ${webhookDeliveries} محاولة تسليم خلال آخر 7 أيام.`,
      },
      {
        id: 'public-api-release-notes',
        title: 'Public API release notes',
        status: publishedChangelogCount > 0 ? 'pass' : 'warn',
        detail: publishedChangelogCount > 0
          ? `آخر changelog منشور: ${latestChangelog?.version ?? 'v1'} — ${latestChangelog?.title ?? 'بدون عنوان'}.`
          : 'لا يوجد changelog منشور بعد لمسار public API.',
      },
      {
        id: 'incident-state',
        title: 'Active platform incidents',
        status: activeIncidents === 0 ? 'pass' : 'block',
        detail: activeIncidents === 0
          ? 'لا توجد incidents غير محلولة حالياً.'
          : `يوجد ${activeIncidents} incidents غير محلولة تمنع sign-off التنفيذي.`,
      },
      {
        id: 'ecosystem-coverage',
        title: 'Approved ecosystem coverage',
        status: approvedApps > 0 && approvedThemes > 0 && approvedPartners > 0 ? 'pass' : 'warn',
        detail: `المعتمد حالياً: ${approvedApps} تطبيقات، ${approvedThemes} ثيمات، ${approvedPartners} شركاء.`,
      },
    ] as const

    const blockers = checklist.filter((item) => item.status === 'block').length
    const warnings = checklist.filter((item) => item.status === 'warn').length

    return reply.send({
      generatedAt: new Date().toISOString(),
      status: blockers === 0 ? 'ready' : 'blocked',
      summary: {
        blockers,
        warnings,
        readyForExecutiveSignOff: blockers === 0,
      },
      governance: {
        apps: { pending: pendingApps, approved: approvedApps },
        themes: { pending: pendingThemes, approved: approvedThemes },
        partners: { pending: pendingPartners, approved: approvedPartners },
      },
      operations: {
        webhookDeliveries,
        failedWebhookDeliveries,
        webhookFailureRate,
        activeIncidents,
      },
      api: {
        publicContract: '/api/public/v1/contract',
        webhookContract: '/api/v1/webhooks/contract',
        publishedChangelogCount,
        latestChangelog,
        sdks: ['javascript', 'python', 'php'],
      },
      checklist,
    })
  })

  // ── API Changelog ─────────────────────────────────────────────────────────

  // GET /admin/api-changelog
  app.get('/admin/api-changelog', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (_req, reply) => {
    const entries = await prisma.apiChangelog.findMany({
      orderBy: { publishedAt: 'desc' },
    })
    return reply.send({ entries })
  })

  // POST /admin/api-changelog
  app.post('/admin/api-changelog', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req, reply) => {
    const { version, title, description, type, isPublished, publishedAt } =
      req.body as {
        version: string
        title: string
        description: string
        type?: string
        isPublished?: boolean
        publishedAt?: string
      }
    const entry = await prisma.apiChangelog.create({
      data: { version, title, description, type: type ?? 'IMPROVEMENT', isPublished: isPublished ?? true, publishedAt: publishedAt ? new Date(publishedAt) : new Date() },
    })
    return reply.status(201).send({ entry })
  })

  // PATCH /admin/api-changelog/:id
  app.patch('/admin/api-changelog/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = req.body as Partial<{ version: string; title: string; description: string; type: string; isPublished: boolean; publishedAt: string }>
    const entry = await prisma.apiChangelog.update({
      where: { id },
      data: {
        ...data,
        ...(data.publishedAt ? { publishedAt: new Date(data.publishedAt) } : {}),
      },
    })
    return reply.send({ entry })
  })

  // DELETE /admin/api-changelog/:id
  app.delete('/admin/api-changelog/:id', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageContent')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.apiChangelog.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ─── LAYER 14: ADVANCED SECURITY ─────────────────────────────────────────

  // GET /admin/security/overview — security dashboard stats
  app.get('/admin/security/overview', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const now = new Date()
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const settings = await prisma.securitySettings.findUnique({ where: { id: 'platform' } })
    const banMinutes  = settings?.banDurationMinutes ?? 30
    const maxAttempts = settings?.maxLoginAttempts ?? 5
    const banSince    = new Date(Date.now() - banMinutes * 60 * 1000)

    const [
      totalAdmins,
      admins2FAEnabled,
      failedLast24h,
      successLast24h,
      ipWhitelistCount,
      // IPs with too many failures (banned)
      recentFailsByIp,
    ] = await Promise.all([
      prisma.merchant.count({ where: { isAdmin: true } }),
      prisma.merchant.count({ where: { isAdmin: true, twoFactorEnabled: true } }),
      prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: last24h } } }),
      prisma.loginAttempt.count({ where: { success: true,  createdAt: { gte: last24h } } }),
      prisma.adminIpWhitelist.count(),
      prisma.loginAttempt.groupBy({
        by: ['ip'],
        where: { success: false, createdAt: { gte: banSince } },
        _count: { id: true },
        having: { id: { _count: { gte: maxAttempts } } },
      }),
    ])

    const bannedIpsCount = recentFailsByIp.length

    return reply.send({
      admins: { total: totalAdmins, with2FA: admins2FAEnabled, without2FA: totalAdmins - admins2FAEnabled },
      logins: { failedLast24h, successLast24h },
      ipWhitelistCount,
      bannedIpsCount,
      settings: settings ?? {
        require2FAForAdmins: false,
        ipWhitelistEnabled: false,
        maxLoginAttempts: 5,
        banDurationMinutes: 30,
        sessionTimeoutMinutes: 120,
        passwordMinLength: 8,
        passwordRequireUpper: false,
        passwordRequireNumber: false,
        passwordExpiryDays: 0,
      },
    })
  })

  // GET /admin/security/settings
  app.get('/admin/security/settings', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const settings = await prisma.securitySettings.findUnique({ where: { id: 'platform' } })
    return reply.send({ settings: settings ?? null })
  })

  // PATCH /admin/security/settings — upsert security settings
  app.patch('/admin/security/settings', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const data = req.body as Partial<{
      require2FAForAdmins: boolean
      ipWhitelistEnabled: boolean
      maxLoginAttempts: number
      banDurationMinutes: number
      sessionTimeoutMinutes: number
      passwordMinLength: number
      passwordRequireUpper: boolean
      passwordRequireNumber: boolean
      passwordExpiryDays: number
    }>
    const settings = await prisma.securitySettings.upsert({
      where: { id: 'platform' },
      create: { id: 'platform', ...data },
      update: data,
    })
    return reply.send({ settings })
  })

  // GET /admin/security/ip-whitelist
  app.get('/admin/security/ip-whitelist', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const entries = await prisma.adminIpWhitelist.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ entries })
  })

  // POST /admin/security/ip-whitelist
  app.post('/admin/security/ip-whitelist', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { ip, label } = req.body as { ip: string; label?: string }
    // Validate basic IP format (IPv4 or IPv6 or CIDR not expanded — just sanity check)
    if (!ip || !/^[\d.a-fA-F:]+$/.test(ip)) {
      return reply.status(400).send({ error: 'عنوان IP غير صحيح' })
    }
    const adminId = (req.user as any).id
    const entry = await prisma.adminIpWhitelist.upsert({
      where: { ip },
      create: { ip, label: label ?? null, addedBy: adminId },
      update: { label: label ?? null },
    })
    return reply.status(201).send({ entry })
  })

  // DELETE /admin/security/ip-whitelist/:id
  app.delete('/admin/security/ip-whitelist/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.adminIpWhitelist.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // GET /admin/security/login-attempts — paginated login attempt log
  app.get('/admin/security/login-attempts', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { page = 1, limit = 50, ip, failedOnly } = req.query as { page?: number; limit?: number; ip?: string; failedOnly?: string }
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (ip) where.ip = { contains: ip }
    if (failedOnly === 'true') where.success = false

    const [attempts, total] = await Promise.all([
      prisma.loginAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.loginAttempt.count({ where }),
    ])

    return reply.send({ attempts, total, page: Number(page), limit: Number(limit) })
  })

  // GET /admin/security/banned-ips — IPs currently auto-banned
  app.get('/admin/security/banned-ips', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const settings = await prisma.securitySettings.findUnique({ where: { id: 'platform' } })
    const banMinutes  = settings?.banDurationMinutes ?? 30
    const maxAttempts = settings?.maxLoginAttempts ?? 5
    const banSince    = new Date(Date.now() - banMinutes * 60 * 1000)

    const byIp = await prisma.loginAttempt.groupBy({
      by: ['ip'],
      where: { success: false, createdAt: { gte: banSince } },
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
      having: { id: { _count: { gte: maxAttempts } } },
    })

    return reply.send({ bannedIps: byIp.map(r => ({ ip: r.ip, failCount: r._count.id, lastAttempt: r._max.createdAt })) })
  })

  // DELETE /admin/security/banned-ips/:ip — unban by deleting recent failures
  app.delete('/admin/security/banned-ips/:ip', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const ip = decodeURIComponent((req.params as any).ip)
    await prisma.loginAttempt.deleteMany({ where: { ip, success: false } })
    return reply.send({ ok: true, message: `تم رفع الحظر عن ${ip}` })
  })

  // GET /admin/security/admin-2fa — list all admins with 2FA status
  app.get('/admin/security/admin-2fa', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const admins = await prisma.merchant.findMany({
      where: { isAdmin: true },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        twoFactorEnabled: true, lastLoginIp: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ admins })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 15 — LOCALIZATION (التوطين والتوسع)
  // ─────────────────────────────────────────────────────────────────────────

  // ── Languages ────────────────────────────────────────────────────────────
  app.get('/admin/localization/languages', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const languages = await prisma.supportedLanguage.findMany({ orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }] })
    return reply.send({ languages })
  })

  app.post('/admin/localization/languages', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { code, name, nameAr, direction = 'ltr', isActive = true, isDefault = false, sortOrder = 0 } = req.body as any
    if (!code || !name || !nameAr) return reply.status(400).send({ error: 'code, name, nameAr مطلوبة' })
    // If setting as default, unset others
    if (isDefault) await prisma.supportedLanguage.updateMany({ data: { isDefault: false } })
    const lang = await prisma.supportedLanguage.create({ data: { code: code.toLowerCase(), name, nameAr, direction, isActive, isDefault, sortOrder } })
    return reply.status(201).send({ language: lang })
  })

  app.patch('/admin/localization/languages/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    if (body.isDefault) await prisma.supportedLanguage.updateMany({ where: { id: { not: id } }, data: { isDefault: false } })
    const lang = await prisma.supportedLanguage.update({ where: { id }, data: body })
    return reply.send({ language: lang })
  })

  app.delete('/admin/localization/languages/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const lang = await prisma.supportedLanguage.findUnique({ where: { id } })
    if (!lang) return reply.status(404).send({ error: 'اللغة غير موجودة' })
    if (lang.isDefault) return reply.status(400).send({ error: 'لا يمكن حذف اللغة الافتراضية' })
    await prisma.supportedLanguage.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ── Currencies ────────────────────────────────────────────────────────────
  app.get('/admin/localization/currencies', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const currencies = await prisma.supportedCurrency.findMany({ orderBy: [{ baseCurrency: 'desc' }, { code: 'asc' }] })
    return reply.send({ currencies })
  })

  app.post('/admin/localization/currencies', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { code, name, nameAr, symbol, symbolAr, exchangeRate = 1, baseCurrency = false, decimalPlaces = 3, isActive = true } = req.body as any
    if (!code || !name || !nameAr || !symbol) return reply.status(400).send({ error: 'code, name, nameAr, symbol مطلوبة' })
    if (baseCurrency) await prisma.supportedCurrency.updateMany({ data: { baseCurrency: false } })
    const currency = await prisma.supportedCurrency.create({ data: { code: code.toUpperCase(), name, nameAr, symbol, symbolAr, exchangeRate, baseCurrency, decimalPlaces, isActive } })
    return reply.status(201).send({ currency })
  })

  app.patch('/admin/localization/currencies/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    if (body.baseCurrency) await prisma.supportedCurrency.updateMany({ where: { id: { not: id } }, data: { baseCurrency: false } })
    const currency = await prisma.supportedCurrency.update({ where: { id }, data: body })
    return reply.send({ currency })
  })

  app.delete('/admin/localization/currencies/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const currency = await prisma.supportedCurrency.findUnique({ where: { id } })
    if (!currency) return reply.status(404).send({ error: 'العملة غير موجودة' })
    if (currency.baseCurrency) return reply.status(400).send({ error: 'لا يمكن حذف العملة الأساسية' })
    await prisma.supportedCurrency.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ── Countries ─────────────────────────────────────────────────────────────
  app.get('/admin/localization/countries', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const countries = await prisma.supportedCountry.findMany({ orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }] })
    return reply.send({ countries })
  })

  app.post('/admin/localization/countries', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { code, name, nameAr, phonePrefix, currencyCode, isActive = true, isDefault = false, sortOrder = 0 } = req.body as any
    if (!code || !name || !nameAr) return reply.status(400).send({ error: 'code, name, nameAr مطلوبة' })
    if (isDefault) await prisma.supportedCountry.updateMany({ data: { isDefault: false } })
    const country = await prisma.supportedCountry.create({ data: { code: code.toUpperCase(), name, nameAr, phonePrefix, currencyCode, isActive, isDefault, sortOrder } })
    return reply.status(201).send({ country })
  })

  app.patch('/admin/localization/countries/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    if (body.isDefault) await prisma.supportedCountry.updateMany({ where: { id: { not: id } }, data: { isDefault: false } })
    const country = await prisma.supportedCountry.update({ where: { id }, data: body })
    return reply.send({ country })
  })

  app.delete('/admin/localization/countries/:id', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const { id } = req.params as any
    const country = await prisma.supportedCountry.findUnique({ where: { id } })
    if (!country) return reply.status(404).send({ error: 'الدولة غير موجودة' })
    if (country.isDefault) return reply.status(400).send({ error: 'لا يمكن حذف الدولة الافتراضية' })
    await prisma.supportedCountry.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ── Platform Config ───────────────────────────────────────────────────────
  app.get('/admin/localization/platform-config', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (_req, reply) => {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'platform' } })
    // Return defaults if not yet seeded
    return reply.send({ config: config ?? { id: 'platform', platformName: 'BahrainStore', platformNameAr: 'بحرين ستور', primaryColor: '#3b82f6', secondaryColor: '#8b5cf6', accentColor: '#06b6d4', baseCurrency: 'BHD', defaultLanguage: 'ar' } })
  })

  app.patch('/admin/localization/platform-config', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (req, reply) => {
    const body = req.body as any
    // Strip id to avoid conflicts
    delete body.id
    const config = await prisma.platformConfig.upsert({
      where: { id: 'platform' },
      update: body,
      create: { id: 'platform', ...body },
    })
    return reply.send({ config })
  })
}


