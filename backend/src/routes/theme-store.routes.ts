import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { requireAdmin, requirePlatformPermission } from '../middleware/auth.middleware'
import { buildThemeManifestAsset, buildThemePackageBuffer, parseThemePackageBuffer, resolveThemeChangelogFromAssets, resolveThemeManifestFromAssets, themePackageManifestSchema } from '../lib/theme-package'

const quickThemeSettingsSchema = z.object({
  primaryColor: z.string().min(4).max(32).optional(),
  secondaryColor: z.string().min(4).max(32).optional(),
  fontFamily: z.string().min(1).max(120).optional(),
})

async function getMerchantStoreOrThrow(storeId: string, merchantId: string) {
  return prisma.store.findFirst({
    where: { id: storeId, merchantId },
    include: { settings: true },
  })
}

async function applyThemeToStore(params: {
  storeId: string
  themeId: string
  themeSettings?: z.infer<typeof quickThemeSettingsSchema>
  installedVersion?: string
}) {
  const { storeId, themeId, themeSettings, installedVersion } = params
  const sanitizedSettings = quickThemeSettingsSchema.parse(themeSettings ?? {})

  const mainThemeConfig = await prisma.storeThemeConfig.findFirst({
    where: { storeId, role: 'main' },
    orderBy: { createdAt: 'asc' },
  })

  const existingSettings =
    mainThemeConfig?.settingsData && typeof mainThemeConfig.settingsData === 'object' && !Array.isArray(mainThemeConfig.settingsData)
      ? { ...(mainThemeConfig.settingsData as Record<string, unknown>) }
      : {}

  const previousThemeId = mainThemeConfig?.themeId && mainThemeConfig.themeId !== themeId
    ? mainThemeConfig.themeId
    : typeof existingSettings.previousThemeId === 'string'
      ? existingSettings.previousThemeId
      : undefined
  const previousInstalledVersion =
    mainThemeConfig?.themeId && mainThemeConfig.themeId !== themeId
      ? typeof existingSettings.installedVersion === 'string'
        ? existingSettings.installedVersion
        : undefined
      : typeof existingSettings.previousInstalledVersion === 'string'
        ? existingSettings.previousInstalledVersion
        : undefined

  const mergedSettings = {
    ...existingSettings,
    ...sanitizedSettings,
    ...(previousThemeId ? { previousThemeId } : {}),
    ...(previousInstalledVersion ? { previousInstalledVersion } : {}),
    ...(installedVersion ? { installedVersion } : {}),
  }

  const themeConfig = mainThemeConfig
    ? await prisma.storeThemeConfig.update({
        where: { id: mainThemeConfig.id },
        data: Object.keys(mergedSettings).length > 0
          ? {
              themeId,
              settingsData: mergedSettings,
            }
          : {
              themeId,
            },
      })
    : await prisma.storeThemeConfig.create({
        data: {
          storeId,
          themeId,
          role: 'main',
          settingsData: Object.keys(mergedSettings).length > 0
            ? mergedSettings
            : undefined,
        },
      })

  const legacySettingsPatch: Record<string, string> = { theme: themeId }
  if (sanitizedSettings.primaryColor) legacySettingsPatch.primaryColor = sanitizedSettings.primaryColor
  if (sanitizedSettings.secondaryColor) legacySettingsPatch.secondaryColor = sanitizedSettings.secondaryColor
  if (sanitizedSettings.fontFamily) legacySettingsPatch.fontFamily = sanitizedSettings.fontFamily

  await prisma.storeSettings.updateMany({
    where: { storeId },
    data: legacySettingsPatch,
  })

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { settings: true },
  })

  return { themeConfig, store }
}

// ─── Theme Store Routes ────────────────────────────────────────────────────────

