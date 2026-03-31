import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ReviewStatus } from '@prisma/client'
import { authenticate } from '../middleware/auth.middleware'

export async function reviewsRoutes(app: FastifyInstance) {
  // ── List reviews for store (dashboard auth) ──
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, page = '1', limit = '20', status, productId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const where: any = { storeId }
    if (status) where.status = status as ReviewStatus
    if (productId) where.productId = productId

    const skip = (Number(page) - 1) * Number(limit)
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { product: { select: { id: true, name: true, nameAr: true, slug: true } } },
      }),
      prisma.review.count({ where }),
    ])

    return reply.send({ reviews, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // ── Approve review ─────────────────────────
  app.patch('/:id/approve', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) return reply.status(404).send({ error: 'التقييم غير موجود' })

    const store = await prisma.store.findFirst({ where: { id: review.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const updated = await prisma.review.update({ where: { id }, data: { status: ReviewStatus.APPROVED } })
    return reply.send({ review: updated })
  })

  // ── Reject review ──────────────────────────
  app.patch('/:id/reject', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) return reply.status(404).send({ error: 'التقييم غير موجود' })

    const store = await prisma.store.findFirst({ where: { id: review.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const updated = await prisma.review.update({ where: { id }, data: { status: ReviewStatus.REJECTED } })
    return reply.send({ review: updated })
  })

  // ── Delete review ──────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) return reply.status(404).send({ error: 'التقييم غير موجود' })

    const store = await prisma.store.findFirst({ where: { id: review.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.review.delete({ where: { id } })
    return reply.send({ message: 'تم حذف التقييم' })
  })

  // ── Public: submit review (storefront) ─────
  app.post('/public', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      productId: z.string().cuid(),
      customerId: z.string().cuid().optional(),
      name: z.string().min(1),
      email: z.string().email().optional(),
      rating: z.number().int().min(1).max(5),
      title: z.string().optional(),
      body: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, productId, ...data } = result.data

    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (!store || !store.isActive) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const product = await prisma.product.findFirst({ where: { id: productId, storeId } })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    const review = await prisma.review.create({
      data: { storeId, productId, ...data, status: ReviewStatus.PENDING },
    })

    return reply.status(201).send({ review, message: 'شكراً! سيتم مراجعة تقييمك ونشره قريباً.' })
  })

  // ── Public: get approved reviews for product ──
  app.get('/public/:storeId/:productId', async (request, reply) => {
    const { storeId, productId } = request.params as { storeId: string; productId: string }
    const { page = '1', limit = '10' } = request.query as Record<string, string>

    const skip = (Number(page) - 1) * Number(limit)
    const where = { storeId, productId, status: ReviewStatus.APPROVED }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        select: { id: true, name: true, rating: true, title: true, body: true, photos: true, isVerified: true, createdAt: true },
      }),
      prisma.review.count({ where }),
    ])

    const avg = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0

    return reply.send({ reviews, total, average: avg, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })
}
