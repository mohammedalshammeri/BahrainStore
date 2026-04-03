import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '../lib/email'
import { sendWhatsAppOrderConfirmation, sendWhatsAppStatusUpdate } from '../lib/whatsapp'
import { sendOrderConfirmationSms, sendOrderStatusUpdateSms } from '../lib/sms'
import { createAramexShipment } from '../lib/aramex'
import { createDhlShipment } from '../lib/dhl'

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

    const order = await prisma.$transaction(async (tx) => {
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

    return reply.status(201).send({ message: 'تم إنشاء الطلب بنجاح', order })
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

    const order = await prisma.order.findFirst({
      where: { orderNumber },
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
        notes: true,
        createdAt: true,
        paidAt: true,
        store: { select: { nameAr: true, name: true, subdomain: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
        address: { select: { area: true, block: true, road: true, building: true, flat: true } },
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

    return reply.send({ order })
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

    if (carrier === 'dhl') {
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
      }
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

    const orderReturn = await prisma.orderReturn.create({
      data: {
        orderId: id,
        returnNumber,
        reason,
        refundAmount: refundAmount ?? 0,
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

    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: status as any,
        notes: notes ?? undefined,
        processedAt: status === 'REFUNDED' || status === 'APPROVED' ? new Date() : undefined,
      },
    })

    // If refunded, update order payment status
    if (status === 'REFUNDED') {
      await prisma.order.update({
        where: { id },
        data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' },
      })
    }

    return reply.send({ message: 'تم تحديث حالة المرتجع', orderReturn: updated })
  })
}
