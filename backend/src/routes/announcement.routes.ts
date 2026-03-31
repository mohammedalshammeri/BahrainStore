import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function announcementRoutes(fastify: FastifyInstance) {
  // ── ANNOUNCEMENTS ──────────────────────────────────────────────

  // GET all (admin)
  fastify.get('/announcements/admin', { preHandler: authenticate }, async (req: any, reply) => {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })
    return announcements
  })

  // GET active (for merchant dashboards)
  fastify.get('/announcements/active', async (_req, reply) => {
    const now = new Date()
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })
    return announcements
  })

  // POST create (admin)
  fastify.post('/announcements/admin', { preHandler: authenticate }, async (req: any, reply) => {
    const { title, titleAr, body, bodyAr, type, isActive, isPinned, startsAt, endsAt } = req.body as any
    if (!title || !titleAr) return reply.code(400).send({ error: 'title and titleAr required' })

    const ann = await prisma.announcement.create({
      data: {
        title,
        titleAr,
        body: body ?? null,
        bodyAr: bodyAr ?? null,
        type: type ?? 'INFO',
        isActive: isActive ?? true,
        isPinned: isPinned ?? false,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    })
    return reply.code(201).send(ann)
  })

  // PUT update (admin)
  fastify.put('/announcements/admin/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    const data = req.body as any

    const ann = await prisma.announcement.update({
      where: { id },
      data: {
        title: data.title,
        titleAr: data.titleAr,
        body: data.body ?? null,
        bodyAr: data.bodyAr ?? null,
        type: data.type ?? undefined,
        isActive: data.isActive ?? undefined,
        isPinned: data.isPinned ?? undefined,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    })
    return ann
  })

  // DELETE (admin)
  fastify.delete('/announcements/admin/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.announcement.delete({ where: { id } })
    return { success: true }
  })

  // ── HELP CENTER ─────────────────────────────────────────────────

  // GET all articles (admin)
  fastify.get('/help/articles', { preHandler: authenticate }, async (req: any, reply) => {
    const articles = await prisma.helpArticle.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
    return articles
  })

  // GET published articles (public)
  fastify.get('/help/articles/public', async (_req, reply) => {
    const articles = await prisma.helpArticle.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, slug: true, title: true, titleAr: true, category: true, categoryAr: true, sortOrder: true },
    })
    return articles
  })

  // GET single article by slug (public)
  fastify.get('/help/articles/:slug', async (req: any, reply) => {
    const { slug } = req.params as any
    const article = await prisma.helpArticle.findUnique({ where: { slug } })
    if (!article || !article.isPublished) return reply.code(404).send({ error: 'Not found' })

    // increment view count
    await prisma.helpArticle.update({ where: { slug }, data: { viewCount: { increment: 1 } } })
    return article
  })

  // POST create article (admin)
  fastify.post('/help/articles', { preHandler: authenticate }, async (req: any, reply) => {
    const { slug, title, titleAr, body, bodyAr, category, categoryAr, isPublished, sortOrder } = req.body as any
    if (!slug || !title || !titleAr || !body || !bodyAr) {
      return reply.code(400).send({ error: 'slug, title, titleAr, body, bodyAr required' })
    }

    const article = await prisma.helpArticle.create({
      data: {
        slug,
        title,
        titleAr,
        body,
        bodyAr,
        category: category ?? 'general',
        categoryAr: categoryAr ?? 'عام',
        isPublished: isPublished ?? false,
        sortOrder: sortOrder ?? 0,
      },
    })
    return reply.code(201).send(article)
  })

  // PUT update article (admin)
  fastify.put('/help/articles/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    const data = req.body as any

    const article = await prisma.helpArticle.update({
      where: { id },
      data: {
        slug: data.slug,
        title: data.title,
        titleAr: data.titleAr,
        body: data.body,
        bodyAr: data.bodyAr,
        category: data.category,
        categoryAr: data.categoryAr,
        isPublished: data.isPublished ?? undefined,
        sortOrder: data.sortOrder ?? undefined,
      },
    })
    return article
  })

  // DELETE article (admin)
  fastify.delete('/help/articles/:id', { preHandler: authenticate }, async (req: any, reply) => {
    const { id } = req.params as any
    await prisma.helpArticle.delete({ where: { id } })
    return { success: true }
  })
}
