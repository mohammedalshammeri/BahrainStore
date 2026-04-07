import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ── Official app seeds ────────────────────────
const OFFICIAL_APPS = [
  {
    slug: 'bazar-erp',
    name: 'Bazar ERP',
    nameAr: 'نظام ERP',
    description: 'Full enterprise resource planning — inventory, purchasing, and warehouse management.',
    descriptionAr: 'نظام تخطيط موارد المؤسسة — إدارة المخزون، المشتريات، والمستودعات.',
    icon: '🏭',
    category: 'ERP' as const,
    developer: 'BSMC.BH',
    developerEmail: 'support@bazar.bh',
    isOfficial: true,
    isApproved: true,
    pricingType: 'FREEMIUM' as const,
    monthlyPrice: 29,
  },
  {
    slug: 'bazar-accounting',
    name: 'Bazar Accounting',
    nameAr: 'المحاسبة',
    description: 'Automated accounting, VAT reports, and financial statements for your store.',
    descriptionAr: 'محاسبة تلقائية، تقارير ضريبة القيمة المضافة، وكشوف حسابات مالية.',
    icon: '📊',
    category: 'ACCOUNTING' as const,
    developer: 'BSMC.BH',
    developerEmail: 'support@bazar.bh',
    isOfficial: true,
    isApproved: true,
    pricingType: 'PAID' as const,
    monthlyPrice: 19,
  },
  {
    slug: 'bazar-crm',
    name: 'Bazar CRM',
    nameAr: 'إدارة العملاء CRM',
    description: 'Customer relationship management — track interactions, notes, and follow-ups.',
    descriptionAr: 'إدارة علاقات العملاء — تتبع التفاعلات والملاحظات ومتابعات المبيعات.',
    icon: '👥',
    category: 'CRM' as const,
    developer: 'BSMC.BH',
    developerEmail: 'support@bazar.bh',
    isOfficial: true,
    isApproved: true,
    pricingType: 'FREEMIUM' as const,
    monthlyPrice: 15,
  },
  {
    slug: 'aramex-shipping',
    name: 'Aramex',
    nameAr: 'أرامكس',
    description: 'Aramex shipping integration — automatic waybills, tracking, and rate calculation.',
    descriptionAr: 'تكامل شحن أرامكس — بوالص شحن تلقائية، تتبع الشحنات، وحساب التكلفة.',
    icon: '📦',
    category: 'SHIPPING' as const,
    developer: 'Aramex',
    developerEmail: 'api@aramex.com',
    isOfficial: false,
    isApproved: true,
    pricingType: 'FREE' as const,
  },
  {
    slug: 'dhl-express',
    name: 'DHL Express',
    nameAr: 'DHL Express',
    description: 'DHL express delivery — international and domestic shipments.',
    descriptionAr: 'شحن DHL السريع — شحنات دولية ومحلية.',
    icon: '✈️',
    category: 'SHIPPING' as const,
    developer: 'DHL',
    developerEmail: 'api@dhl.com',
    isOfficial: false,
    isApproved: true,
    pricingType: 'FREE' as const,
  },
  {
    slug: 'tiktok-shop',
    name: 'TikTok Shop',
    nameAr: 'متجر تيك توك',
    description: 'Sync your Bazar products with TikTok Shop and sell on TikTok.',
    descriptionAr: 'زامن منتجاتك مع متجر تيك توك وبع على المنصة.',
    icon: '🎵',
    category: 'SOCIAL' as const,
    developer: 'TikTok',
    developerEmail: 'apisupport@tiktok.com',
    isOfficial: false,
    isApproved: true,
    pricingType: 'FREE' as const,
  },
  {
    slug: 'facebook-catalog',
    name: 'Facebook & Instagram',
    nameAr: 'فيسبوك وإنستغرام',
    description: 'Sync products to Facebook Catalog and tag products in Instagram posts.',
    descriptionAr: 'زامن المنتجات مع فيسبوك كتالوج وإبراز المنتجات في منشورات إنستغرام.',
    icon: '📱',
    category: 'SOCIAL' as const,
    developer: 'Meta',
    developerEmail: 'apisupport@fb.com',
    isOfficial: false,
    isApproved: true,
    pricingType: 'FREE' as const,
  },
  {
    slug: 'google-analytics',
    name: 'Google Analytics 4',
    nameAr: 'تحليلات جوجل',
    description: 'Connect Google Analytics 4 to track storefront traffic and conversions.',
    descriptionAr: 'اربط تحليلات جوجل 4 لتتبع الزوار والتحويلات في متجرك.',
    icon: '📈',
    category: 'ANALYTICS' as const,
    developer: 'Google',
    developerEmail: 'analytics@google.com',
    isOfficial: false,
    isApproved: true,
    pricingType: 'FREE' as const,
  },
]

