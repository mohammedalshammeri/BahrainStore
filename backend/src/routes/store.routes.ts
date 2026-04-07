import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const homepageSectionTypeSchema = z.enum(['hero', 'banner', 'products_grid', 'categories', 'marquee', 'text', 'divider'])
const pageTypeSchema = z.enum(['homepage', 'product', 'collection', 'page', 'cart', 'checkout', 'blog'])
const pageSectionTypeSchema = z.enum(['hero', 'banner', 'products_grid', 'categories', 'marquee', 'text', 'divider', 'product_detail', 'related_products', 'cart', 'checkout', 'page_content', 'collection_header', 'collection_products', 'blog_posts', 'blog_post_content'])

const themeBlockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['text', 'button', 'image', 'icon', 'video', 'audio']),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  layout: z.record(z.string(), z.unknown()).optional(),
})

const themeSectionSchema = z.object({
  id: z.string().optional(),
  type: pageSectionTypeSchema,
  enabled: z.boolean().optional().default(true),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  layout: z.record(z.string(), z.unknown()).optional(),
  blocks: z.array(themeBlockSchema).optional().default([]),
})

const pageTemplateSchema = z.object({
  pageType: pageTypeSchema,
  sections: z.array(themeSectionSchema).default([]),
  themeId: z.string().optional(),
})

const reusableSectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  pageTypes: z.array(pageTypeSchema).min(1),
  section: themeSectionSchema,
  createdAt: z.string().optional(),
})

const themeSettingsSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  themeVariant: z.enum(['default', 'bold', 'elegant', 'fresh', 'dark']).optional(),
  heroVariant: z.enum(['default', 'bold', 'elegant', 'fresh', 'dark']).optional(),
  reusableSections: z.array(reusableSectionSchema).max(100).optional(),
})

type SupportedPageType = z.infer<typeof pageTypeSchema>

function getThemeTemplateKeys(pageType: SupportedPageType) {
  if (pageType === 'product') {
    return ['template.product.json', 'templates/product.json', 'product.json']
  }

  if (pageType === 'page') {
    return ['template.page.json', 'templates/page.json', 'page.json']
  }

  if (pageType === 'collection') {
    return ['template.collection.json', 'templates/collection.json', 'collection.json']
  }

  if (pageType === 'cart') {
    return ['template.cart.json', 'templates/cart.json', 'cart.json']
  }

  if (pageType === 'checkout') {
    return ['template.checkout.json', 'templates/checkout.json', 'checkout.json']
  }

  if (pageType === 'blog') {
    return ['template.blog.json', 'templates/blog.json', 'blog.json']
  }

  return ['template.homepage.json', 'templates/homepage.json', 'homepage.json']
}

function normalizeLegacyHomepageBlocks(blocks: unknown[]) {
  return blocks.flatMap((block, index) => {
    const parsedType = z.object({ type: homepageSectionTypeSchema, id: z.string().optional(), props: z.record(z.string(), z.unknown()).optional() }).safeParse(block)
    if (!parsedType.success) {
      return []
    }

    return [{
      id: parsedType.data.id ?? `legacy-${parsedType.data.type}-${index}`,
      type: parsedType.data.type,
      enabled: true,
      settings: parsedType.data.props ?? {},
      blocks: [],
    }]
  })
}

