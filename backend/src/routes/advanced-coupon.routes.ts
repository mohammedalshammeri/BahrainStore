import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── Advanced Coupons (BOGO + Tiered Discounts) ────────────────────────────────

export async function advancedCouponRoutes(app: FastifyInstance) {
  // POST /advanced-coupons — Create advanced coupon
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      code: z.string().min(3).max(30).toUpperCase(),
      type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING', 'BOGO', 'TIERED']),
      value: z.number().min(0).default(0),
      minOrderValue: z.number().positive().optional(),
      maxUses: z.number().int().positive().optional(),
      expiresAt: z.string().datetime().optional(),
      // BOGO rule
      bogoRule: z.object({
        buyQuantity: z.number().int().positive(),
        getQuantity: z.number().int().positive(),
        getProductId: z.string().optional(),
      }).optional(),
      // Tiered rules
      tieredRules: z.array(z.object({
        tierMinValue: z.number().positive(),
        tierDiscount: z.number().positive(),
        tierType: z.enum(['PERCENTAGE', 'FIXED']),
      })).optional(),
      // Product/category restrictions
      productIds: z.array(z.string()).optional(),
      categoryIds: z.array(z.string()).optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const { storeId, bogoRule, tieredRules, productIds, categoryIds, ...couponData } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        storeId,
        ...couponData,
        value: couponData.value || 0,
        expiresAt: couponData.expiresAt ? new Date(couponData.expiresAt) : undefined,
      },
    })

    // Create BOGO rule
    if (bogoRule && couponData.type === 'BOGO') {
      await prisma.couponRule.create({
        data: {
          couponId: coupon.id,
          ruleType: 'BOGO',
          buyQuantity: bogoRule.buyQuantity,
          getQuantity: bogoRule.getQuantity,
          getProductId: bogoRule.getProductId,
          productIds: productIds || [],
        },
      })
    }

    // Create tiered rules
    if (tieredRules && couponData.type === 'TIERED') {
      await prisma.couponRule.createMany({
        data: tieredRules.map((tier) => ({
          couponId: coupon.id,
          ruleType: 'TIERED',
          tierMinValue: tier.tierMinValue,
          tierDiscount: tier.tierDiscount,
          tierType: tier.tierType,
          categoryIds: categoryIds || [],
          productIds: productIds || [],
        })),
      })
    }

    // Product/category restrictions
    if (productIds?.length && !['BOGO', 'TIERED'].includes(couponData.type)) {
      await prisma.couponRule.create({
        data: {
          couponId: coupon.id,
          ruleType: 'PRODUCT_SPECIFIC',
          productIds: productIds,
          categoryIds: categoryIds || [],
        },
      })
    }

    const fullCoupon = await prisma.coupon.findUnique({
      where: { id: coupon.id },
      include: { rules: true },
    })

    return reply.status(201).send({ message: 'تم إنشاء الكوبون المتقدم', coupon: fullCoupon })
  })

  // GET /advanced-coupons?storeId=
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const coupons = await prisma.coupon.findMany({
      where: { storeId, type: { in: ['BOGO', 'TIERED'] } },
      include: { rules: true },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ coupons })
  })

  // POST /advanced-coupons/validate — Validate with advanced rules
  app.post('/validate', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      code: z.string(),
      orderValue: z.number().positive(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ valid: false, error: 'بيانات غير صحيحة' })
    }

    const { storeId, code, orderValue, items } = result.data

    const coupon = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
      include: { rules: true },
    })

    if (!coupon || !coupon.isActive) {
      return reply.status(400).send({ valid: false, error: 'كود الخصم غير صحيح' })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return reply.status(400).send({ valid: false, error: 'كود الخصم منتهي الصلاحية' })
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return reply.status(400).send({ valid: false, error: 'تم استنفاد كود الخصم' })
    }
    if (coupon.minOrderValue && orderValue < Number(coupon.minOrderValue)) {
      return reply.status(400).send({ valid: false, error: `الحد الأدنى للطلب: ${coupon.minOrderValue} BHD` })
    }

    let discountAmount = 0
    let freeItems: any[] = []

    if (coupon.type === 'PERCENTAGE') {
      discountAmount = (orderValue * Number(coupon.value)) / 100
    } else if (coupon.type === 'FIXED') {
      discountAmount = Math.min(Number(coupon.value), orderValue)
    } else if (coupon.type === 'FREE_SHIPPING') {
      discountAmount = 0 // handled at order level
    } else if (coupon.type === 'BOGO') {
      const bogoRule = coupon.rules.find((r) => r.ruleType === 'BOGO')
      if (bogoRule) {
        // Find qualifying items
        const qualifyingItems = bogoRule.productIds?.length
          ? items.filter((i) => bogoRule.productIds!.includes(i.productId))
          : items

        const totalQty = qualifyingItems.reduce((s, i) => s + i.quantity, 0)
        const setsOfQualifying = Math.floor(totalQty / (bogoRule.buyQuantity || 1))

        if (setsOfQualifying > 0) {
          const freeQty = setsOfQualifying * (bogoRule.getQuantity || 1)
          // Give cheapest items free
          const sortedByPrice = [...qualifyingItems].sort((a, b) => a.price - b.price)
          let remainingFree = freeQty
          for (const item of sortedByPrice) {
            if (remainingFree <= 0) break
            const freeFromItem = Math.min(remainingFree, item.quantity)
            discountAmount += freeFromItem * item.price
            freeItems.push({ productId: item.productId, quantity: freeFromItem, price: item.price })
            remainingFree -= freeFromItem
          }
        }
      }
    } else if (coupon.type === 'TIERED') {
      // Find best applicable tier
      const sortedTiers = coupon.rules
        .filter((r) => r.ruleType === 'TIERED' && r.tierMinValue !== null && Number(r.tierMinValue) <= orderValue)
        .sort((a, b) => Number(b.tierMinValue) - Number(a.tierMinValue))

      if (sortedTiers.length > 0) {
        const bestTier = sortedTiers[0]
        if (bestTier.tierType === 'PERCENTAGE') {
          discountAmount = (orderValue * Number(bestTier.tierDiscount)) / 100
        } else {
          discountAmount = Math.min(Number(bestTier.tierDiscount), orderValue)
        }
      }
    }

    return reply.send({
      valid: true,
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type },
      discountAmount: Math.round(discountAmount * 1000) / 1000,
      freeItems: freeItems.length > 0 ? freeItems : undefined,
      isFreeShipping: coupon.type === 'FREE_SHIPPING',
    })
  })
}
