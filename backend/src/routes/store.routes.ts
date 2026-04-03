import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const createStoreSchema = z.object({
  name: z.string().min(2, 'اسم المتجر مطلوب'),
  nameAr: z.string().min(2, 'اسم المتجر بالعربي مطلوب'),
  subdomain: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام فقط'),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  vatNumber: z.string().optional(),
  crNumber: z.string().optional(),
})

const updateStoreSchema = createStoreSchema.partial().extend({
  logo: z.string().url().optional(),
  favicon: z.string().url().optional(),
  ogImage: z.string().url().optional(),
  language: z.enum(['AR', 'EN', 'BOTH']).optional(),
  timezone: z.string().optional(),
})

export async function storeRoutes(app: FastifyInstance) {
  // ── Create Store ──────────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const result = createStoreSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const { name, nameAr, subdomain, description, descriptionAr, vatNumber, crNumber } = result.data

    const existingSubdomain = await prisma.store.findUnique({ where: { subdomain } })
    if (existingSubdomain) {
      return reply.status(409).send({ error: 'هذا الرابط مستخدم، اختر رابطاً آخر' })
    }

    const store = await prisma.store.create({
      data: {
        merchantId,
        name,
        nameAr,
        subdomain,
        slug: subdomain,
        description,
        descriptionAr,
        vatNumber,
        crNumber,
        settings: { create: {} },
      },
      include: { settings: true },
    })

    return reply.status(201).send({ message: 'تم إنشاء المتجر بنجاح', store })
  })

  // ── Get My Stores ─────────────────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id

    const stores = await prisma.store.findMany({
      where: { merchantId },
      include: {
        settings: true,
        _count: { select: { products: true, orders: true, customers: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ stores })
  })

  // ── Get Store by Subdomain (public) ───────────
  app.get('/s/:subdomain', async (request, reply) => {
    const { subdomain } = request.params as { subdomain: string }

    const store = await prisma.store.findUnique({
      where: { subdomain, isActive: true },
      select: {
        id: true, name: true, nameAr: true, subdomain: true,
        description: true, descriptionAr: true,
        logo: true, favicon: true, currency: true,
        language: true, vatRate: true,
        settings: { select: { primaryColor: true, secondaryColor: true, fontFamily: true, theme: true } },
      },
    })

    if (!store) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    return reply.send({ store })
  })

  // ── Get Store by ID (merchant only) ───────────
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({
      where: { id, merchantId },
      include: {
        settings: true,
        _count: { select: { products: true, orders: true, customers: true } },
      },
    })

    if (!store) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    return reply.send({ store })
  })

  // ── Update Store ──────────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const result = updateStoreSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const existing = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!existing) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    const { logo, favicon, ogImage, language, timezone, ...storeData } = result.data

    const store = await prisma.store.update({
      where: { id },
      data: { ...storeData, logo, favicon, ogImage, language, timezone },
      include: { settings: true },
    })

    return reply.send({ message: 'تم تحديث المتجر بنجاح', store })
  })

  // ── Update Store Settings ─────────────────────
  app.patch('/:id/settings', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const existing = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!existing) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    const settings = await prisma.storeSettings.update({
      where: { storeId: id },
      data: request.body as any,
    })

    return reply.send({ message: 'تم تحديث الإعدادات بنجاح', settings })
  })

  // ── Store Dashboard Stats ─────────────────────
  app.get('/:id/stats', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) {
      return reply.status(404).send({ error: 'المتجر غير موجود' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalOrders, todayOrders, totalRevenue, totalProducts, totalCustomers, recentOrders] =
      await Promise.all([
        prisma.order.count({ where: { storeId: id } }),
        prisma.order.count({ where: { storeId: id, createdAt: { gte: today } } }),
        prisma.order.aggregate({
          where: { storeId: id, paymentStatus: 'PAID' },
          _sum: { total: true },
        }),
        prisma.product.count({ where: { storeId: id, isActive: true } }),
        prisma.customer.count({ where: { storeId: id } }),
        prisma.order.findMany({
          where: { storeId: id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
            items: { select: { name: true, quantity: true, total: true } },
          },
        }),
      ])

    // Conversion rate: % of orders vs customers (simplified)
    const conversionRate = totalCustomers > 0
      ? Math.round((totalOrders / totalCustomers) * 100 * 10) / 10
      : 0

    // Repeat customers: customers with more than 1 order
    const repeatCustomers = await prisma.customer.count({
      where: { storeId: id, totalOrders: { gt: 1 } },
    })
    const repeatRate = totalCustomers > 0
      ? Math.round((repeatCustomers / totalCustomers) * 100 * 10) / 10
      : 0

    // Average order value
    const avgOrderValue = totalOrders > 0 && totalRevenue._sum.total
      ? Math.round((Number(totalRevenue._sum.total) / totalOrders) * 1000) / 1000
      : 0

    return reply.send({
      stats: {
        totalOrders,
        todayOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        totalProducts,
        totalCustomers,
        conversionRate,
        repeatCustomers,
        repeatRate,
        avgOrderValue,
      },
      recentOrders,
    })
  })

  // ── Export Stats as CSV ───────────────────────
  app.get('/:id/stats/export', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { period = '30' } = request.query as { period?: string }

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const days = Math.min(365, Math.max(1, parseInt(period) || 30))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const orders = await prisma.order.findMany({
      where: { storeId: id, createdAt: { gte: since } },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        items: { select: { nameAr: true, quantity: true, price: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows: string[] = [
      'رقم الطلب,التاريخ,الحالة,حالة الدفع,العميل,الهاتف,المجموع,طريقة الدفع',
    ]
    for (const o of orders) {
      const customerName = `${o.customer.firstName} ${o.customer.lastName}`
      rows.push(
        [
          o.orderNumber,
          o.createdAt.toISOString().slice(0, 10),
          o.status,
          o.paymentStatus,
          `"${customerName}"`,
          o.customer.phone,
          Number(o.total).toFixed(3),
          o.paymentMethod,
        ].join(',')
      )
    }

    const csv = rows.join('\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="orders-${store.subdomain}-${period}d.csv"`)
    return reply.send('\uFEFF' + csv) // BOM for Arabic UTF-8 Excel
  })

  // ── Page Builder: Get Homepage Blocks ─────────
  app.get('/:id/homepage', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id, merchantId }, include: { settings: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const blocks = (store.settings?.homeBlocks ?? []) as any[]
    return reply.send({ blocks })
  })

  // ── Page Builder: Save Homepage Blocks ────────
  app.put('/:id/homepage', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const body = request.body as { blocks: any[] }
    if (!Array.isArray(body?.blocks)) {
      return reply.status(400).send({ error: 'blocks يجب أن يكون مصفوفة' })
    }

    const store = await prisma.store.findFirst({ where: { id, merchantId } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    await prisma.storeSettings.update({
      where: { storeId: id },
      data: { homeBlocks: body.blocks as any },
    })

    return reply.send({ message: 'تم حفظ تصميم الصفحة الرئيسية' })
  })

  // ── Page Builder: Get Homepage (public) ───────
  app.get('/s/:subdomain/homepage', async (request, reply) => {
    const { subdomain } = request.params as { subdomain: string }

    const store = await prisma.store.findUnique({
      where: { subdomain, isActive: true },
      include: { settings: { select: { homeBlocks: true } } },
    })

    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const blocks = (store.settings?.homeBlocks ?? []) as any[]
    return reply.send({ blocks })
  })
}
