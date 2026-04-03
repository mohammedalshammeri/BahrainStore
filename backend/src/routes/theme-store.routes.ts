import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { requireAdmin } from '../middleware/auth.middleware'

// ─── Theme Store Routes ────────────────────────────────────────────────────────

export async function themeStoreRoutes(app: FastifyInstance) {
  // GET /themes — Browse themes (public)
  app.get('/', async (request, reply) => {
    const { isPremium, q = '', page = 1, limit = 12 } = request.query as {
      isPremium?: string; q?: string; page?: number; limit?: number
    }

    const where: any = { isActive: true, isApproved: true }
    if (isPremium !== undefined) where.isPremium = isPremium === 'true'
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
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

    const theme = await prisma.theme.findUnique({ where: { id: themeId } })
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

  // GET /themes/purchased/:storeId — Purchased themes for a store
  app.get('/purchased/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const purchases = await prisma.themePurchase.findMany({
      where: { storeId },
      include: { theme: true },
    })

    return reply.send({ themes: purchases.map((p) => ({ ...p.theme, licenseKey: p.licenseKey, purchasedAt: p.createdAt })) })
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

  // PATCH /themes/:id/approve — Admin approves theme
  app.patch('/:id/approve', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const theme = await prisma.theme.update({
      where: { id },
      data: { isApproved: true },
    })
    return reply.send({ message: 'تمت الموافقة على القالب', theme })
  })

  // GET /themes/admin/all — Admin: all themes including unapproved
  app.get('/admin/all', { preHandler: requireAdmin }, async (request, reply) => {
    const themes = await prisma.theme.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ themes })
  })
}