async function resolvePageTemplate(pageType: SupportedPageType, storeId: string, subdomain?: string) {
  const store = await prisma.store.findFirst({
    where: subdomain ? { subdomain, isActive: true } : { id: storeId },
    include: {
      settings: {
        select: {
          theme: true,
          homeBlocks: true,
          primaryColor: true,
          secondaryColor: true,
          fontFamily: true,
        },
      },
      themeConfigs: {
        where: { role: 'main' },
        include: {
          theme: {
            include: {
              assets: true,
            },
          },
          pageTemplates: {
            where: { pageType },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!store) {
    return null
  }

  const mainThemeConfig = store.themeConfigs[0] ?? null
  const storeTemplate = mainThemeConfig?.pageTemplates[0] ?? null
  const themeDefaultAsset = mainThemeConfig?.theme.assets.find((asset) =>
    getThemeTemplateKeys(pageType).includes(asset.key)
  ) ?? null

  const legacyBlocks = Array.isArray(store.settings?.homeBlocks) ? (store.settings?.homeBlocks as unknown[]) : []
  const themeSettings = (mainThemeConfig?.settingsData ?? {
    primaryColor: store.settings?.primaryColor,
    secondaryColor: store.settings?.secondaryColor,
    fontFamily: store.settings?.fontFamily,
    themeVariant: store.settings?.theme,
    heroVariant: store.settings?.theme,
  }) as Record<string, unknown>

  if (storeTemplate) {
    const parsed = pageTemplateSchema.safeParse(storeTemplate.content)
    if (parsed.success && parsed.data.pageType === pageType) {
      return {
        store,
        themeConfigId: mainThemeConfig?.id ?? null,
        themeId: mainThemeConfig?.themeId ?? null,
        themeSettings,
        template: parsed.data,
        source: 'store-template',
      }
    }
  }

  if (pageType === 'homepage' && legacyBlocks.length > 0) {
    return {
      store,
      themeConfigId: mainThemeConfig?.id ?? null,
      themeId: mainThemeConfig?.themeId ?? null,
      themeSettings,
      template: {
        pageType: 'homepage' as const,
        themeId: mainThemeConfig?.themeId,
        sections: normalizeLegacyHomepageBlocks(legacyBlocks),
      },
      source: 'store-template',
    }
  }

  if (themeDefaultAsset?.content) {
    try {
      const parsed = pageTemplateSchema.safeParse(JSON.parse(themeDefaultAsset.content))
      if (parsed.success && parsed.data.pageType === pageType) {
        return {
          store,
          themeConfigId: mainThemeConfig?.id ?? null,
          themeId: mainThemeConfig?.themeId ?? null,
          themeSettings,
          template: parsed.data,
          source: 'theme-template',
        }
      }
    } catch {
      // Ignore malformed theme asset and continue to emergency fallback.
    }
  }

  return {
    store,
    themeConfigId: mainThemeConfig?.id ?? null,
    themeId: mainThemeConfig?.themeId ?? null,
    themeSettings,
    template: null,
    source: 'emergency-template',
  }
}

async function resolveHomepageTemplate(storeId: string, subdomain?: string) {
  return resolvePageTemplate('homepage', storeId, subdomain)
}

async function ensureMainThemeConfig(storeId: string, themeSettings?: z.infer<typeof themeSettingsSchema>) {
  const existing = await prisma.storeThemeConfig.findFirst({
    where: { storeId, role: 'main' },
    orderBy: { updatedAt: 'desc' },
  })

  if (existing) {
    return existing
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { settings: true },
  })

  if (!store) {
    return null
  }

  const preferredThemeId = typeof store.settings?.theme === 'string' && store.settings.theme.trim().length > 0
    ? store.settings.theme.trim()
    : null

  const preferredTheme = preferredThemeId
    ? await prisma.theme.findFirst({ where: { id: preferredThemeId, isActive: true } })
    : null

  const fallbackTheme = preferredTheme ?? await prisma.theme.findFirst({
    where: { isActive: true, isApproved: true },
    orderBy: [
      { isFeatured: 'desc' },
      { createdAt: 'asc' },
    ],
  }) ?? await prisma.theme.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!fallbackTheme) {
    return null
  }

  const settingsData = {
    primaryColor: themeSettings?.primaryColor ?? store.settings?.primaryColor ?? undefined,
    secondaryColor: themeSettings?.secondaryColor ?? store.settings?.secondaryColor ?? undefined,
    fontFamily: themeSettings?.fontFamily ?? store.settings?.fontFamily ?? undefined,
    themeVariant: themeSettings?.themeVariant ?? store.settings?.theme ?? undefined,
    heroVariant: themeSettings?.heroVariant ?? store.settings?.theme ?? undefined,
  }

  return prisma.storeThemeConfig.create({
    data: {
      storeId,
      themeId: fallbackTheme.id,
      role: 'main',
      settingsData,
    },
  })
}

const createStoreSchema = z.object({
  name: z.string().min(2, 'اسم المتجر مطلوب'),
  nameAr: z.string().min(2, 'اسم المتجر بالعربي مطلوب'),
  subdomain: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام فقط'),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
})

const updateStoreSchema = createStoreSchema.partial().extend({
  logo: z.string().url().optional(),
  favicon: z.string().url().optional(),
  ogImage: z.string().url().optional(),
  language: z.enum(['AR', 'EN', 'BOTH']).optional(),
  timezone: z.string().optional(),
})

export async function storeRoutes(app: FastifyInstance) {
  function buildTemplateResponse(resolved: Awaited<ReturnType<typeof resolvePageTemplate>>) {
    return {
      blocks: resolved?.template?.sections ?? [],
      template: resolved?.template,
      source: resolved?.source,
      themeId: resolved?.themeId,
      themeConfigId: resolved?.themeConfigId,
      themeSettings: resolved?.themeSettings,
    }
  }

  // ── Create Store ──────────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const result = createStoreSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const { name, nameAr, subdomain, description, descriptionAr, vatNumber, crNumber } = result.data

    const existingSubdomain = await prisma.store.findUnique({ where: { subdomain } })
    if (existingSubdomain) {
      return reply.status(409).send({ error: 'هذا الرابط مستخدم، اختر رابطاً آخر' })
    }

    const store = await prisma.store.create({
      data: {
        merchantId,
        name,
        nameAr,
        subdomain,
        slug: subdomain,
        description,
        descriptionAr,
        vatNumber,
        crNumber,
        settings: { create: {} },
      },
      include: { settings: true },
    })

    return reply.status(201).send({ message: 'تم إنشاء المتجر بنجاح', store })
  })

  // ── Get My Stores ─────────────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id

    const stores = await prisma.store.findMany({
      where: { merchantId },
      include: {
        settings: true,
        _count: { select: { products: true, orders: true, customers: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ stores })
  })

  // ── Get Store by Subdomain (public) ───────────
  app.get('/s/:subdomain', async (request, reply) => {
    const { subdomain } = request.params as { subdomain: string }

    const store = await prisma.store.findUnique({
      where: { subdomain, isActive: true },
      select: {
        id: true, name: true, nameAr: true, subdomain: true,
        description: true, descriptionAr: true,
        logo: true, favicon: true, currency: true,
        language: true, vatRate: true,
        settings: { select: { primaryColor: true, secondaryColor: true, fontFamily: true, theme: true } },
      },
    })

    if (!store) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    return reply.send({ store })
  })

  // ── Get Store by ID (merchant only) ───────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({
      where: { id, merchantId },
      include: {
        settings: true,
        _count: { select: { products: true, orders: true, customers: true } },
      },
    })

    if (!store) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    return reply.send({ store })
  })

  // ── Update Store ──────────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const result = updateStoreSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const existing = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!existing) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    const { logo, favicon, ogImage, language, timezone, ...storeData } = result.data

    const store = await prisma.store.update({
      where: { id },
      data: { ...storeData, logo, favicon, ogImage, language, timezone },
      include: { settings: true },
    })

    return reply.send({ message: 'تم تحديث المتجر بنجاح', store })
  })

  // ── Update Store Settings ─────────────────────
  app.patch('/:id/settings', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const existing = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!existing) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    const settings = await prisma.storeSettings.update({
      where: { storeId: id },
      data: request.body as any,
    })

    return reply.send({ message: 'تم تحديث الإعدادات بنجاح', settings })
  })

  // ── Store Dashboard Stats ─────────────────────
  app.get('/:id/stats', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalOrders, todayOrders, totalRevenue, totalProducts, totalCustomers, recentOrders] =
      await Promise.all([
        prisma.order.count({ where: { storeId: id } }),
        prisma.order.count({ where: { storeId: id, createdAt: { gte: today } } }),
        prisma.order.aggregate({
          where: { storeId: id, paymentStatus: 'PAID' },
          _sum: { total: true },
        }),
        prisma.product.count({ where: { storeId: id, isActive: true } }),
        prisma.customer.count({ where: { storeId: id } }),
        prisma.order.findMany({
          where: { storeId: id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
            items: { select: { name: true, quantity: true, total: true } },
          },
        }),
      ])

    // Conversion rate: % of orders vs customers (simplified)
    const conversionRate = totalCustomers > 0
      ? Math.round((totalOrders / totalCustomers) * 100 * 10) / 10
      : 0

    // Repeat customers: customers with more than 1 order
    const repeatCustomers = await prisma.customer.count({
      where: { storeId: id, totalOrders: { gt: 1 } },
    })
    const repeatRate = totalCustomers > 0
      ? Math.round((repeatCustomers / totalCustomers) * 100 * 10) / 10
      : 0

    // Average order value
    const avgOrderValue = totalOrders > 0 && totalRevenue._sum.total
      ? Math.round((Number(totalRevenue._sum.total) / totalOrders) * 1000) / 1000
      : 0

    return reply.send({
      stats: {
        totalOrders,
        todayOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        totalProducts,
        totalCustomers,
        conversionRate,
        repeatCustomers,
        repeatRate,
        avgOrderValue,
      },
      recentOrders,
    })
  })

  // ── Export Stats as CSV ───────────────────────
  app.get('/:id/stats/export', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { period = '30' } = request.query as { period?: string }

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const days = Math.min(365, Math.max(1, parseInt(period) || 30))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const orders = await prisma.order.findMany({
      where: { storeId: id, createdAt: { gte: since } },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        items: { select: { nameAr: true, quantity: true, price: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows: string[] = [
      'رقم الطلب,التاريخ,الحالة,حالة الدفع,العميل,الهاتف,المجموع,طريقة الدفع',
    ]
    for (const o of orders) {
      const customerName = `${o.customer.firstName} ${o.customer.lastName}`
      rows.push(
        [
          o.orderNumber,
          o.createdAt.toISOString().slice(0, 10),
          o.status,
          o.paymentStatus,
          `"${customerName}"`,
          o.customer.phone,
          Number(o.total).toFixed(3),
          o.paymentMethod,
        ].join(',')
      )
    }

    const csv = rows.join('\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="orders-${store.subdomain}-${period}d.csv"`)
    return reply.send('\uFEFF' + csv) // BOM for Arabic UTF-8 Excel
  })

  // ── Page Builder: Get Homepage Blocks ─────────
  app.get('/:id/homepage', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id, merchantId }, select: { id: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const resolved = await resolveHomepageTemplate(id)
    if (!resolved) return reply.status(404).send({ error: 'المتجر غير موجود' })

    return reply.send(buildTemplateResponse(resolved))
  })

  app.get('/:id/templates/:pageType', { preHandler: authenticate }, async (request, reply) => {
    const { id, pageType } = request.params as { id: string; pageType: string }
    const merchantId = (request.user as any).id

    const parsedPageType = pageTypeSchema.safeParse(pageType)
    if (!parsedPageType.success) {
      return reply.status(400).send({ error: 'pageType غير مدعوم' })
    }

    const store = await prisma.store.findFirst({ where: { id, merchantId }, select: { id: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const resolved = await resolvePageTemplate(parsedPageType.data, id)
    if (!resolved) return reply.status(404).send({ error: 'المتجر غير موجود' })

    return reply.send(buildTemplateResponse(resolved))
  })

  // ── Page Builder: Save Homepage Blocks ────────
  app.put('/:id/homepage', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const body = request.body as { blocks?: unknown[]; template?: unknown; themeSettings?: unknown }

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const templateCandidate = body.template ?? {
      pageType: 'homepage',
      sections: Array.isArray(body.blocks) ? normalizeLegacyHomepageBlocks(body.blocks) : undefined,
    }

    const parsedTemplate = pageTemplateSchema.safeParse(templateCandidate)
    if (!parsedTemplate.success) {
      return reply.status(400).send({ error: 'template غير صالح', details: parsedTemplate.error.flatten() })
    }

    const parsedThemeSettings = themeSettingsSchema.safeParse(body.themeSettings ?? undefined)
    if (body.themeSettings !== undefined && !parsedThemeSettings.success) {
      return reply.status(400).send({ error: 'themeSettings غير صالح', details: parsedThemeSettings.error.flatten() })
    }

    const mainThemeConfig = await ensureMainThemeConfig(
      id,
      parsedThemeSettings.success ? parsedThemeSettings.data : undefined,
    )

    if (!mainThemeConfig) {
      return reply.status(409).send({
        error: 'لا يمكن حفظ تصميم الصفحة الرئيسية قبل تفعيل ثيم رئيسي للمتجر',
        code: 'MAIN_THEME_CONFIG_REQUIRED',
      })
    }

    await prisma.storePageTemplate.upsert({
      where: {
        storeId_themeConfigId_pageType: {
          storeId: id,
          themeConfigId: mainThemeConfig.id,
          pageType: 'homepage',
        },
      },
      update: { content: parsedTemplate.data as any },
      create: {
        storeId: id,
        themeConfigId: mainThemeConfig.id,
        pageType: 'homepage',
        content: parsedTemplate.data as any,
      },
    })

    if (parsedThemeSettings.success && body.themeSettings !== undefined) {
      await prisma.storeThemeConfig.update({
        where: { id: mainThemeConfig.id },
        data: { settingsData: parsedThemeSettings.data as any },
      })
    }

    return reply.send({ message: 'تم حفظ تصميم الصفحة الرئيسية' })
  })

  app.put('/:id/templates/:pageType', { preHandler: authenticate }, async (request, reply) => {
    const { id, pageType } = request.params as { id: string; pageType: string }
    const merchantId = (request.user as any).id
    const body = request.body as { blocks?: unknown[]; template?: unknown; themeSettings?: unknown }

    const parsedPageType = pageTypeSchema.safeParse(pageType)
    if (!parsedPageType.success) {
      return reply.status(400).send({ error: 'pageType غير مدعوم' })
    }

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const templateCandidate = body.template ?? {
      pageType: parsedPageType.data,
      sections: parsedPageType.data === 'homepage' && Array.isArray(body.blocks)
        ? normalizeLegacyHomepageBlocks(body.blocks)
        : [],
    }

    const parsedTemplate = pageTemplateSchema.safeParse(templateCandidate)
    if (!parsedTemplate.success || parsedTemplate.data.pageType !== parsedPageType.data) {
      return reply.status(400).send({ error: 'template غير صالح', details: parsedTemplate.success ? undefined : parsedTemplate.error.flatten() })
    }

    const parsedThemeSettings = themeSettingsSchema.safeParse(body.themeSettings ?? undefined)
    if (body.themeSettings !== undefined && !parsedThemeSettings.success) {
      return reply.status(400).send({ error: 'themeSettings غير صالح', details: parsedThemeSettings.error.flatten() })
    }

    const mainThemeConfig = await ensureMainThemeConfig(
      id,
      parsedThemeSettings.success ? parsedThemeSettings.data : undefined,
    )

    if (!mainThemeConfig) {
      return reply.status(409).send({
        error: 'لا يمكن حفظ الصفحة قبل تفعيل ثيم رئيسي للمتجر',
        code: 'MAIN_THEME_CONFIG_REQUIRED',
      })
    }

    await prisma.storePageTemplate.upsert({
      where: {
        storeId_themeConfigId_pageType: {
          storeId: id,
          themeConfigId: mainThemeConfig.id,
          pageType: parsedPageType.data,
        },
      },
      update: { content: parsedTemplate.data as any },
      create: {
        storeId: id,
        themeConfigId: mainThemeConfig.id,
        pageType: parsedPageType.data,
        content: parsedTemplate.data as any,
      },
    })

    if (parsedThemeSettings.success && body.themeSettings !== undefined) {
      await prisma.storeThemeConfig.update({
        where: { id: mainThemeConfig.id },
        data: { settingsData: parsedThemeSettings.data as any },
      })
    }

    return reply.send({ message: `تم حفظ تصميم صفحة ${parsedPageType.data}` })
  })

  // ── Page Builder: Get Homepage (public) ───────
  app.get('/s/:subdomain/homepage', async (request, reply) => {
    const { subdomain } = request.params as { subdomain: string }

    const resolved = await resolveHomepageTemplate('', subdomain)
    if (!resolved) return reply.status(404).send({ error: 'المتجر غير موجود' })

    return reply.send(buildTemplateResponse(resolved))
  })

  app.get('/s/:subdomain/templates/:pageType', async (request, reply) => {
    const { subdomain, pageType } = request.params as { subdomain: string; pageType: string }

    const parsedPageType = pageTypeSchema.safeParse(pageType)
    if (!parsedPageType.success) {
      return reply.status(400).send({ error: 'pageType غير مدعوم' })
    }

    const resolved = await resolvePageTemplate(parsedPageType.data, '', subdomain)
    if (!resolved) return reply.status(404).send({ error: 'المتجر غير موجود' })

    return reply.send(buildTemplateResponse(resolved))
  })
}
