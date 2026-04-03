import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import * as crypto from 'crypto'

// ─── ZATCA (Saudi Arabia e-Invoicing) + B2B Invoice Routes ───────────────────

export async function zatcaRoutes(app: FastifyInstance) {
  // POST /zatca/generate — Generate ZATCA-compliant QR code for an order
  app.post('/generate', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string(),
      storeId: z.string(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { orderId, storeId } = result.data

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({
      where: { id: storeId, merchantId },
      include: { settings: true },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    // Build ZATCA TLV QR code (ZATCA Phase 1 standard)
    const sellerName = store.name
    const vatNumber = store.settings?.zatcaVatNumber || ''
    const timestamp = new Date(order.createdAt).toISOString()
    const totalAmount = Number(order.total).toFixed(2)
    const vatAmount = (Number(order.total) * 0.15).toFixed(2) // 15% VAT

    const tlvQr = buildZatcaTlv(sellerName, vatNumber, timestamp, totalAmount, vatAmount)

    // Save ZATCA invoice record
    const existingInvoice = await prisma.zatcaInvoice.findUnique({
      where: { orderId },
    })

    const invoiceNumber = existingInvoice?.invoiceNumber ||
      `ZATCA-${storeId.slice(-4).toUpperCase()}-${Date.now()}`

    const zatcaInvoice = existingInvoice
      ? await prisma.zatcaInvoice.update({
          where: { orderId },
          data: { qrCode: tlvQr, invoiceNumber, vatAmount: parseFloat(vatAmount) },
        })
      : await prisma.zatcaInvoice.create({
          data: {
            storeId,
            orderId,
            invoiceNumber,
            qrCode: tlvQr,
            vatAmount: parseFloat(vatAmount),
            totalAmount: Number(order.total),
            sellerName,
            sellerVat: vatNumber,
          },
        })

    return reply.send({
      invoiceNumber: zatcaInvoice.invoiceNumber,
      qrCode: zatcaInvoice.qrCode,
      vatAmount,
      totalAmount,
      message: 'تم إنشاء الفاتورة الإلكترونية بنجاح',
    })
  })

  // GET /zatca/invoices — List store ZATCA invoices
  app.get('/invoices', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, page = '1', limit = '20' } = request.query as {
      storeId: string; page?: string; limit?: string
    }

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [invoices, total] = await Promise.all([
      prisma.zatcaInvoice.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.zatcaInvoice.count({ where: { storeId } }),
    ])

    return reply.send({ invoices, total, page: parseInt(page), limit: parseInt(limit) })
  })

  // GET /zatca/invoices/:invoiceId — Invoice details + QR
  app.get('/invoices/:invoiceId', { preHandler: authenticate }, async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string }
    const merchantId = (request.user as any).id

    const invoice = await prisma.zatcaInvoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return reply.status(404).send({ error: 'الفاتورة غير موجودة' })

    const store = await prisma.store.findFirst({
      where: { id: invoice.storeId, merchantId },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    return reply.send(invoice)
  })
}

// ─── B2B Invoice Routes ───────────────────────────────────────────────────────

export async function b2bInvoiceRoutes(app: FastifyInstance) {
  // POST /b2b/invoices — Create B2B invoice
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      orderId: z.string().optional(),
      clientName: z.string(),
      clientVatNumber: z.string().optional(),
      clientCrNumber: z.string().optional(),
      clientEmail: z.string().email().optional(),
      clientPhone: z.string().optional(),
      clientAddress: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        vatRate: z.number().default(0.15),
      })),
      currency: z.string().default('BHD'),
      notes: z.string().optional(),
      dueDate: z.string().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const data = result.data
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({
      where: { id: data.storeId, merchantId },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const vatAmount = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * item.vatRate, 0
    )
    const total = subtotal + vatAmount

    const invoiceNumber = `B2B-${data.storeId.slice(-4).toUpperCase()}-${Date.now()}`

    const invoice = await prisma.b2BInvoice.create({
      data: {
        storeId: data.storeId,
        orderId: data.orderId,
        invoiceNumber,
        buyerCompany: data.clientName,
        buyerVat: data.clientVatNumber,
        buyerCR: data.clientCrNumber,
        buyerEmail: data.clientEmail,
        items: data.items,
        subtotal,
        vatAmount,
        total,
        notes: data.notes,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: 'DRAFT',
      },
    })

    return reply.status(201).send({ message: 'تم إنشاء الفاتورة بنجاح', invoice })
  })

  // GET /b2b/invoices — List B2B invoices
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, status, page = '1', limit = '20' } = request.query as {
      storeId: string; status?: string; page?: string; limit?: string
    }

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId }
    if (status) where.status = status

    const [invoices, total] = await Promise.all([
      prisma.b2BInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.b2BInvoice.count({ where }),
    ])

    return reply.send({ invoices, total, page: parseInt(page), limit: parseInt(limit) })
  })

  // GET /b2b/invoices/:id — Invoice details
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const invoice = await prisma.b2BInvoice.findUnique({ where: { id } })
    if (!invoice) return reply.status(404).send({ error: 'الفاتورة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: invoice.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    return reply.send(invoice)
  })

  // PATCH /b2b/invoices/:id/status — Update invoice status
  app.patch('/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }
    const merchantId = (request.user as any).id

    const invoice = await prisma.b2BInvoice.findUnique({ where: { id } })
    if (!invoice) return reply.status(404).send({ error: 'الفاتورة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: invoice.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const updated = await prisma.b2BInvoice.update({
      where: { id },
      data: { status: status as any },
    })

    return reply.send({ message: 'تم تحديث حالة الفاتورة', invoice: updated })
  })

  // DELETE /b2b/invoices/:id — Delete draft invoice
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const invoice = await prisma.b2BInvoice.findUnique({ where: { id } })
    if (!invoice) return reply.status(404).send({ error: 'الفاتورة غير موجودة' })
    if (invoice.status !== 'DRAFT')
      return reply.status(400).send({ error: 'لا يمكن حذف فاتورة مدفوعة أو مرسلة' })

    const store = await prisma.store.findFirst({ where: { id: invoice.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.b2BInvoice.delete({ where: { id } })
    return reply.send({ message: 'تم حذف الفاتورة' })
  })
}

// ─── Helper: Build ZATCA TLV (Tag-Length-Value) QR code ──────────────────────

function buildZatcaTlv(
  sellerName: string,
  vatNumber: string,
  timestamp: string,
  total: string,
  vat: string
): string {
  const fields = [
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: total },
    { tag: 5, value: vat },
  ]

  let tlvBuffer = Buffer.alloc(0)

  for (const field of fields) {
    const valueBuffer = Buffer.from(field.value, 'utf8')
    const tagBuffer = Buffer.from([field.tag])
    const lengthBuffer = Buffer.from([valueBuffer.length])
    tlvBuffer = Buffer.concat([tlvBuffer, tagBuffer, lengthBuffer, valueBuffer])
  }

  return tlvBuffer.toString('base64')
}
