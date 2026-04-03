import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── Merchant Badges ──────────────────────────────────────────────────────────
// Gamification system: merchants earn badges based on their performance
// Badges appear in storefront search results to build customer trust

// ─── Default badge definitions ───────────────────────────────────────────────
const DEFAULT_BADGES = [
  {
    key: 'trusted_seller',
    nameAr: 'تاجر موثوق',
    nameEn: 'Trusted Seller',
    descriptionAr: 'حصل على 100+ تقييم بمعدل 4.5 نجوم أو أكثر',
    icon: '⭐',
    color: '#f59e0b',
    criteria: { type: 'reviews', minCount: 100, minRating: 4.5 },
  },
  {
    key: 'fast_shipper',
    nameAr: 'شحن سريع',
    nameEn: 'Fast Shipper',
    descriptionAr: 'يشحن 90% من الطلبات خلال 24 ساعة',
    icon: '🚀',
    color: '#3b82f6',
    criteria: { type: 'shipping_speed', threshold: 0.9, hoursLimit: 24 },
  },
  {
    key: 'gold_seller',
    nameAr: 'بائع ذهبي',
    nameEn: 'Gold Seller',
    descriptionAr: 'أكمل 1000+ طلب بنجاح',
    icon: '💎',
    color: '#eab308',
    criteria: { type: 'orders_count', threshold: 1000 },
  },
  {
    key: 'gulf_shipping',
    nameAr: 'يشحن للخليج',
    nameEn: 'Ships to GCC',
    descriptionAr: 'يقوم بالشحن لدول مجلس التعاون الخليجي',
    icon: '🌍',
    color: '#10b981',
    criteria: { type: 'shipping_zones', zones: ['SA', 'AE', 'KW', 'QA', 'OM'] },
  },
  {
    key: 'new_arrivals',
    nameAr: 'وصول جديد',
    nameEn: 'New Arrivals',
    descriptionAr: 'أضاف 10+ منتجات جديدة هذا الشهر',
    icon: '🆕',
    color: '#8b5cf6',
    criteria: { type: 'new_products', threshold: 10, withinDays: 30 },
  },
  {
    key: 'verified_business',
    nameAr: 'نشاط تجاري موثق',
    nameEn: 'Verified Business',
    descriptionAr: 'تم التحقق من السجل التجاري',
    icon: '✅',
    color: '#06b6d4',
    criteria: { type: 'manual', adminApproval: true },
  },
  {
    key: 'customer_favorite',
    nameAr: 'المفضل لدى العملاء',
    nameEn: 'Customer Favorite',
    descriptionAr: 'تجاوزت نسبة رضا العملاء 95%',
    icon: '❤️',
    color: '#ef4444',
    criteria: { type: 'satisfaction_rate', threshold: 0.95 },
  },
  {
    key: 'top_rated',
    nameAr: 'الأعلى تقييماً',
    nameEn: 'Top Rated',
    descriptionAr: 'في أعلى 10% من تجار بازار تقييماً',
    icon: '🏆',
    color: '#f97316',
    criteria: { type: 'platform_rank', topPercent: 10 },
  },
]

// ─── Check if store qualifies for a badge ────────────────────────────────────
async function checkBadgeCriteria(storeId: string, badge: typeof DEFAULT_BADGES[0]): Promise<boolean> {
  const { criteria } = badge

  switch (criteria.type) {
    case 'orders_count': {
      const count = await prisma.order.count({
        where: { storeId, status: 'DELIVERED' },
      })
      return count >= (criteria.threshold as number)
    }

    case 'reviews': {
      const result = await prisma.review.aggregate({
        where: { storeId, status: 'APPROVED' },
        _count: { id: true },
        _avg: { rating: true },
      })
      return (result._count?.id ?? 0) >= (criteria.minCount as number) && (result._avg?.rating || 0) >= (criteria.minRating as number)
    }

    case 'new_products': {
      const cutoff = new Date(Date.now() - (criteria.withinDays as number) * 24 * 60 * 60 * 1000)
      const count = await prisma.product.count({ where: { storeId, createdAt: { gte: cutoff }, isActive: true } })
      return count >= (criteria.threshold as number)
    }

    case 'satisfaction_rate': {
      const [delivered, cancelled] = await Promise.all([
        prisma.order.count({ where: { storeId, status: 'DELIVERED' } }),
        prisma.order.count({ where: { storeId, status: 'CANCELLED' } }),
      ])
      const total = delivered + cancelled
      if (total === 0) return false
      return delivered / total >= (criteria.threshold as number)
    }

    case 'manual':
      // Only granted by admin
      return false

    default:
      return false
  }
}

