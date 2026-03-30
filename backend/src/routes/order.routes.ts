import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const createOrderSchema = z.object({
  storeId: z.string().cuid(),
  customerId: z.string().cuid(),
  addressId: z.string().cuid().optional(),
  paymentMethod: z.enum([
    'BENEFIT_PAY', 'CREDIMAX', 'VISA_MASTERCARD',
    'APPLE_PAY', 'GOOGLE_PAY', 'CASH_ON_DELIVERY',
    'BANK_TRANSFER', 'TABBY', 'TAMARA',
  ]),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().min(1),
  })).min(1, 'الطلب يجب أن يحتوي على منتج واحد على الأقل'),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  shippingCost: z.number().min(0).default(0),
})

export async function orderRoutes(app: FastifyInstance) {
  // ── Create Order ──────────────────────────────
  app.post('/', async (request, reply) => {
    const result = createOrderSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const { storeId, customerId, addressId, paymentMethod, items, couponCode, notes, shippingCost } = result.data

    const store = await prisma.store.findUnique({ where: { id: storeId, isActive: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    // Build order items with prices
    const orderItems: Array<{
      productId: string
      variantId: string | null
      name: string
      nameAr: string
      sku: string | null
      price: number
      quantity: number
      total: number
    }> = []
    let subtotal = 0

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      })

      if (!product || !product.isActive) {
        return reply.status(400).send({ error: `المنتج غير متاح: ${item.productId}` })
      }

      let price = Number(product.price)
      let variantId = item.variantId || null

      if (variantId) {
        const variant = product.variants.find((v: { id: string }) => v.id === variantId)
        if (!variant) return reply.status(400).send({ error: 'المتغير غير موجود' })
        if (variant.stock < item.quantity) {
          return reply.status(400).send({ error: `المخزون غير كافي للمنتج: ${product.nameAr}` })
        }
        price = Number(variant.price)
      } else if (product.trackInventory && product.stock < item.quantity) {
        return reply.status(400).send({ error: `المخزون غير كافي للمنتج: ${product.nameAr}` })
      }

      const total = price * item.quantity
      subtotal += total

      orderItems.push({
        productId: item.productId,
        variantId,
        name: product.name,
        nameAr: product.nameAr,
        sku: product.sku,
        price,
        quantity: item.quantity,
        total,
      })
    }

    // Coupon validation
    let discountAmount = 0
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { storeId_code: { storeId, code: couponCode.toUpperCase() } } })
      if (!coupon || !coupon.isActive) return reply.status(400).send({ error: 'كود الخصم غير صحيح' })
      if (coupon.expiresAt && coupon.expiresAt < new Date()) return reply.status(400).send({ error: 'كود الخصم منتهي الصلاحية' })
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return reply.status(400).send({ error: 'كود الخصم تجاوز الحد الأقصى' })
      if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
        return reply.status(400).send({ error: `الحد الأدنى للطلب ${coupon.minOrderValue} BHD` })
      }

      discountAmount = coupon.type === 'PERCENTAGE'
        ? (subtotal * Number(coupon.value)) / 100
        : Number(coupon.value)
    }

    const vatAmount = (subtotal - discountAmount) * Number(store.vatRate)
    const total = subtotal + Number(shippingCost) + vatAmount - discountAmount

    // Generate order number
    const orderNumber = `BZR-${Date.now().toString().slice(-8)}`

    const order = await prisma.$transaction(async (tx: typeof prisma) => {
      const newOrder = await tx.order.create({
        data: {
          storeId, customerId, addressId, paymentMethod,
          orderNumber, subtotal, shippingCost,
          vatAmount, discountAmount, total,
          couponCode: couponCode?.toUpperCase(),
          notes,
          items: { create: orderItems },
          payment: { create: { method: paymentMethod, amount: total, currency: store.currency } },
        },
        include: {
          items: { include: { product: { select: { images: { take: 1 } } } } },
          customer: { select: { firstName: true, lastName: true, phone: true } },
          address: true,
          payment: true,
        },
      })

      // Deduct stock
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          })
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          })
        }
      }

      // Update coupon usage
      if (couponCode) {
        await tx.coupon.update({
          where: { storeId_code: { storeId, code: couponCode.toUpperCase() } },
          data: { usedCount: { increment: 1 } },
        })
      }

      // Update customer stats
      await tx.customer.update({
        where: { id: customerId },
        data: { totalOrders: { increment: 1 }, totalSpent: { increment: total } },
      })

      return newOrder
    })

    return reply.status(201).send({ message: 'تم إنشاء الطلب بنجاح', order })
  })

  // ── List Orders (merchant) ────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId, page = '1', limit = '20', status, paymentStatus } = request.query as Record<string, string>

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId }
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          items: { select: { name: true, nameAr: true, quantity: true, total: true } },
          payment: { select: { method: true, status: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ])

    return reply.send({ orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })

  // ── Get Order by ID ───────────────────────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        store: { select: { merchantId: true, name: true, vatRate: true } },
        customer: true,
        address: true,
        items: { include: { product: { select: { images: { take: 1 } } }, variant: true } },
        payment: true,
      },
    })

    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    return reply.send({ order })
  })

  // ── Update Order Status ───────────────────────
  app.patch('/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { status, trackingNumber, shippingCompany } = request.body as any

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status, trackingNumber, shippingCompany },
    })

    return reply.send({ message: 'تم تحديث حالة الطلب', order: updated })
  })

  // ── Confirm Payment ───────────────────────────
  app.patch('/:id/payment', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { gatewayRef } = request.body as { gatewayRef?: string }

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'CONFIRMED' } }),
      prisma.payment.update({ where: { orderId: id }, data: { status: 'PAID', gatewayRef, paidAt: new Date() } }),
    ])

    return reply.send({ message: 'تم تأكيد الدفع بنجاح' })
  })
}
