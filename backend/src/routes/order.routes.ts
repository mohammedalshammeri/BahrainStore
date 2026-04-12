import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { createOrderTrackingToken, verifyOrderTrackingToken } from '../lib/order-tracking'
import { sendMerchantNewOrderEmail, sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '../lib/email'
import { sendWhatsAppOrderConfirmation, sendWhatsAppStatusUpdate } from '../lib/whatsapp'
import { sendOrderConfirmationSms, sendOrderStatusUpdateSms } from '../lib/sms'
import { createAramexShipment } from '../lib/aramex'
import { createDhlShipment } from '../lib/dhl'
import { issueBenefitPayRefund } from './benefitpay.routes'
import { fireWebhook } from './webhook.routes'
import { processLoanRepayment } from '../lib/finance-repayment'

const inventoryConflictPrefix = 'INSUFFICIENT_STOCK:'
const ORDER_DISPUTE_SUBJECT_PREFIX = 'ORDER_DISPUTE'

const createOrderSchema = z.object({
  storeId: z.string().cuid(),
  customerId: z.string().cuid(),
  addressId: z.string().cuid().optional(),
  paymentMethod: z.enum([
    'BENEFIT_PAY', 'CREDIMAX', 'VISA_MASTERCARD',
    'APPLE_PAY', 'GOOGLE_PAY', 'CASH_ON_DELIVERY',
    'BANK_TRANSFER', 'TABBY', 'TAMARA',
    'TAP_PAYMENTS', 'MOYASAR',
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

function mergeTextNotes(...parts: Array<string | null | undefined>) {
  const normalized = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))

  return normalized.length > 0 ? normalized.join('\n') : null
}

function encodeOrderDisputeSubject(orderId: string, title: string, returnId?: string | null) {
  return [ORDER_DISPUTE_SUBJECT_PREFIX, orderId, returnId ?? '', title.replace(/\|/g, '/').trim()].join('|')
}

function parseOrderDisputeSubject(subject: string) {
  const [prefix, orderId, returnId, ...titleParts] = subject.split('|')
  if (prefix !== ORDER_DISPUTE_SUBJECT_PREFIX || !orderId) return null

  return {
    orderId,
    returnId: returnId || null,
    title: titleParts.join('|').trim() || 'نزاع طلب',
  }
}

function calculateReturnRefundCeiling(orderItems: Array<{ id: string; total: unknown; quantity: number; price: unknown }>, returnItems: Array<{ orderItemId: string; quantity: number }>) {
  const orderItemsById = new Map(orderItems.map((item) => [item.id, item]))
  let maxRefundAmount = 0

  for (const returnItem of returnItems) {
    const orderItem = orderItemsById.get(returnItem.orderItemId)
    if (!orderItem) {
      return null
    }

    const unitPrice = orderItem.quantity > 0
      ? Number(orderItem.total) / orderItem.quantity
      : Number(orderItem.price)
    maxRefundAmount += unitPrice * returnItem.quantity
  }

  return maxRefundAmount
}

async function syncOrderRefundStatus(orderId: string, orderTotal: number, orderStatus: string) {
  const refundedReturns = await prisma.orderReturn.findMany({
    where: {
      orderId,
      status: 'REFUNDED',
    },
    select: {
      refundAmount: true,
    },
  })

  const refundedAmount = refundedReturns.reduce((sum, current) => sum + Number(current.refundAmount), 0)
  const isFullyRefunded = refundedAmount >= orderTotal
  const paymentStatus = isFullyRefunded ? 'REFUNDED' : refundedAmount > 0 ? 'PARTIALLY_REFUNDED' : 'PAID'

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: isFullyRefunded ? 'REFUNDED' : orderStatus as any,
      paymentStatus: paymentStatus as any,
    },
  })

  return { refundedAmount, paymentStatus, isFullyRefunded }
}