export async function badgesRoutes(app: FastifyInstance) {
  // ─── GET /badges — All available badge definitions ─────────────────────────
  app.get('/', async (_request, reply) => {
    let badges = await prisma.merchantBadge.findMany({ where: { isActive: true } })

    // Seed default badges if none exist
    if (badges.length === 0) {
      await prisma.merchantBadge.createMany({ data: DEFAULT_BADGES as any, skipDuplicates: true })
      badges = await prisma.merchantBadge.findMany({ where: { isActive: true } })
    }

    return reply.send({ badges })
  })

  // ─── GET /badges/store/:storeId — Store's earned badges ───────────────────
  app.get('/store/:storeId', async (request, reply) => {
    const { storeId } = request.params as any

    const earned = await prisma.merchantBadgeEarned.findMany({
      where: { storeId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    })

    return reply.send({ badges: earned.map((e) => ({ ...e.badge, earnedAt: e.earnedAt })) })
  })

  // ─── POST /badges/check/:storeId — Re-check all badge eligibility ─────────
  // Called periodically (e.g., after each order)
  app.post('/check/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as any

    let badges = await prisma.merchantBadge.findMany({ where: { isActive: true } })
    if (badges.length === 0) {
      await prisma.merchantBadge.createMany({ data: DEFAULT_BADGES as any, skipDuplicates: true })
      badges = await prisma.merchantBadge.findMany({ where: { isActive: true } })
    }

    const newlyEarned: string[] = []

    for (const badge of badges) {
      // Skip manual badges
      if ((badge.criteria as any)?.type === 'manual') continue

      // Check if already earned
      const alreadyEarned = await prisma.merchantBadgeEarned.findUnique({
        where: { storeId_badgeId: { storeId, badgeId: badge.id } },
      })
      if (alreadyEarned) continue

      // Check criteria
      const qualified = await checkBadgeCriteria(storeId, badge as any)
      if (qualified) {
        await prisma.merchantBadgeEarned.create({ data: { storeId, badgeId: badge.id } })
        newlyEarned.push(badge.nameAr)
      }
    }

    const allEarned = await prisma.merchantBadgeEarned.findMany({
      where: { storeId },
      include: { badge: true },
    })

    return reply.send({
      newlyEarned,
      totalBadges: allEarned.length,
      badges: allEarned.map((e) => ({ ...e.badge, earnedAt: e.earnedAt })),
    })
  })

  // ─── POST /badges/:badgeId/grant/:storeId — Admin grant manual badge ───────
  app.post('/:badgeId/grant/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { badgeId, storeId } = request.params as any

    const badge = await prisma.merchantBadge.findUnique({ where: { id: badgeId } })
    if (!badge) return reply.status(404).send({ error: 'الشارة غير موجودة' })

    await prisma.merchantBadgeEarned.upsert({
      where: { storeId_badgeId: { storeId, badgeId } },
      create: { storeId, badgeId },
      update: { earnedAt: new Date() },
    })

    return reply.send({ success: true, message: `تم منح شارة "${badge.nameAr}" للمتجر` })
  })

  // ─── DELETE /badges/:badgeId/revoke/:storeId — Admin revoke badge ──────────
  app.delete('/:badgeId/revoke/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { badgeId, storeId } = request.params as any

    await prisma.merchantBadgeEarned.deleteMany({ where: { storeId, badgeId } })
    return reply.send({ success: true })
  })
}

