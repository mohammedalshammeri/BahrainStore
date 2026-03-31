import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u0600-\u06FF]/g, (c) => c) // keep Arabic
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-|-$/g, '') || `post-${Date.now()}`
}

export async function blogRoutes(app: FastifyInstance) {
  // ── List posts (auth) ─────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, page = '1', limit = '20', search } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (Number(page) - 1) * Number(limit)
    const where: any = { storeId }
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { titleAr: { contains: search, mode: 'insensitive' } },
    ]

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        select: { id: true, title: true, titleAr: true, slug: true, isPublished: true, publishedAt: true, coverImage: true, views: true, tags: true, createdAt: true },
      }),
      prisma.blogPost.count({ where }),
    ])

    return reply.send({ posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // ── Get single post ───────────────────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const post = await prisma.blogPost.findUnique({ where: { id } })
    if (!post) return reply.status(404).send({ error: 'المقال غير موجود' })

    const store = await prisma.store.findFirst({ where: { id: post.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    return reply.send({ post })
  })

  // ── Create post ───────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      title: z.string().min(1),
      titleAr: z.string().optional(),
      slug: z.string().optional(),
      content: z.string().min(1),
      contentAr: z.string().optional(),
      excerpt: z.string().optional(),
      coverImage: z.string().url().optional().or(z.literal('')),
      isPublished: z.boolean().default(false),
      seoTitle: z.string().optional(),
      seoDesc: z.string().optional(),
      tags: z.array(z.string()).default([]),
      authorName: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchantId = (request.user as any).id
    const { storeId, slug, isPublished, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const resolvedSlug = slug || generateSlug(data.title)
    const base = resolvedSlug
    let finalSlug = base
    let i = 1
    while (await prisma.blogPost.findUnique({ where: { storeId_slug: { storeId, slug: finalSlug } } })) {
      finalSlug = `${base}-${i++}`
    }

    const post = await prisma.blogPost.create({
      data: {
        storeId,
        ...data,
        slug: finalSlug,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
    })

    return reply.status(201).send({ post })
  })

  // ── Update post ───────────────────────────
  app.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      title: z.string().min(1).optional(),
      titleAr: z.string().optional(),
      content: z.string().optional(),
      contentAr: z.string().optional(),
      excerpt: z.string().optional(),
      coverImage: z.string().optional(),
      isPublished: z.boolean().optional(),
      seoTitle: z.string().optional(),
      seoDesc: z.string().optional(),
      tags: z.array(z.string()).optional(),
      authorName: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'المقال غير موجود' })

    const store = await prisma.store.findFirst({ where: { id: existing.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const { isPublished, ...rest } = result.data
    const updateData: any = { ...rest }
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished
      if (isPublished && !existing.publishedAt) updateData.publishedAt = new Date()
    }

    const post = await prisma.blogPost.update({ where: { id }, data: updateData })
    return reply.send({ post })
  })

  // ── Delete post ───────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const existing = await prisma.blogPost.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'المقال غير موجود' })

    const store = await prisma.store.findFirst({ where: { id: existing.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.blogPost.delete({ where: { id } })
    return reply.send({ message: 'تم حذف المقال' })
  })

  // ── Public: list published posts (storefront) ──
  app.get('/public/:storeSlug', async (request, reply) => {
    const { storeSlug } = request.params as { storeSlug: string }
    const { page = '1', limit = '12' } = request.query as Record<string, string>

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store || !store.isActive) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const skip = (Number(page) - 1) * Number(limit)
    const where = { storeId: store.id, isPublished: true }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: Number(limit),
        select: { id: true, title: true, titleAr: true, slug: true, excerpt: true, coverImage: true, publishedAt: true, tags: true, authorName: true, views: true },
      }),
      prisma.blogPost.count({ where }),
    ])

    return reply.send({ posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // ── Public: single post by slug (increments views) ──
  app.get('/public/:storeSlug/:slug', async (request, reply) => {
    const { storeSlug, slug } = request.params as { storeSlug: string; slug: string }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store || !store.isActive) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const post = await prisma.blogPost.findUnique({
      where: { storeId_slug: { storeId: store.id, slug } },
    })
    if (!post || !post.isPublished) return reply.status(404).send({ error: 'المقال غير موجود' })

    // increment views fire-and-forget
    prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {})

    return reply.send({ post })
  })
}
