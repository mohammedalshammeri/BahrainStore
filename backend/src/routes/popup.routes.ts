import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function popupRoutes(app: FastifyInstance) {

  // List popups
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const popups = await prisma.popup.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } })
    return reply.send({ popups })
  })

  // Create popup
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      name: z.string().min(1),
      titleAr: z.string().optional(),
      title: z.string().optional(),
      bodyAr: z.string().optional(),
      body: z.string().optional(),
      buttonText: z.string().optional(),
      buttonUrl: z.string().optional(),
      trigger: z.enum(['ON_LOAD', 'ON_EXIT', 'ON_SCROLL', 'AFTER_DELAY']).default('ON_EXIT'),
      delaySeconds: z.number().int().min(0).default(5),
      couponCode: z.string().optional(),
      imageUrl: z.string().optional(),
      isActive: z.boolean().default(true),
      showOnce: z.boolean().default(true),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const popup = await prisma.popup.create({ data: { storeId, ...data } as any })
    return reply.status(201).send({ popup })
  })

  // Update popup
  app.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const popup = await prisma.popup.findFirst({ where: { id, store: { merchantId } } })
    if (!popup) return reply.status(404).send({ error: 'غير موجود' })

    const updated = await prisma.popup.update({ where: { id }, data: request.body as any })
    return reply.send({ popup: updated })
  })

  // Delete popup
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const popup = await prisma.popup.findFirst({ where: { id, store: { merchantId } } })
    if (!popup) return reply.status(404).send({ error: 'غير موجود' })
    await prisma.popup.delete({ where: { id } })
    return reply.send({ message: 'تم الحذف' })
  })

  // Public: get active popups for storefront
  app.get('/public/:storeSlug', async (request, reply) => {
    const { storeSlug } = request.params as { storeSlug: string }
    const store = await prisma.store.findUnique({ where: { subdomain: storeSlug }, select: { id: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const popups = await prisma.popup.findMany({
      where: { storeId: store.id, isActive: true },
      select: {
        id: true, titleAr: true, title: true, bodyAr: true, body: true,
        buttonText: true, buttonUrl: true, trigger: true,
        delaySeconds: true, couponCode: true, imageUrl: true, showOnce: true,
      },
    })
    return reply.send({ popups })
  })
}
