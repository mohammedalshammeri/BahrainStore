import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { PageType } from '@prisma/client'
import { authenticate } from '../middleware/auth.middleware'

const PAGE_TYPE_DEFAULTS: Record<string, { title: string; titleAr: string }> = {
  ABOUT: { title: 'About Us', titleAr: 'من نحن' },
  CONTACT: { title: 'Contact Us', titleAr: 'تواصل معنا' },
  PRIVACY: { title: 'Privacy Policy', titleAr: 'سياسة الخصوصية' },
  TERMS: { title: 'Terms & Conditions', titleAr: 'الشروط والأحكام' },
  SHIPPING_POLICY: { title: 'Shipping Policy', titleAr: 'سياسة الشحن' },
  RETURNS_POLICY: { title: 'Returns Policy', titleAr: 'سياسة الإرجاع' },
  FAQ: { title: 'FAQ', titleAr: 'الأسئلة الشائعة' },
  CUSTOM: { title: 'Custom Page', titleAr: 'صفحة مخصصة' },
}

export async function pagesRoutes(app: FastifyInstance) {
  // ── List pages ────────────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const pages = await prisma.page.findMany({
      where: { storeId },
      orderBy: [{ pageType: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, titleAr: true, slug: true, pageType: true, isActive: true, createdAt: true, updatedAt: true },
    })

    return reply.send({ pages })
  })

  // ── Get single page ───────────────────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const page = await prisma.page.findUnique({ where: { id } })
    if (!page) return reply.status(404).send({ error: 'الصفحة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: page.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    return reply.send({ page })
  })

  // ── Create page ───────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      title: z.string().min(1),
      titleAr: z.string().min(1),
      slug: z.string().min(1),
      content: z.string().default(''),
      contentAr: z.string().optional(),
      excerpt: z.string().optional(),
      pageType: z.nativeEnum(PageType).default(PageType.CUSTOM),
      isActive: z.boolean().default(true),
      seoTitle: z.string().optional(),
      seoDesc: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const exists = await prisma.page.findUnique({ where: { storeId_slug: { storeId, slug: data.slug } } })
    if (exists) return reply.status(409).send({ error: 'الـ slug مستخدم بالفعل' })

    const page = await prisma.page.create({ data: { storeId, ...data } })
    return reply.status(201).send({ page })
  })

  // ── Update page ───────────────────────────
  app.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      title: z.string().min(1).optional(),
      titleAr: z.string().optional(),
      content: z.string().optional(),
      contentAr: z.string().optional(),
      excerpt: z.string().optional(),
      isActive: z.boolean().optional(),
      seoTitle: z.string().optional(),
      seoDesc: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const existing = await prisma.page.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'الصفحة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: existing.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const page = await prisma.page.update({ where: { id }, data: result.data })
    return reply.send({ page })
  })

  // ── Delete page ───────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const existing = await prisma.page.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'الصفحة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: existing.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.page.delete({ where: { id } })
    return reply.send({ message: 'تم حذف الصفحة' })
  })

  // ── Public: get page by slug (storefront) ──
  app.get('/public/:storeSlug/:slug', async (request, reply) => {
    const { storeSlug, slug } = request.params as { storeSlug: string; slug: string }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store || !store.isActive) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const page = await prisma.page.findUnique({
      where: { storeId_slug: { storeId: store.id, slug } },
    })
    if (!page || !page.isActive) return reply.status(404).send({ error: 'الصفحة غير موجودة' })

    return reply.send({ page })
  })

  // ── Public: list all active pages for store ──
  app.get('/public/:storeSlug', async (request, reply) => {
    const { storeSlug } = request.params as { storeSlug: string }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store || !store.isActive) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const pages = await prisma.page.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { pageType: 'asc' },
      select: { id: true, title: true, titleAr: true, slug: true, pageType: true },
    })

    return reply.send({ pages })
  })
}
