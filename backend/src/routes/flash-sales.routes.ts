import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { CouponType } from '@prisma/client'
import { findMerchantFlashSale, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

export async function flashSalesRoutes(app: FastifyInstance) {
  // ── List flash sales (auth) ──────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as Record<string, string>
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const sales = await prisma.flashSale.findMany({
      where: { storeId },
      orderBy: { startsAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, nameAr: true, slug: true, price: true, images: { take: 1 } } },
          },
        },
      },
    })

    return reply.send({ sales })
  })

  // ── Get single flash sale ────────────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const ownedSale = await findMerchantFlashSale(merchantId, id)
    if (!ownedSale) return reply.status(404).send({ error: 'العرض غير موجود' })

    const sale = await prisma.flashSale.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { id: true, name: true, nameAr: true, slug: true, price: true, images: { take: 1 } } } } } },
    })
    if (!sale) return reply.status(404).send({ error: 'العرض غير موجود' })

    return reply.send({ sale })
  })

  // ── Create flash sale ────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      name: z.string().min(1),
      nameAr: z.string().min(1),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      discountType: z.nativeEnum(CouponType).default(CouponType.PERCENTAGE),
      discountValue: z.number().positive(),
      isActive: z.boolean().default(true),
      productIds: z.array(z.string().cuid()).min(1),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchantId = (request.user as any).id
    const { storeId, productIds, discountValue, startsAt, endsAt, ...data } = result.data

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    if (new Date(endsAt) <= new Date(startsAt)) {
      return reply.status(400).send({ error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء' })
    }

    const sale = await prisma.flashSale.create({
      data: {
        storeId,
        ...data,
        discountValue,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        items: {
          create: productIds.map((productId) => ({ productId })),
        },
      },
      include: { items: { include: { product: { select: { id: true, name: true, nameAr: true, price: true } } } } },
    })

    return reply.status(201).send({ sale })
  })

  // ── Update flash sale ────────────────────
  app.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      name: z.string().min(1).optional(),
      nameAr: z.string().optional(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      discountType: z.nativeEnum(CouponType).optional(),
      discountValue: z.number().positive().optional(),
      isActive: z.boolean().optional(),
      productIds: z.array(z.string().cuid()).optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const existing = await findMerchantFlashSale(merchantId, id)
    if (!existing) return reply.status(404).send({ error: 'العرض غير موجود' })

    const { productIds, startsAt, endsAt, discountValue, ...rest } = result.data
    const updateData: any = { ...rest }
    if (startsAt) updateData.startsAt = new Date(startsAt)
    if (endsAt) updateData.endsAt = new Date(endsAt)
    if (discountValue !== undefined) updateData.discountValue = discountValue

    if (productIds) {
      await prisma.flashSaleItem.deleteMany({ where: { flashSaleId: id } })
      updateData.items = { create: productIds.map((productId) => ({ productId })) }
    }

    const sale = await prisma.flashSale.update({
      where: { id },
      data: updateData,
      include: { items: { include: { product: { select: { id: true, name: true, nameAr: true, price: true } } } } },
    })

    return reply.send({ sale })
  })

  // ── Delete flash sale ────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const existing = await findMerchantFlashSale(merchantId, id)
    if (!existing) return reply.status(404).send({ error: 'العرض غير موجود' })

    await prisma.flashSale.delete({ where: { id } })
    return reply.send({ message: 'تم حذف العرض' })
  })

  // ── Public: active flash sales for store (storefront) ──
  app.get('/public/:storeSlug', async (request, reply) => {
    const { storeSlug } = request.params as { storeSlug: string }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store || !store.isActive) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const now = new Date()
    const sales = await prisma.flashSale.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, nameAr: true, slug: true, price: true, comparePrice: true, images: { take: 1 } },
            },
          },
        },
      },
    })

    return reply.send({ sales })
  })
}
