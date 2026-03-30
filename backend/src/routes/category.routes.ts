import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const createCategorySchema = z.object({
  storeId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  name: z.string().min(2),
  nameAr: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  image: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
})

export async function categoryRoutes(app: FastifyInstance) {
  // ── Create Category ───────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const result = createCategorySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const data = result.data

    const store = await prisma.store.findFirst({ where: { id: data.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const category = await prisma.category.create({
      data,
      include: { parent: { select: { id: true, name: true, nameAr: true } } },
    })

    return reply.status(201).send({ message: 'تم إنشاء التصنيف بنجاح', category })
  })

  // ── List Categories ───────────────────────────
  app.get('/store/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }

    const categories = await prisma.category.findMany({
      where: { storeId, isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          include: { _count: { select: { products: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send({ categories })
  })

  // ── Update Category ───────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const category = await prisma.category.findUnique({ where: { id }, include: { store: true } })
    if (!category || category.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'التصنيف غير موجود' })
    }

    const updated = await prisma.category.update({ where: { id }, data: request.body as any })
    return reply.send({ message: 'تم تحديث التصنيف بنجاح', category: updated })
  })

  // ── Delete Category ───────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const category = await prisma.category.findUnique({ where: { id }, include: { store: true } })
    if (!category || category.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'التصنيف غير موجود' })
    }

    await prisma.category.delete({ where: { id } })
    return reply.send({ message: 'تم حذف التصنيف بنجاح' })
  })
}