async function ensureOfficialApps() {
  for (const app of OFFICIAL_APPS) {
    await prisma.app.upsert({
      where: { slug: app.slug },
      update: {},
      create: {
        ...app,
        monthlyPrice: app.monthlyPrice ?? null,
      },
    })
  }
}

export async function appsRoutes(app: FastifyInstance) {
  // Seed official apps in background (don't await — avoids plugin timeout)
  ensureOfficialApps().catch(() => {})

  // ── List all apps ─────────────────────────────
  app.get('/', async (request, reply) => {
    const { category, storeId } = request.query as Record<string, string>

    const where: any = { isApproved: true, isActive: true }
    if (category) where.category = category

    const apps = await prisma.app.findMany({
      where,
      orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
    })

    // If storeId given, include installation status
    if (storeId) {
      await authenticate(request, reply)
      if (reply.sent) return

      const merchantId = (request.user as any).id
      const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true } })
      if (!store) return reply.status(403).send({ error: 'غير مصرح' })

      const installed = await prisma.installedApp.findMany({
        where: { storeId },
        select: { appId: true, isActive: true },
      })
      const installedMap = new Map(installed.map(i => [i.appId, i.isActive]))
      const appsWithStatus = apps.map(a => ({
        ...a,
        installed: installedMap.has(a.id),
        installedAndActive: installedMap.get(a.id) ?? false,
      }))
      return reply.send({ apps: appsWithStatus })
    }

    return reply.send({ apps })
  })

  // ── Get single app ────────────────────────────
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const appRecord = await prisma.app.findUnique({ where: { slug } })
    if (!appRecord) return reply.status(404).send({ error: 'التطبيق غير موجود' })
    return reply.send({ app: appRecord })
  })

  // ── Install app ───────────────────────────────
  app.post('/install', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      appId: z.string().cuid(),
      config: z.record(z.string(), z.unknown()).optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { storeId, appId, config } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const appRecord = await prisma.app.findUnique({ where: { id: appId, isApproved: true, isActive: true } })
    if (!appRecord) return reply.status(404).send({ error: 'التطبيق غير موجود' })

    const configValue = config ? (config as Prisma.InputJsonValue) : Prisma.JsonNull
    const installed = await prisma.installedApp.upsert({
      where: { storeId_appId: { storeId, appId } },
      create: { storeId, appId, isActive: true, config: configValue },
      update: { isActive: true, config: configValue },
    })

    return reply.send({ message: 'تم تثبيت التطبيق', installed })
  })

  // ── Uninstall app ─────────────────────────────
  app.post('/uninstall', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      appId: z.string().cuid(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { storeId, appId } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.installedApp.updateMany({
      where: { storeId, appId },
      data: { isActive: false },
    })

    return reply.send({ message: 'تم إلغاء تثبيت التطبيق' })
  })

  // ── Get installed apps for store ─────────────
  app.get('/installed', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const installed = await prisma.installedApp.findMany({
      where: { storeId, isActive: true },
      include: { app: true },
    })

    return reply.send({ apps: installed })
  })

  // ── Update app config ─────────────────────────
  app.put('/config', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      appId: z.string().cuid(),
      config: z.record(z.string(), z.unknown()),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'أمر غير صحيح' })

    const merchantId = (request.user as any).id
    const { storeId, appId, config } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const updated = await prisma.installedApp.updateMany({
      where: { storeId, appId },
      data: { config: config as Prisma.InputJsonValue },
    })

    return reply.send({ message: 'تم تحديث الإعدادات', updated: updated.count })
  })
}