export async function themeStoreRoutes(app: FastifyInstance) {
  // GET /themes — Browse themes (public)
  app.get('/', async (request, reply) => {
    const { isPremium, q = '', search = '', page = 1, limit = 12 } = request.query as {
      isPremium?: string; q?: string; search?: string; page?: number; limit?: number
    }
    const query = `${q || search}`.trim()

    const where: any = { isActive: true, isApproved: true }
    if (isPremium !== undefined) where.isPremium = isPremium === 'true'
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { nameAr: { contains: query, mode: 'insensitive' } },
        { authorName: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ]
    }

    const [themes, total] = await Promise.all([
      prisma.theme.findMany({
        where,
        orderBy: [{ installCount: 'desc' }, { rating: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true, slug: true, name: true, nameAr: true, description: true, descriptionAr: true,
          thumbnailUrl: true, demoUrl: true, price: true, isPremium: true,
          authorName: true, installCount: true, rating: true, ratingCount: true, tags: true,
        },
      }),
      prisma.theme.count({ where }),
    ])

    return reply.send({ themes, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // GET /themes/:slug — Theme details
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const theme = await prisma.theme.findUnique({
      where: { slug, isActive: true, isApproved: true },
    })
    if (!theme) return reply.status(404).send({ error: 'القالب غير موجود' })
    return reply.send({ theme })
  })

  // POST /themes/purchase — Purchase/install a theme
  app.post('/purchase', { preHandler: authenticate }, async (request, reply) => {
    const { themeId, storeId } = request.body as { themeId: string; storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const theme = await prisma.theme.findUnique({ where: { id: themeId }, include: { assets: true } })
    if (!theme || !theme.isActive) return reply.status(404).send({ error: 'القالب غير موجود' })

    const existing = await prisma.themePurchase.findUnique({
      where: { themeId_storeId: { themeId, storeId } },
    })
    if (existing) return reply.status(400).send({ error: 'لديك هذا القالب بالفعل' })

    const purchase = await prisma.themePurchase.create({
      data: { themeId, storeId, amount: theme.price },
    })

    await prisma.theme.update({ where: { id: themeId }, data: { installCount: { increment: 1 } } })

    return reply.status(201).send({ message: 'تم تثبيت القالب بنجاح', purchase })
  })

  // POST /themes/activate — Activate a purchased theme on a store
  app.post('/activate', { preHandler: authenticate }, async (request, reply) => {
    const result = z.object({
      themeId: z.string().min(1),
      storeId: z.string().min(1),
      themeSettings: quickThemeSettingsSchema.optional(),
    }).safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const { themeId, storeId, themeSettings } = result.data

    const store = await getMerchantStoreOrThrow(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const purchase = await prisma.themePurchase.findUnique({
      where: { themeId_storeId: { themeId, storeId } },
    })
    if (!purchase) return reply.status(400).send({ error: 'قم بتثبيت القالب أولاً' })

    const theme = await prisma.theme.findUnique({ where: { id: themeId, isActive: true }, include: { assets: true } })
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

    const applied = await applyThemeToStore({ storeId, themeId, themeSettings, installedVersion: manifest.version })
    return reply.send({
      message: 'تم تفعيل القالب على المتجر',
      theme: { ...theme, availableVersion: manifest.version },
      activeThemeId: themeId,
      themeConfig: applied.themeConfig,
      store: applied.store,
    })
  })

  // PATCH /themes/:themeId/customize — Quick theme customization for installed themes
  app.patch('/:themeId/customize', { preHandler: authenticate }, async (request, reply) => {
    const { themeId } = request.params as { themeId: string }
    const result = z.object({
      storeId: z.string().min(1),
      primaryColor: z.string().min(4).max(32).optional(),
      secondaryColor: z.string().min(4).max(32).optional(),
      fontFamily: z.string().min(1).max(120).optional(),
    }).safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const store = await getMerchantStoreOrThrow(result.data.storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const purchase = await prisma.themePurchase.findUnique({
      where: { themeId_storeId: { themeId, storeId: result.data.storeId } },
    })
    if (!purchase) return reply.status(400).send({ error: 'قم بتثبيت القالب أولاً' })

    const theme = await prisma.theme.findUnique({ where: { id: themeId, isActive: true }, include: { assets: true } })
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

    const applied = await applyThemeToStore({
      storeId: result.data.storeId,
      themeId,
      installedVersion: manifest.version,
      themeSettings: {
        primaryColor: result.data.primaryColor,
        secondaryColor: result.data.secondaryColor,
        fontFamily: result.data.fontFamily,
      },
    })

    return reply.send({
      message: 'تم تطبيق تخصيص القالب',
      activeThemeId: themeId,
      themeConfig: applied.themeConfig,
      store: applied.store,
    })
  })

  // GET /themes/purchased/:storeId — Purchased themes for a store
  app.get('/purchased/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const [purchases, activeThemeConfig] = await Promise.all([
      prisma.themePurchase.findMany({
        where: { storeId },
        include: { theme: { include: { assets: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.storeThemeConfig.findFirst({
        where: { storeId, role: 'main' },
        select: { themeId: true, settingsData: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const activeThemeSettings =
      activeThemeConfig?.settingsData && typeof activeThemeConfig.settingsData === 'object' && !Array.isArray(activeThemeConfig.settingsData)
        ? (activeThemeConfig.settingsData as Record<string, unknown>)
        : {}
    const installedVersion = typeof activeThemeSettings.installedVersion === 'string' ? activeThemeSettings.installedVersion : null

    return reply.send({
      activeThemeId: activeThemeConfig?.themeId ?? null,
      themes: purchases.map((p) => ({
        ...p.theme,
        availableVersion: resolveThemeManifestFromAssets(p.theme.assets, {
          slug: p.theme.slug,
          name: p.theme.name,
          nameAr: p.theme.nameAr,
          description: p.theme.description ?? undefined,
          descriptionAr: p.theme.descriptionAr ?? undefined,
          version: '1.0.0',
          price: Number(p.theme.price),
          tags: p.theme.tags,
          previewUrl: p.theme.previewUrl ?? undefined,
          thumbnailUrl: p.theme.thumbnailUrl ?? undefined,
          demoUrl: p.theme.demoUrl ?? undefined,
        }).version,
        themeId: p.themeId,
        licenseKey: p.licenseKey,
        purchasedAt: p.createdAt,
        installedVersion: p.themeId === activeThemeConfig?.themeId ? installedVersion : null,
        rollbackThemeId:
          p.themeId === activeThemeConfig?.themeId && typeof activeThemeSettings.previousThemeId === 'string'
            ? activeThemeSettings.previousThemeId
            : null,
        changelog: resolveThemeChangelogFromAssets(p.theme.assets),
        hasUpdateAvailable:
          p.themeId === activeThemeConfig?.themeId
            ? installedVersion !== resolveThemeManifestFromAssets(p.theme.assets, {
                slug: p.theme.slug,
                name: p.theme.name,
                nameAr: p.theme.nameAr,
                description: p.theme.description ?? undefined,
                descriptionAr: p.theme.descriptionAr ?? undefined,
                version: '1.0.0',
                price: Number(p.theme.price),
                tags: p.theme.tags,
                previewUrl: p.theme.previewUrl ?? undefined,
                thumbnailUrl: p.theme.thumbnailUrl ?? undefined,
                demoUrl: p.theme.demoUrl ?? undefined,
              }).version
            : false,
        latestVersionUpdatedAt: p.theme.updatedAt,
        isActive: p.themeId === activeThemeConfig?.themeId,
      })),
    })
  })

  // GET /themes/purchased?storeId=... — Compatibility alias for dashboard clients
  app.get('/purchased', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const [purchases, activeThemeConfig] = await Promise.all([
      prisma.themePurchase.findMany({
        where: { storeId },
        include: { theme: { include: { assets: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.storeThemeConfig.findFirst({
        where: { storeId, role: 'main' },
        select: { themeId: true, settingsData: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const activeThemeSettings =
      activeThemeConfig?.settingsData && typeof activeThemeConfig.settingsData === 'object' && !Array.isArray(activeThemeConfig.settingsData)
        ? (activeThemeConfig.settingsData as Record<string, unknown>)
        : {}
    const installedVersion = typeof activeThemeSettings.installedVersion === 'string' ? activeThemeSettings.installedVersion : null

    return reply.send({
      activeThemeId: activeThemeConfig?.themeId ?? null,
      themes: purchases.map((p) => ({
        ...p.theme,
        availableVersion: resolveThemeManifestFromAssets(p.theme.assets, {
          slug: p.theme.slug,
          name: p.theme.name,
          nameAr: p.theme.nameAr,
          description: p.theme.description ?? undefined,
          descriptionAr: p.theme.descriptionAr ?? undefined,
          version: '1.0.0',
          price: Number(p.theme.price),
          tags: p.theme.tags,
          previewUrl: p.theme.previewUrl ?? undefined,
          thumbnailUrl: p.theme.thumbnailUrl ?? undefined,
          demoUrl: p.theme.demoUrl ?? undefined,
        }).version,
        themeId: p.themeId,
        licenseKey: p.licenseKey,
        purchasedAt: p.createdAt,
        installedVersion: p.themeId === activeThemeConfig?.themeId ? installedVersion : null,
        rollbackThemeId:
          p.themeId === activeThemeConfig?.themeId && typeof activeThemeSettings.previousThemeId === 'string'
            ? activeThemeSettings.previousThemeId
            : null,
        changelog: resolveThemeChangelogFromAssets(p.theme.assets),
        hasUpdateAvailable:
          p.themeId === activeThemeConfig?.themeId
            ? installedVersion !== resolveThemeManifestFromAssets(p.theme.assets, {
                slug: p.theme.slug,
                name: p.theme.name,
                nameAr: p.theme.nameAr,
                description: p.theme.description ?? undefined,
                descriptionAr: p.theme.descriptionAr ?? undefined,
                version: '1.0.0',
                price: Number(p.theme.price),
                tags: p.theme.tags,
                previewUrl: p.theme.previewUrl ?? undefined,
                thumbnailUrl: p.theme.thumbnailUrl ?? undefined,
                demoUrl: p.theme.demoUrl ?? undefined,
              }).version
            : false,
        latestVersionUpdatedAt: p.theme.updatedAt,
        isActive: p.themeId === activeThemeConfig?.themeId,
      })),
    })
  })

  // POST /themes/submit — Author submits a theme
  app.post('/submit', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
      name: z.string().min(1),
      nameAr: z.string().min(1),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      previewUrl: z.string().url().optional(),
      thumbnailUrl: z.string().url().optional(),
      demoUrl: z.string().url().optional(),
      price: z.number().min(0).default(0),
      tags: z.array(z.string()).default([]),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchant = request.user as any
    const theme = await prisma.theme.create({
      data: {
        ...result.data,
        authorName: merchant.firstName + ' ' + merchant.lastName,
        authorEmail: merchant.email,
        isPremium: result.data.price > 0,
        isApproved: false, // Needs admin approval
      },
    })

    return reply.status(201).send({ message: 'تم رفع القالب وهو قيد المراجعة من فريق Bazar', theme })
  })

  // POST /themes/validate-package — Validate a theme zip before import
  app.post('/validate-package', { preHandler: authenticate }, async (request, reply) => {
    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'ملف الحزمة مطلوب' })

    try {
      const parsedPackage = parseThemePackageBuffer(await file.toBuffer())
      return reply.send({
        manifest: parsedPackage.manifest,
        assets: parsedPackage.assets.map((asset) => ({ key: asset.key, mimeType: asset.mimeType })),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر التحقق من الحزمة'
      return reply.status(400).send({ error: message })
    }
  })

  // POST /themes/import-package — Import/update theme package assets from zip
  app.post('/import-package', { preHandler: authenticate }, async (request, reply) => {
    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'ملف الحزمة مطلوب' })

    const merchant = request.user as any

    try {
      const parsedPackage = parseThemePackageBuffer(await file.toBuffer())
      const manifest = themePackageManifestSchema.parse(parsedPackage.manifest)

      const existingTheme = await prisma.theme.findUnique({ where: { slug: manifest.slug } })
      if (existingTheme && existingTheme.authorEmail && existingTheme.authorEmail !== merchant.email) {
        return reply.status(403).send({ error: 'لا يمكنك تحديث قالب يخص مطوراً آخر' })
      }

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
              authorName: `${merchant.firstName ?? ''} ${merchant.lastName ?? ''}`.trim() || merchant.email,
              authorEmail: merchant.email,
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
        message: existingTheme ? 'تم تحديث حزمة القالب وإعادة إرساله للمراجعة' : 'تم استيراد حزمة القالب بنجاح',
        theme,
        assetsCount: parsedPackage.assets.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر استيراد الحزمة'
      return reply.status(400).send({ error: message })
    }
  })

  // GET /themes/:slug/export-package — Export theme assets as zip
  app.get('/:slug/export-package', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const theme = await prisma.theme.findUnique({
      where: { slug, isActive: true, isApproved: true },
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

  // POST /themes/rollback — Roll back active theme to the previous installed theme
  app.post('/rollback', { preHandler: authenticate }, async (request, reply) => {
    const result = z.object({
      storeId: z.string().min(1),
    }).safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const { storeId } = result.data

    const store = await getMerchantStoreOrThrow(storeId, merchantId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const activeThemeConfig = await prisma.storeThemeConfig.findFirst({
      where: { storeId, role: 'main' },
      orderBy: { createdAt: 'asc' },
    })
    if (!activeThemeConfig) return reply.status(400).send({ error: 'لا يوجد قالب نشط للرجوع عنه' })

    const settingsData =
      activeThemeConfig.settingsData && typeof activeThemeConfig.settingsData === 'object' && !Array.isArray(activeThemeConfig.settingsData)
        ? (activeThemeConfig.settingsData as Record<string, unknown>)
        : {}

    const previousThemeId = typeof settingsData.previousThemeId === 'string' ? settingsData.previousThemeId : null
    if (!previousThemeId || previousThemeId === activeThemeConfig.themeId) {
      return reply.status(400).send({ error: 'لا توجد نسخة سابقة متاحة للرجوع' })
    }

    const purchase = await prisma.themePurchase.findUnique({
      where: { themeId_storeId: { themeId: previousThemeId, storeId } },
    })
    if (!purchase) return reply.status(400).send({ error: 'القالب السابق غير مثبت على هذا المتجر' })

    const previousTheme = await prisma.theme.findUnique({ where: { id: previousThemeId, isActive: true }, include: { assets: true } })
    if (!previousTheme) return reply.status(404).send({ error: 'القالب السابق غير متاح حالياً' })

    const manifest = resolveThemeManifestFromAssets(previousTheme.assets, {
      slug: previousTheme.slug,
      name: previousTheme.name,
      nameAr: previousTheme.nameAr,
      description: previousTheme.description ?? undefined,
      descriptionAr: previousTheme.descriptionAr ?? undefined,
      version: '1.0.0',
      price: Number(previousTheme.price),
      tags: previousTheme.tags,
      previewUrl: previousTheme.previewUrl ?? undefined,
      thumbnailUrl: previousTheme.thumbnailUrl ?? undefined,
      demoUrl: previousTheme.demoUrl ?? undefined,
    })

    const applied = await applyThemeToStore({
      storeId,
      themeId: previousThemeId,
      installedVersion: manifest.version,
    })

    return reply.send({
      message: 'تم الرجوع إلى القالب السابق بنجاح',
      activeThemeId: previousThemeId,
      themeConfig: applied.themeConfig,
      store: applied.store,
    })
  })

  // PATCH /themes/:id/approve — Admin approves theme
  app.patch('/:id/approve', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const theme = await prisma.theme.update({
      where: { id },
      data: { isApproved: true },
    })
    return reply.send({ message: 'تمت الموافقة على القالب', theme })
  })

  // GET /themes/admin/all — Admin: all themes including unapproved
  app.get('/admin/all', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canManageApps')] }, async (request, reply) => {
    const themes = await prisma.theme.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ themes })
  })
}