// ─── Smart Alerts ──────────────────────────────────────────────────────────────
// Intelligent merchant notification system with configurable conditions

// ─── Generate alerts for a store ─────────────────────────────────────────────
export async function generateStoreAlerts(storeId: string): Promise<number> {
  const config = await prisma.alertConfig.findUnique({ where: { storeId } })
  const lowStockDays = config?.lowStockDays ?? 7

  let alertsCreated = 0

  // 1. Low stock alert
  const dailySales = await prisma.$queryRaw<Array<{ product_id: string; avg_daily: number }>>`
    SELECT 
      oi.product_id,
      SUM(oi.quantity)::float / 30 as avg_daily
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.store_id = ${storeId}
      AND o.created_at >= NOW() - INTERVAL '30 days'
      AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY oi.product_id
  `

  for (const item of dailySales) {
    if (item.avg_daily <= 0) continue
    const product = await prisma.product.findFirst({
      where: { id: item.product_id, storeId, isActive: true },
      select: { id: true, name: true, nameAr: true, stock: true },
    })
    if (!product) continue

    const daysRemaining = product.stock / item.avg_daily

    if (daysRemaining <= lowStockDays && daysRemaining > 0) {
      const exists = await prisma.merchantAlert.findFirst({
        where: { storeId, type: 'LOW_STOCK', data: { path: ['productId'], equals: product.id }, isRead: false },
      })
      if (!exists) {
        await prisma.merchantAlert.create({
          data: {
            storeId,
            type: 'LOW_STOCK',
            title: `مخزون منخفض: ${product.nameAr || product.name}`,
            message: `ستنفد هذه المنتجات خلال ~${Math.round(daysRemaining)} يوم بناءً على معدل المبيعات الحالي. المخزون الحالي: ${product.stock}`,
            data: { productId: product.id, stock: product.stock, daysRemaining: Math.round(daysRemaining) },
            priority: daysRemaining <= 3 ? 'URGENT' : daysRemaining <= 5 ? 'HIGH' : 'MEDIUM',
          },
        })
        alertsCreated++
      }
    }

    // Out of stock
    if (product.stock === 0) {
      const exists = await prisma.merchantAlert.findFirst({
        where: { storeId, type: 'OUT_OF_STOCK', data: { path: ['productId'], equals: product.id }, isRead: false },
      })
      if (!exists) {
        await prisma.merchantAlert.create({
          data: {
            storeId,
            type: 'OUT_OF_STOCK',
            title: `منتج نفد من المخزون: ${product.nameAr || product.name}`,
            message: `الكمية المتاحة وصلت إلى صفر. تأكد من إعادة تعبئة المخزون لتجنب خسارة المبيعات.`,
            data: { productId: product.id },
            priority: 'URGENT',
          },
        })
        alertsCreated++
      }
    }
  }

  // 2. Abandoned cart alert (batch)
  const abandonedMinutes = config?.abandonedCartMinutes ?? 30
  const cutoff = new Date(Date.now() - abandonedMinutes * 60 * 1000)
  const abandonedCarts = await prisma.abandonedCart.count({
    where: { storeId, createdAt: { lte: cutoff }, recoveredAt: null },
  })

  if (abandonedCarts > 0) {
    const lastAlertTime = new Date(Date.now() - 60 * 60 * 1000) // max 1 alert per hour
    const exists = await prisma.merchantAlert.findFirst({
      where: { storeId, type: 'ABANDONED_CART', createdAt: { gte: lastAlertTime } },
    })
    if (!exists) {
      await prisma.merchantAlert.create({
        data: {
          storeId,
          type: 'ABANDONED_CART',
          title: `${abandonedCarts} سلة متروكة`,
          message: `لديك ${abandonedCarts} سلة لم تُكتمل. أرسل رسالة تذكير لاستعادة العملاء!`,
          data: { count: abandonedCarts },
          priority: abandonedCarts >= 5 ? 'HIGH' : 'MEDIUM',
        },
      })
      alertsCreated++
    }
  }

  // 3. Seasonal reminder (Ramadan, Eid, etc.)
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // Pre-Ramadan reminder (approximate: early Feb/March check)
  if ((month === 2 && day === 15) || (month === 3 && day === 1)) {
    const exists = await prisma.merchantAlert.findFirst({
      where: { storeId, type: 'SEASONAL_REMINDER', createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
    })
    if (!exists) {
      await prisma.merchantAlert.create({
        data: {
          storeId,
          type: 'SEASONAL_REMINDER',
          title: '🌙 رمضان قادم — حضّر متجرك!',
          message: 'رمضان قادم خلال أسابيع. حضّر عروضك وزيّن متجرك بقالب رمضان لزيادة المبيعات.',
          data: { season: 'ramadan' },
          priority: 'MEDIUM',
        },
      })
      alertsCreated++
    }
  }

  return alertsCreated
}

export async function alertsRoutes(app: FastifyInstance) {
  // ─── GET /alerts — Get all alerts for a store ─────────────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, unreadOnly = 'false', page = '1', limit = '20', type } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId }
    if (unreadOnly === 'true') where.isRead = false
    if (type) where.type = type

    const [alerts, total, unreadCount] = await Promise.all([
      prisma.merchantAlert.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit),
      }),
      prisma.merchantAlert.count({ where }),
      prisma.merchantAlert.count({ where: { storeId, isRead: false } }),
    ])

    return reply.send({ alerts, total, unreadCount, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  // ─── PATCH /alerts/:id/read ───────────────────────────────────────────────
  app.patch('/:id/read', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any
    await prisma.merchantAlert.update({ where: { id }, data: { isRead: true } })
    return reply.send({ success: true })
  })

  // ─── POST /alerts/read-all ────────────────────────────────────────────────
  app.post('/read-all', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.body as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })
    await prisma.merchantAlert.updateMany({ where: { storeId, isRead: false }, data: { isRead: true } })
    return reply.send({ success: true })
  })

  // ─── DELETE /alerts/:id ───────────────────────────────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any
    await prisma.merchantAlert.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─── POST /alerts/generate ────────────────────────────────────────────────
  // Manually trigger alert generation for a store
  app.post('/generate', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.body as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const count = await generateStoreAlerts(storeId)
    return reply.send({ success: true, alertsCreated: count })
  })

  // ─── GET /alerts/config ───────────────────────────────────────────────────
  app.get('/config', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const config = await prisma.alertConfig.findUnique({ where: { storeId } })
    return reply.send({
      config: config || {
        storeId,
        lowStockDays: 7,
        abandonedCartMinutes: 30,
        inactiveCustomerDays: 60,
        channels: { email: true, push: true, whatsapp: false },
      },
    })
  })

  // ─── PUT /alerts/config ───────────────────────────────────────────────────
  app.put('/config', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      lowStockDays: z.number().int().min(1).max(30).optional(),
      abandonedCartMinutes: z.number().int().min(5).max(1440).optional(),
      inactiveCustomerDays: z.number().int().min(7).max(365).optional(),
      channels: z.object({
        email: z.boolean(),
        push: z.boolean(),
        whatsapp: z.boolean(),
      }).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    const config = await prisma.alertConfig.upsert({
      where: { storeId: parsed.data.storeId },
      create: parsed.data as any,
      update: parsed.data as any,
    })

    return reply.send({ success: true, config })
  })

  // ─── POST /alerts/create ──────────────────────────────────────────────────
  // Manually create a custom alert
  app.post('/create', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      type: z.enum(['LOW_STOCK', 'OUT_OF_STOCK', 'ABANDONED_CART', 'NEW_REVIEW', 'LARGE_ORDER', 'FAILED_PAYMENT',
        'INACTIVE_CUSTOMER', 'GOAL_REACHED', 'COMPETITOR_PRICE', 'SEASONAL_REMINDER', 'LOAN_REPAYMENT']),
      title: z.string().min(1).max(200),
      message: z.string().min(1),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      data: z.record(z.string(), z.any()).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    const alert = await prisma.merchantAlert.create({ data: parsed.data as any })
    return reply.status(201).send({ success: true, alert })
  })
}
