import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ensureProductBelongsToStore, ensureVariantBelongsToProduct, findMerchantStore, findMerchantWarehouse } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

// ─── Multi-location Inventory Routes ──────────────────────────────────────────

export async function warehouseRoutes(app: FastifyInstance) {
  // POST /warehouses — Create warehouse
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      name: z.string().min(1),
      nameAr: z.string().min(1),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().default('BH'),
      isDefault: z.boolean().default(false),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, ...data } = result.data

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    if (data.isDefault) {
      await prisma.warehouse.updateMany({ where: { storeId }, data: { isDefault: false } })
    }

    const warehouse = await prisma.warehouse.create({ data: { storeId, ...data } })
    return reply.status(201).send({ message: 'تم إنشاء المستودع', warehouse })
  })

  // GET /warehouses?storeId=
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const warehouses = await prisma.warehouse.findMany({
      where: { storeId, isActive: true },
      include: { _count: { select: { stocks: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })

    return reply.send({ warehouses })
  })

  // PATCH /warehouses/:id — Update warehouse
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const schema = z.object({
      name: z.string().min(1).optional(),
      nameAr: z.string().min(1).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().min(2).max(3).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0, { message: 'يجب إرسال حقل واحد على الأقل للتحديث' })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const warehouse = await findMerchantWarehouse(merchantId, id)
    if (!warehouse) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    if (result.data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { storeId: warehouse.storeId, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.warehouse.update({ where: { id }, data: result.data })
    return reply.send({ warehouse: updated })
  })

  // DELETE /warehouses/:id
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const warehouse = await findMerchantWarehouse(merchantId, id)
    if (!warehouse) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }
    if (warehouse.isDefault) {
      return reply.status(400).send({ error: 'لا يمكن حذف المستودع الافتراضي' })
    }

    await prisma.warehouse.update({ where: { id }, data: { isActive: false } })
    return reply.send({ message: 'تم أرشفة المستودع' })
  })

  // GET /warehouses/:id/stock — Get stock for a warehouse
  app.get('/:id/stock', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number }
    const merchantId = (request.user as any).id

    const warehouse = await findMerchantWarehouse(merchantId, id)
    if (!warehouse) return reply.status(403).send({ error: 'غير مصرح' })

    const [stocks, total] = await Promise.all([
      prisma.warehouseStock.findMany({
        where: { warehouseId: id },
        include: {
          product: { select: { name: true, nameAr: true, sku: true, images: { take: 1 } } },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.warehouseStock.count({ where: { warehouseId: id } }),
    ])

    return reply.send({ stocks, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // PUT /warehouses/:id/stock — Update stock for a product in a warehouse
  app.put('/:id/stock', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const schema = z.object({
      productId: z.string().cuid(),
      variantId: z.string().optional(),
      stock: z.number().int().min(0),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { productId, variantId, stock } = result.data

    const warehouse = await findMerchantWarehouse(merchantId, id)
    if (!warehouse) return reply.status(403).send({ error: 'غير مصرح' })

    const product = await ensureProductBelongsToStore(productId, warehouse.storeId)
    if (!product) return reply.status(403).send({ error: 'المنتج لا يخص متجرك' })

    if (variantId) {
      const variant = await ensureVariantBelongsToProduct(variantId, productId)
      if (!variant) return reply.status(400).send({ error: 'المتغير غير صالح لهذا المنتج' })
    }

    const warehouseStock = await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId_variantId: {
          warehouseId: id,
          productId,
          variantId: (variantId || null) as string,
        },
      },
      update: { stock },
      create: { warehouseId: id, productId, variantId, stock },
    })

    // Also update the main product stock (aggregate)
    const totalStock = await prisma.warehouseStock.aggregate({
      where: { productId, variantId: variantId || null },
      _sum: { stock: true },
    })

    if (variantId) {
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: totalStock._sum.stock || 0 } })
    } else {
      await prisma.product.update({ where: { id: productId }, data: { stock: totalStock._sum.stock || 0 } })
    }

    return reply.send({ message: 'تم تحديث المخزون', warehouseStock })
  })

  // GET /warehouses/total-stock/:storeId/:productId — Total stock across warehouses
  app.get('/total-stock/:storeId/:productId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, productId } = request.params as { storeId: string; productId: string }
    const merchantId = (request.user as any).id

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const product = await ensureProductBelongsToStore(productId, storeId)
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    const stocks = await prisma.warehouseStock.findMany({
      where: { product: { storeId }, productId },
      include: { warehouse: { select: { name: true, nameAr: true, isDefault: true, city: true } } },
    })

    const totalStock = stocks.reduce((s, w) => s + w.stock - w.reserved, 0)
    return reply.send({ stocks, totalAvailable: totalStock })
  })
}