export async function orderRoutes(app: FastifyInstance) {
  // ── Create Order ──────────────────────────────
  app.post('/', {
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const result = createOrderSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const { storeId, customerId, addressId, paymentMethod, items, couponCode, notes, shippingCost } = result.data

    const store = await prisma.store.findUnique({ where: { id: storeId, isActive: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, storeId: true },
    })

    if (!customer || customer.storeId !== storeId) {
      return reply.status(400).send({ error: 'العميل غير صالح لهذا المتجر' })
    }

    if (addressId) {
      const address = await prisma.address.findUnique({
        where: { id: addressId },
        select: { id: true, customerId: true },
      })

      if (!address || address.customerId !== customerId) {
        return reply.status(400).send({ error: 'عنوان التوصيل غير صالح لهذا العميل' })
      }
    }

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
      trackInventory: boolean
      productNameAr: string
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

      // Apply active flash sale discount if available
      const flashNow = new Date()
      const flashItem = await prisma.flashSaleItem.findFirst({
        where: {
          productId: item.productId,
          flashSale: { storeId, isActive: true, startsAt: { lte: flashNow }, endsAt: { gte: flashNow } },
        },
        include: { flashSale: { select: { discountType: true, discountValue: true } } },
      })
      if (flashItem) {
        price = flashItem.flashSale.discountType === 'PERCENTAGE'
          ? price * (1 - Number(flashItem.flashSale.discountValue) / 100)
          : Math.max(0, price - Number(flashItem.flashSale.discountValue))
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
        trackInventory: product.trackInventory,
        productNameAr: product.nameAr,
      })
    }

    // Coupon validation
    let discountAmount = 0
    let coupon: Awaited<ReturnType<typeof prisma.coupon.findUnique<{ where: { storeId_code: { storeId: string; code: string } } }>>> | null = null
    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { storeId_code: { storeId, code: couponCode.toUpperCase() } } })
      if (!coupon || !coupon.isActive) return reply.status(400).send({ error: 'كود الخصم غير صحيح' })
      if (coupon.expiresAt && coupon.expiresAt < new Date()) return reply.status(400).send({ error: 'كود الخصم منتهي الصلاحية' })
      // NOTE: maxUses check is done atomically inside the transaction to prevent race conditions (LOGIC-002)
      if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
        return reply.status(400).send({ error: `الحد الأدنى للطلب ${coupon.minOrderValue} BHD` })
      }

      // LOGIC-001: Per-customer coupon usage check
      if (coupon.maxUsesPerCustomer) {
        const customerUsageCount = await prisma.couponUsage.count({
          where: { couponId: coupon.id, customerId },
        })
        if (customerUsageCount >= coupon.maxUsesPerCustomer) {
          return reply.status(400).send({ error: 'لقد استخدمت هذا الكوبون الحد الأقصى المسموح به' })
        }
      }

      discountAmount = coupon.type === 'PERCENTAGE'
        ? (subtotal * Number(coupon.value)) / 100
        : Number(coupon.value)
    }

    const vatAmount = (subtotal - discountAmount) * Number(store.vatRate)
    const total = subtotal + Number(shippingCost) + vatAmount - discountAmount

    // Generate order number
    const orderNumber = `BZR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    let order
    try {
      order = await prisma.$transaction(async (tx) => {
        for (const item of orderItems) {
          if (item.variantId) {
            const variantUpdate = await tx.productVariant.updateMany({
              where: {
                id: item.variantId,
                stock: { gte: item.quantity },
              },
              data: {
                stock: { decrement: item.quantity },
              },
            })

            if (variantUpdate.count !== 1) {
              throw new Error(`${inventoryConflictPrefix}${item.productNameAr}`)
            }
            continue
          }

          if (!item.trackInventory) {
            continue
          }

          const productUpdate = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity },
            },
            data: {
              stock: { decrement: item.quantity },
            },
          })

          if (productUpdate.count !== 1) {
            throw new Error(`${inventoryConflictPrefix}${item.productNameAr}`)
          }
        }

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
          customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
          address: true,
          payment: true,
        },
        })

        // Update coupon usage — atomic maxUses guard (LOGIC-002) + per-customer record (LOGIC-001)
        if (couponCode && coupon) {
          // Atomic: increment usedCount only if under the global limit
          // This raw UPDATE returns the number of rows affected, preventing race conditions
          const affected = await tx.$executeRaw`
            UPDATE "coupons"
            SET "usedCount" = "usedCount" + 1
            WHERE id = ${coupon.id}
              AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
          `
          if (affected === 0) {
            throw new Error('COUPON_EXHAUSTED')
          }
          // Record per-customer usage (one row per redemption)
          await tx.couponUsage.create({ data: { couponId: coupon.id, customerId } })
        }

        // Update customer stats
        await tx.customer.update({
          where: { id: customerId },
          data: { totalOrders: { increment: 1 }, totalSpent: { increment: total } },
        })

        return newOrder
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(inventoryConflictPrefix)) {
        return reply.status(409).send({ error: `المخزون لم يعد كافياً للمنتج: ${error.message.slice(inventoryConflictPrefix.length)}` })
      }
      if (error instanceof Error && error.message === 'COUPON_EXHAUSTED') {
        return reply.status(409).send({ error: 'كود الخصم تجاوز الحد الأقصى من الاستخدامات' })
      }

      throw error
    }

    const trackToken = createOrderTrackingToken({
      orderId: order.id,
      orderNumber: order.orderNumber,
      storeId: order.storeId,
    })

    // Send confirmation email (fire-and-forget — never block the response)
    const customerEmail = (order.customer as any)?.email
    if (customerEmail) {
      sendOrderConfirmationEmail({
        to: customerEmail,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        orderNumber: order.orderNumber,
        storeName: store.nameAr,
        storeSubdomain: store.subdomain,
        items: order.items.map((i: any) => ({
          nameAr: i.nameAr,
          quantity: i.quantity,
          price: Number(i.price),
          total: Number(i.total),
        })),
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        shippingCost: Number(order.shippingCost),
        vatAmount: Number(order.vatAmount),
        total: Number(order.total),
        paymentMethod: order.paymentMethod,
        address: order.address
          ? {
              area: (order.address as any).area ?? '',
              block: (order.address as any).block ?? undefined,
              road: (order.address as any).road ?? undefined,
              building: (order.address as any).building ?? undefined,
              flat: (order.address as any).flat ?? undefined,
            }
          : undefined,
      }).catch((err: unknown) => console.error('Email send failed:', err))
    }

    // WhatsApp confirmation (fire-and-forget)
    const settings = await prisma.storeSettings.findUnique({ where: { storeId } })
    const customerPhone = (order.customer as any)?.phone
    if (settings?.whatsappEnabled && settings.whatsappPhoneId && settings.whatsappToken && customerPhone) {
      sendWhatsAppOrderConfirmation(
        {
          to: customerPhone,
          customerName: `${order.customer.firstName} ${order.customer.lastName}`,
          orderNumber: order.orderNumber,
          storeName: store.nameAr || store.name,
          total: Number(order.total),
          currency: store.currency,
        },
        { phoneNumberId: settings.whatsappPhoneId, token: settings.whatsappToken }
      ).catch((err: unknown) => console.error('WhatsApp send failed:', err))
    }

    // SMS confirmation (fire-and-forget)
    if (settings?.smsEnabled && settings.smsTwilioSid && settings.smsTwilioToken && settings.smsTwilioFrom && customerPhone) {
      sendOrderConfirmationSms(
        { to: customerPhone, orderNumber: order.orderNumber, storeName: store.nameAr || store.name },
        { accountSid: settings.smsTwilioSid, authToken: settings.smsTwilioToken, from: settings.smsTwilioFrom }
      ).catch((err: unknown) => console.error('SMS send failed:', err))
    }

    // Fire webhooks (fire-and-forget)
    fireWebhook(storeId, 'ORDER_CREATED', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
    }).catch(() => {})

    // Deduct from active Bazar Finance loan if store has one (fire-and-forget)
    if (order.paymentStatus === 'PAID') {
      processLoanRepayment(storeId, order.id, Number(order.total)).catch(console.error)
    }

    // Notify merchant about new order (fire-and-forget)
    prisma.merchant.findUnique({
      where: { id: store.merchantId },
      select: { email: true, firstName: true },
    }).then((merchant) => {
      if (!merchant) return
      const dashboardUrl = `${process.env.DASHBOARD_URL ?? 'http://localhost:3002'}/orders/${order.id}`
      sendMerchantNewOrderEmail({
        to: merchant.email,
        merchantName: merchant.firstName,
        storeName: store.nameAr,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: store.currency,
        customerName: `${(order.customer as any)?.firstName ?? ''} ${(order.customer as any)?.lastName ?? ''}`.trim(),
        itemCount: order.items.length,
        dashboardUrl,
      }).catch(() => {})
    }).catch(() => {})

    return reply.status(201).send({
      message: 'تم إنشاء الطلب بنجاح',
      order,
      trackToken,
      trackUrl: `/${store.subdomain}/orders/${order.orderNumber}?token=${encodeURIComponent(trackToken)}`,
    })
  })

  // ── List Orders (merchant) ────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId, page = '1', limit = '20', status, paymentStatus, search } = request.query as Record<string, string>

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId }
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' }

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

  // ── Download Invoice PDF ──────────────────────
  app.get('/:id/invoice', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        store: true,
        customer: true,
        address: true,
        items: true,
        payment: true,
      },
    })

    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const address = order.address
      ? [
          order.address.area,
          order.address.block ? `Block ${order.address.block}` : '',
          order.address.road ? `Road ${order.address.road}` : '',
          order.address.building ? `Bldg ${order.address.building}` : '',
          order.address.flat ? `Flat ${order.address.flat}` : '',
        ]
          .filter(Boolean)
          .join(', ')
      : null

    const { generateInvoicePDF } = await import('../lib/invoice')
    const pdfBuffer = await generateInvoicePDF({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      storeName: order.store.name,
      storeNameAr: order.store.nameAr,
      vatNumber: order.store.vatNumber,
      crNumber: order.store.crNumber,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      customerPhone: order.customer.phone,
      address,
      items: order.items.map((i: any) => ({
        nameAr: i.nameAr,
        name: i.name,
        quantity: i.quantity,
        price: Number(i.price),
        total: Number(i.total),
      })),
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      shippingCost: Number(order.shippingCost),
      vatAmount: Number(order.vatAmount),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      currency: order.store.currency,
    })

    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`)
    return reply.send(pdfBuffer)
  })

  // ── Update Order Status ───────────────────────
  app.patch('/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { status, trackingNumber, shippingCompany } = request.body as any

    const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED']
    if (status && !VALID_STATUSES.includes(status)) {
      return reply.status(400).send({ error: 'حالة الطلب غير صحيحة', validStatuses: VALID_STATUSES })
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status, trackingNumber, shippingCompany },
      include: { customer: { select: { firstName: true, lastName: true, email: true } } },
    })

    // Fire-and-forget status notification to customer
    const customerEmail = (updated.customer as any)?.email
    if (customerEmail && status) {
      sendOrderStatusUpdateEmail({
        to: customerEmail,
        customerName: `${(updated.customer as any).firstName} ${(updated.customer as any).lastName}`,
        orderNumber: updated.orderNumber,
        storeName: order.store.nameAr,
        storeSubdomain: order.store.subdomain,
        newStatus: status,
        trackingNumber: updated.trackingNumber,
        shippingCompany: updated.shippingCompany,
      }).catch((err: unknown) => console.error('Status email failed:', err))
    }

    // WhatsApp status update (fire-and-forget)
    const updatedWithStore = await prisma.order.findUnique({
      where: { id },
      include: { store: { include: { settings: true } }, customer: true },
    })
    const wsSettings = updatedWithStore?.store?.settings
    const custPhone = (updatedWithStore?.customer as any)?.phone
    if (wsSettings?.whatsappEnabled && wsSettings.whatsappPhoneId && wsSettings.whatsappToken && custPhone) {
      sendWhatsAppStatusUpdate(
        {
          to: custPhone,
          customerName: `${updatedWithStore!.customer.firstName} ${updatedWithStore!.customer.lastName}`,
          orderNumber: updated.orderNumber,
          storeName: updatedWithStore!.store.nameAr || updatedWithStore!.store.name,
          total: Number(updated.total),
          currency: updatedWithStore!.store.currency,
          status,
          trackingNumber: updated.trackingNumber,
        },
        { phoneNumberId: wsSettings.whatsappPhoneId, token: wsSettings.whatsappToken }
      ).catch((err: unknown) => console.error('WhatsApp status failed:', err))
    }

    // SMS status update (fire-and-forget)
    if (wsSettings?.smsEnabled && wsSettings.smsTwilioSid && wsSettings.smsTwilioToken && wsSettings.smsTwilioFrom && custPhone) {
      sendOrderStatusUpdateSms(
        {
          to: custPhone,
          orderNumber: updated.orderNumber,
          status,
          storeName: updatedWithStore!.store.nameAr || updatedWithStore!.store.name,
          trackingNumber: updated.trackingNumber ?? undefined,
        },
        { accountSid: wsSettings.smsTwilioSid, authToken: wsSettings.smsTwilioToken, from: wsSettings.smsTwilioFrom }
      ).catch((err: unknown) => console.error('SMS status failed:', err))
    }

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

  // ── Track Order by Number (public — storefront) ───────────────
  app.get('/track/:orderNumber', async (request, reply) => {
    const { orderNumber } = request.params as { orderNumber: string }
    const { token } = request.query as { token?: string }

    const verification = verifyOrderTrackingToken(token, orderNumber)
    if (!verification.valid) {
      return reply.status(403).send({ error: 'رابط التتبع غير صالح أو منتهي الصلاحية', code: 'INVALID_TRACKING_TOKEN' })
    }

    const order = await prisma.order.findFirst({
      where: {
        id: verification.payload.orderId,
        orderNumber,
        storeId: verification.payload.storeId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        discountAmount: true,
        shippingCost: true,
        vatAmount: true,
        total: true,
        trackingNumber: true,
        shippingCompany: true,
        createdAt: true,
        paidAt: true,
        store: { select: { nameAr: true, name: true, subdomain: true } },
        items: {
          select: {
            nameAr: true, name: true, quantity: true, price: true, total: true,
            variant: { select: { name: true } },
            product: { select: { images: { take: 1, select: { url: true } } } },
          },
        },
        payment: { select: { method: true, status: true } },
      },
    })

    if (!order) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    return reply.send({
      order,
      trackToken: token,
    })
  })

  // ── Customer Orders by Phone (public — storefront) ────────────
  app.post('/by-phone', async (request, reply) => {
    const { storeId, phone } = request.body as { storeId: string; phone: string }

    if (!storeId || !phone) {
      return reply.status(400).send({ error: 'storeId و phone مطلوبان' })
    }

    const customer = await prisma.customer.findUnique({
      where: { storeId_phone: { storeId, phone } },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!customer) {
      return reply.status(404).send({ error: 'لم يتم العثور على حساب بهذا الرقم' })
    }

    const orders = await prisma.order.findMany({
      where: { storeId, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true,
        total: true, createdAt: true,
        items: { select: { nameAr: true, quantity: true } },
      },
    })

    return reply.send({ customer, orders })
  })

  // ── Shipping Label PDF ───────────────────────────────────────────────
  app.get('/:id/shipping-label', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        store: true,
        customer: true,
        address: true,
        items: { select: { nameAr: true, name: true, quantity: true } },
      },
    })

    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ size: [283, 425], margin: 16 }) // 10x15cm label
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    await new Promise<void>((resolve) => {
      doc.on('end', resolve)

      // Header — store name
      doc.fontSize(14).font('Helvetica-Bold')
        .text(order.store.name, { align: 'center' })
      doc.fontSize(9).font('Helvetica')
        .text(order.store.subdomain + '.bazar.bh', { align: 'center' })

      doc.moveDown(0.5)
      doc.moveTo(16, doc.y).lineTo(267, doc.y).stroke()
      doc.moveDown(0.5)

      // Order number (prominent)
      doc.fontSize(11).font('Helvetica-Bold')
        .text('Order #', { continued: true })
        .font('Helvetica-Bold').fontSize(13)
        .text(order.orderNumber)

      doc.moveDown(0.5)

      // Customer info
      doc.fontSize(9).font('Helvetica-Bold').text('المستلم:')
      doc.font('Helvetica').text(
        `${order.customer.firstName} ${order.customer.lastName}  |  ${order.customer.phone}`
      )

      if (order.address) {
        const addr = order.address as any
        const addrLine = [
          addr.area,
          addr.block ? `Block ${addr.block}` : '',
          addr.road ? `Road ${addr.road}` : '',
          addr.building ? `Bldg ${addr.building}` : '',
          addr.flat ? `Flat ${addr.flat}` : '',
          'Bahrain',
        ].filter(Boolean).join(', ')
        doc.text(addrLine)
      }

      doc.moveDown(0.5)
      doc.moveTo(16, doc.y).lineTo(267, doc.y).stroke()
      doc.moveDown(0.5)

      // Items summary
      doc.fontSize(9).font('Helvetica-Bold').text('المحتويات:')
      doc.font('Helvetica')
      for (const item of order.items) {
        doc.text(`x${item.quantity}  ${item.nameAr || item.name}`)
      }

      if (order.trackingNumber) {
        doc.moveDown(0.5)
        doc.font('Helvetica-Bold').fontSize(9).text('رقم التتبع: ')
        doc.font('Helvetica').fontSize(11).text(order.trackingNumber, { align: 'center' })
      }

      doc.end()
    })

    const pdfBuffer = Buffer.concat(chunks)
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="label-${order.orderNumber}.pdf"`)
    return reply.send(pdfBuffer)
  })

  // ── Create Shipment (Aramex or DHL) ────────────────────────────────────
  app.post('/:id/shipment', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { carrier = 'aramex', weightKg = 0.5 } = request.body as { carrier?: string; weightKg?: number }
    const normalizedCarrier = String(carrier).toLowerCase()

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        store: { include: { settings: true } },
        customer: true,
        address: true,
        items: { select: { nameAr: true, quantity: true } },
      },
    })

    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const settings = order.store.settings

    const shipperAddr = {
      city: 'المنامة',
      countryCode: 'BH',
      line1: order.store.nameAr || order.store.name,
      addressLine1: order.store.nameAr || order.store.name,
      postalCode: '00000',
    }
    const consigneeAddr = {
      city: (order.address as any)?.area ?? 'المنامة',
      countryCode: 'BH',
      line1: [(order.address as any)?.block, (order.address as any)?.road, (order.address as any)?.building].filter(Boolean).join(' '),
      addressLine1: [(order.address as any)?.block, (order.address as any)?.road, (order.address as any)?.building].filter(Boolean).join(' ') || 'N/A',
      postalCode: '00000',
    }
    const description = order.items.map((i: any) => `${i.nameAr} x${i.quantity}`).join(', ').slice(0, 100)
    const customerPhone = `${order.customer.firstName} ${order.customer.lastName}`

    let result

    if (normalizedCarrier === 'dhl') {
      if (!settings?.dhlEnabled || !settings.dhlApiKey || !settings.dhlAccountNumber) {
        return reply.status(400).send({ error: 'DHL غير مفعل في إعدادات المتجر' })
      }
      result = await createDhlShipment(
        {
          shipper: { name: order.store.name, phone: '', address: shipperAddr },
          consignee: { name: customerPhone, phone: order.customer.phone, address: consigneeAddr },
          reference: order.orderNumber,
          description,
          weightKg,
        },
        { apiKey: settings.dhlApiKey, accountNumber: settings.dhlAccountNumber }
      )
      if (result.success) {
        await prisma.order.update({
          where: { id },
          data: { trackingNumber: result.shipmentTrackingNumber, shippingCompany: 'DHL' },
        })

        await prisma.shipmentTracking.upsert({
          where: { orderId: id },
          update: {
            trackingNumber: result.shipmentTrackingNumber,
            provider: 'DHL',
            status: 'CREATED',
            lastCheckedAt: new Date(),
          },
          create: {
            orderId: id,
            trackingNumber: result.shipmentTrackingNumber,
            provider: 'DHL',
            status: 'CREATED',
            events: [],
            lastCheckedAt: new Date(),
          },
        })
      }
    } else if (normalizedCarrier !== 'aramex') {
      return reply.status(400).send({ error: 'مزود الشحن غير مدعوم حالياً' })
    } else {
      if (!settings?.aramexEnabled || !settings.aramexUser || !settings.aramexPassword || !settings.aramexAccountNumber || !settings.aramexPinCode) {
        return reply.status(400).send({ error: 'Aramex غير مفعل في إعدادات المتجر' })
      }
      result = await createAramexShipment(
        {
          shipper: { name: order.store.name, phone: '', address: shipperAddr },
          consignee: { name: customerPhone, phone: order.customer.phone, address: consigneeAddr },
          reference: order.orderNumber,
          description,
          weight: weightKg,
        },
        {
          user: settings.aramexUser,
          password: settings.aramexPassword,
          accountNumber: settings.aramexAccountNumber,
          pinCode: settings.aramexPinCode,
        }
      )
      if (result.success) {
        await prisma.order.update({
          where: { id },
          data: { trackingNumber: result.awbNumber, shippingCompany: 'Aramex' },
        })

        await prisma.shipmentTracking.upsert({
          where: { orderId: id },
          update: {
            trackingNumber: result.awbNumber,
            provider: 'ARAMEX',
            status: 'CREATED',
            lastCheckedAt: new Date(),
          },
          create: {
            orderId: id,
            trackingNumber: result.awbNumber,
            provider: 'ARAMEX',
            status: 'CREATED',
            events: [],
            lastCheckedAt: new Date(),
          },
        })
      }
    }

    return reply.send({ success: result.success, trackingNumber: result.success ? (result as any).awbNumber ?? (result as any).shipmentTrackingNumber : undefined, error: result.error })
  })

  // ── Create Draft Order (merchant manual order) ─────────────────
  app.post('/draft', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const {
      storeId, customerPhone, customerFirstName, customerLastName, customerEmail,
      items, notes, shippingCost = 0,
    } = request.body as any

    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'storeId والعناصر مطلوبة' })
    }

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { storeId_phone: { storeId, phone: customerPhone ?? 'DRAFT-' + Date.now() } },
    })
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          storeId,
          phone: customerPhone ?? 'DRAFT-' + Date.now(),
          firstName: customerFirstName ?? 'عميل',
          lastName: customerLastName ?? 'جديد',
          email: customerEmail ?? null,
          isGuest: true,
        },
      })
    }

    // Compute totals
    const orderItems: any[] = []
    let subtotal = 0

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      })
      if (!product) continue

      let price = Number(product.price)
      let sku = product.sku

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId)
        if (variant) { price = Number(variant.price); sku = variant.sku }
      }

      const lineTotal = price * item.quantity
      subtotal += lineTotal
      orderItems.push({
        productId: product.id,
        variantId: item.variantId ?? null,
        name: product.name,
        nameAr: product.nameAr,
        sku,
        price,
        quantity: item.quantity,
        total: lineTotal,
      })
    }

    const vatAmount = subtotal * Number(store.vatRate)
    const total = subtotal + vatAmount + shippingCost

    // Generate order number
    const count = await prisma.order.count({ where: { storeId } })
    const orderNumber = `D-${String(count + 1).padStart(4, '0')}`

    const order = await prisma.order.create({
      data: {
        storeId,
        customerId: customer.id,
        orderNumber,
        status: 'DRAFT',
        paymentStatus: 'PENDING',
        paymentMethod: 'CASH_ON_DELIVERY',
        subtotal,
        shippingCost,
        vatAmount,
        discountAmount: 0,
        total,
        notes: notes ?? null,
        items: { create: orderItems },
      },
      include: {
        items: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    })

    return reply.status(201).send({ message: 'تم إنشاء الطلب المسودة', order })
  })

  // ── Get Order Returns ─────────────────────────
  app.get('/:id/returns', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const returns = await prisma.orderReturn.findMany({
      where: { orderId: id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ returns })
  })

  // ── Get Order Disputes ────────────────────────
  app.get('/:id/disputes', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const [tickets, orderReturns] = await Promise.all([
      prisma.supportTicket.findMany({
        where: {
          storeId: order.storeId,
          category: 'ORDER_DISPUTE',
          subject: { startsWith: `${ORDER_DISPUTE_SUBJECT_PREFIX}|${id}|` },
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.orderReturn.findMany({
        where: { orderId: id },
        select: { id: true, returnNumber: true },
      }),
    ])

    const returnNumbers = new Map(orderReturns.map((item) => [item.id, item.returnNumber]))
    const disputes = tickets
      .map((ticket) => {
        const parsed = parseOrderDisputeSubject(ticket.subject)
        if (!parsed || parsed.orderId !== id) return null

        return {
          id: ticket.id,
          title: parsed.title,
          returnId: parsed.returnId,
          returnNumber: parsed.returnId ? returnNumbers.get(parsed.returnId) ?? null : null,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          resolvedAt: ticket.resolvedAt,
          assignedToName: ticket.assignedToName,
          messages: ticket.messages,
        }
      })
      .filter(Boolean)

    return reply.send({ disputes })
  })

  // ── Create Order Dispute ─────────────────────
  app.post('/:id/disputes', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const parsed = z.object({
      title: z.string().trim().min(3).max(160),
      body: z.string().trim().min(10).max(4000),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      returnId: z.string().trim().optional(),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({ error: 'بيانات النزاع غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    let linkedReturn: { id: string; returnNumber: string } | null = null
    if (parsed.data.returnId) {
      linkedReturn = await prisma.orderReturn.findFirst({
        where: { id: parsed.data.returnId, orderId: id },
        select: { id: true, returnNumber: true },
      })

      if (!linkedReturn) {
        return reply.status(400).send({ error: 'المرتجع المحدد لا يتبع هذا الطلب' })
      }
    }

    const dispute = await prisma.supportTicket.create({
      data: {
        storeId: order.storeId,
        merchantId,
        subject: encodeOrderDisputeSubject(id, parsed.data.title, linkedReturn?.id),
        category: 'ORDER_DISPUTE',
        priority: (parsed.data.priority ?? 'HIGH') as any,
        messages: {
          create: {
            senderType: 'MERCHANT',
            senderId: merchantId,
            body: parsed.data.body,
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })

    return reply.status(201).send({
      message: 'تم فتح النزاع وإحالته إلى فريق الدعم',
      dispute: {
        id: dispute.id,
        title: parsed.data.title,
        returnId: linkedReturn?.id ?? null,
        returnNumber: linkedReturn?.returnNumber ?? null,
        status: dispute.status,
        priority: dispute.priority,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        messages: dispute.messages,
      },
    })
  })

  // ── Reply To Order Dispute ───────────────────
  app.post('/:id/disputes/:ticketId/messages', { preHandler: authenticate }, async (request, reply) => {
    const { id, ticketId } = request.params as { id: string; ticketId: string }
    const merchantId = (request.user as any).id

    const parsed = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'الرسالة غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        merchantId,
        category: 'ORDER_DISPUTE',
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })

    if (!ticket) {
      return reply.status(404).send({ error: 'النزاع غير موجود' })
    }

    const subject = parseOrderDisputeSubject(ticket.subject)
    if (!subject || subject.orderId !== id) {
      return reply.status(404).send({ error: 'النزاع لا يتبع هذا الطلب' })
    }

    if (ticket.status === 'CLOSED') {
      return reply.status(400).send({ error: 'تم إغلاق النزاع بالفعل' })
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderType: 'MERCHANT',
        senderId: merchantId,
        body: parsed.data.body,
      },
    })

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date(), status: ticket.status === 'RESOLVED' ? 'IN_PROGRESS' : ticket.status },
    })

    return reply.status(201).send({ message })
  })

  // ── Close Order Dispute ──────────────────────
  app.patch('/:id/disputes/:ticketId/close', { preHandler: authenticate }, async (request, reply) => {
    const { id, ticketId } = request.params as { id: string; ticketId: string }
    const merchantId = (request.user as any).id

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        merchantId,
        category: 'ORDER_DISPUTE',
      },
    })

    if (!ticket) {
      return reply.status(404).send({ error: 'النزاع غير موجود' })
    }

    const subject = parseOrderDisputeSubject(ticket.subject)
    if (!subject || subject.orderId !== id) {
      return reply.status(404).send({ error: 'النزاع لا يتبع هذا الطلب' })
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED', resolvedAt: new Date() },
    })

    return reply.send({ message: 'تم إغلاق النزاع', dispute: updated })
  })

  // ── Create Return Request ─────────────────────
  app.post('/:id/returns', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { reason, refundAmount, refundMethod, notes, items: returnItems } = request.body as any

    const order = await prisma.order.findUnique({
      where: { id },
      include: { store: true, items: true },
    })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    if (!['DELIVERED', 'SHIPPED'].includes(order.status)) {
      return reply.status(400).send({ error: 'لا يمكن طلب مرتجع لطلب غير مسلّم' })
    }

    const count = await prisma.orderReturn.count({ where: { orderId: id } })
    const returnNumber = `R-${order.orderNumber}-${count + 1}`
    const orderItemsById = new Map(order.items.map((item) => [item.id, item]))

    if (!Array.isArray(returnItems) || returnItems.length === 0) {
      return reply.status(400).send({ error: 'يجب اختيار عنصر واحد على الأقل للمرتجع' })
    }

    const existingReturnItems = await prisma.returnItem.findMany({
      where: {
        orderReturn: {
          orderId: id,
          status: { not: 'REJECTED' },
        },
      },
      select: {
        orderItemId: true,
        quantity: true,
      },
    })

    const alreadyReturnedQuantities = new Map<string, number>()
    for (const item of existingReturnItems) {
      alreadyReturnedQuantities.set(
        item.orderItemId,
        (alreadyReturnedQuantities.get(item.orderItemId) ?? 0) + item.quantity,
      )
    }

    for (const returnItem of returnItems) {
      const orderItem = orderItemsById.get(returnItem.orderItemId)
      if (!orderItem) {
        return reply.status(400).send({ error: 'أحد عناصر المرتجع لا يتبع هذا الطلب' })
      }

      if (!Number.isInteger(returnItem.quantity) || returnItem.quantity <= 0) {
        return reply.status(400).send({ error: 'كمية عنصر المرتجع غير صحيحة' })
      }

      const alreadyReturned = alreadyReturnedQuantities.get(returnItem.orderItemId) ?? 0
      if (returnItem.quantity + alreadyReturned > orderItem.quantity) {
        return reply.status(400).send({ error: 'كمية المرتجع تتجاوز الكمية المتبقية القابلة للإرجاع في الطلب' })
      }
    }

    const maxRefundAmount = calculateReturnRefundCeiling(order.items, returnItems)
    if (maxRefundAmount === null) {
      return reply.status(400).send({ error: 'تعذر احتساب سقف الاسترداد لعناصر المرتجع' })
    }

    const normalizedRefundAmount = refundAmount === undefined || refundAmount === null || refundAmount === ''
      ? 0
      : Number(refundAmount)

    if (!Number.isFinite(normalizedRefundAmount) || normalizedRefundAmount < 0) {
      return reply.status(400).send({ error: 'مبلغ الاسترداد غير صالح' })
    }

    if (normalizedRefundAmount > maxRefundAmount + 0.0001) {
      return reply.status(400).send({ error: 'مبلغ الاسترداد يتجاوز قيمة العناصر المختارة للمرتجع' })
    }

    const orderReturn = await prisma.orderReturn.create({
      data: {
        orderId: id,
        returnNumber,
        reason,
        refundAmount: normalizedRefundAmount,
        refundMethod: refundMethod ?? 'original_payment',
        notes: notes ?? null,
        items: returnItems?.length > 0
          ? {
              create: returnItems.map((ri: any) => ({
                orderItemId: ri.orderItemId,
                quantity: ri.quantity,
                reason: ri.reason ?? null,
              })),
            }
          : undefined,
      },
      include: { items: true },
    })

    return reply.status(201).send({ message: 'تم تسجيل طلب المرتجع', orderReturn })
  })

  // ── Update Return Status ──────────────────────
  app.patch('/:id/returns/:returnId', { preHandler: authenticate }, async (request, reply) => {
    const { id, returnId } = request.params as { id: string; returnId: string }
    const merchantId = (request.user as any).id
    const { status, notes } = request.body as { status: string; notes?: string }

    const order = await prisma.order.findUnique({ where: { id }, include: { store: true } })
    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    const orderReturn = await prisma.orderReturn.findFirst({
      where: { id: returnId, orderId: id },
      select: { id: true, status: true },
    })

    if (!orderReturn) {
      return reply.status(404).send({ error: 'المرتجع غير موجود لهذا الطلب' })
    }

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['REJECTED'],
      REJECTED: [],
      REFUNDED: [],
    }

    if (!allowedTransitions[orderReturn.status]?.includes(status)) {
      return reply.status(400).send({ error: 'انتقال حالة المرتجع غير صالح' })
    }

    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: status as any,
        notes: notes ?? undefined,
        processedAt: status === 'REFUNDED' || status === 'APPROVED' ? new Date() : undefined,
      },
    })

    return reply.send({ message: 'تم تحديث حالة المرتجع', orderReturn: updated })
  })

  app.post('/:id/returns/:returnId/refund', { preHandler: authenticate }, async (request, reply) => {
    const { id, returnId } = request.params as { id: string; returnId: string }
    const merchantId = (request.user as any).id

    const parsed = z.object({
      refundAmount: z.number().positive().optional(),
      refundMethod: z.enum(['original_payment', 'store_credit', 'bank_transfer', 'manual']).optional(),
      note: z.string().trim().max(1000).optional(),
      reference: z.string().trim().max(255).optional(),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({ error: 'بيانات تنفيذ الاسترداد غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        store: true,
        items: true,
      },
    })

    if (!order || order.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'الطلب غير موجود' })
    }

    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      return reply.status(400).send({ error: 'لا يمكن تنفيذ استرداد لطلب غير مدفوع' })
    }

    const orderReturn = await prisma.orderReturn.findFirst({
      where: { id: returnId, orderId: id },
      include: { items: true },
    })

    if (!orderReturn) {
      return reply.status(404).send({ error: 'المرتجع غير موجود لهذا الطلب' })
    }

    if (orderReturn.status !== 'APPROVED') {
      return reply.status(400).send({ error: 'يجب اعتماد المرتجع أولاً قبل تنفيذ الاسترداد' })
    }

    const maxRefundAmount = calculateReturnRefundCeiling(order.items, orderReturn.items)
    if (maxRefundAmount === null) {
      return reply.status(400).send({ error: 'تعذر احتساب سقف الاسترداد لهذا المرتجع' })
    }

    const requestedRefundAmount = parsed.data.refundAmount ?? Number(orderReturn.refundAmount)
    if (!Number.isFinite(requestedRefundAmount) || requestedRefundAmount <= 0) {
      return reply.status(400).send({ error: 'يجب تحديد مبلغ استرداد صالح قبل التنفيذ' })
    }

    if (requestedRefundAmount > maxRefundAmount + 0.0001) {
      return reply.status(400).send({ error: 'مبلغ الاسترداد يتجاوز قيمة عناصر هذا المرتجع' })
    }

    const refundMethod = parsed.data.refundMethod ?? orderReturn.refundMethod ?? 'manual'
    let gatewayRefundId: string | null = null
    let message = 'تم تنفيذ الاسترداد بنجاح'

    if (refundMethod === 'original_payment') {
      if (order.paymentMethod !== 'BENEFIT_PAY') {
        return reply.status(503).send({
          error: 'الاسترداد عبر طريقة الدفع الأصلية غير مدعوم لهذا المزود حالياً',
          status: 'NOT_READY',
        })
      }

      const refundResult = await issueBenefitPayRefund({
        merchantId,
        orderId: id,
        amount: requestedRefundAmount,
        reason: parsed.data.note || orderReturn.reason,
      })

      if (!refundResult.ok) {
        return reply.status(refundResult.statusCode).send(refundResult.body)
      }

      gatewayRefundId = refundResult.body.refundId ?? null
      message = refundResult.body.message ?? message
    }

    const updatedReturn = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: 'REFUNDED',
        refundAmount: requestedRefundAmount,
        refundMethod,
        processedAt: new Date(),
        notes: mergeTextNotes(
          orderReturn.notes,
          parsed.data.note,
          parsed.data.reference ? `Reference: ${parsed.data.reference}` : null,
          gatewayRefundId ? `Gateway refund: ${gatewayRefundId}` : null,
        ),
      },
      include: { items: true },
    })

    const refundSync = await syncOrderRefundStatus(id, Number(order.total), order.status)

    return reply.send({
      message,
      orderReturn: updatedReturn,
      refundedAmount: refundSync.refundedAmount,
      paymentStatus: refundSync.paymentStatus,
      gatewayRefundId,
    })
  })
}
