import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const createCouponSchema = z.object({
  storeId: z.string().cuid(),
  code: z.string().min(3).max(20).toUpperCase(),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']),
  value: z.number().positive(),
  minOrderValue: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
})

export async function couponRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const result = createCouponSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const data = result.data

    const store = await prisma.store.findFirst({ where: { id: data.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const coupon = await prisma.coupon.create({
      data: { ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined },
    })

    return reply.status(201).send({ message: 'تم إنشاء الكوبون بنجاح', coupon })
  })

  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId } = request.query as { storeId: string }

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const coupons = await prisma.coupon.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ coupons })
  })

  // Validate coupon (public for storefront)
  app.post('/validate', async (request, reply) => {
    const { storeId, code, orderValue } = request.body as { storeId: string; code: string; orderValue: number }

    const coupon = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
    })

    if (!coupon || !coupon.isActive) return reply.status(400).send({ valid: false, error: 'كود الخصم غير صحيح' })
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return reply.status(400).send({ valid: false, error: 'كود الخصم منتهي الصلاحية' })
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return reply.status(400).send({ valid: false, error: 'كود الخصم نفد' })
    if (coupon.minOrderValue && orderValue < Number(coupon.minOrderValue)) {
      return reply.status(400).send({ valid: false, error: `الحد الأدنى ${coupon.minOrderValue} BHD` })
    }

    const discountAmount = coupon.type === 'PERCENTAGE'
      ? (orderValue * Number(coupon.value)) / 100
      : Number(coupon.value)

    return reply.send({ valid: true, coupon, discountAmount })
  })

  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const coupon = await prisma.coupon.findUnique({ where: { id }, include: { store: true } })
    if (!coupon || coupon.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الكوبون غير موجود' })
    }

    await prisma.coupon.delete({ where: { id } })
    return reply.send({ message: 'تم حذف الكوبون' })
  })
}
