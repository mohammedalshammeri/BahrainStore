import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const createProductSchema = z.object({
  storeId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
  name: z.string().min(2),
  nameAr: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().positive('السعر يجب أن يكون موجباً'),
  comparePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockAlert: z.number().int().min(0).default(5),
  trackInventory: z.boolean().default(true),
  weight: z.number().positive().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isDigital: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
})

export async function productRoutes(app: FastifyInstance) {
  // ── Create Product ────────────────────────────
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const result = createProductSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const data = result.data

    const store = await prisma.store.findFirst({ where: { id: data.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const existing = await prisma.product.findUnique({
      where: { storeId_slug: { storeId: data.storeId, slug: data.slug } },
    })
    if (existing) return reply.status(409).send({ error: 'هذا الرابط مستخدم لمنتج آخر' })

    const product = await prisma.product.create({
      data: { ...data, price: data.price, comparePrice: data.comparePrice, costPrice: data.costPrice },
      include: { images: true, variants: true, category: { select: { id: true, name: true, nameAr: true } } },
    })

    return reply.status(201).send({ message: 'تم إضافة المنتج بنجاح', product })
  })

  // ── List Products (merchant) ──────────────────
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId, page = '1', limit = '20', search, categoryId, isActive } =
      request.query as Record<string, string>

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = { storeId }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ]
    if (categoryId) where.categoryId = categoryId
    if (isActive !== undefined) where.isActive = isActive === 'true'

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { take: 1, orderBy: { sortOrder: 'asc' } },
          category: { select: { id: true, name: true, nameAr: true } },
          _count: { select: { variants: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])

    return reply.send({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })

  // ── Get Product by ID ─────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { isActive: true } },
        category: { select: { id: true, name: true, nameAr: true, slug: true } },
      },
    })

    if (!product || !product.isActive) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    return reply.send({ product })
  })

  // ── Update Product ────────────────────────────
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: request.body as any,
      include: { images: true, variants: true },
    })

    return reply.send({ message: 'تم تحديث المنتج بنجاح', product: updated })
  })

  // ── Delete Product ────────────────────────────
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    await prisma.product.delete({ where: { id } })

    return reply.send({ message: 'تم حذف المنتج بنجاح' })
  })

  // ── Add Product Image ─────────────────────────
  app.post('/:id/images', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { url, alt, sortOrder } = request.body as { url: string; alt?: string; sortOrder?: number }

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    const image = await prisma.productImage.create({ data: { productId: id, url, alt, sortOrder } })
    return reply.status(201).send({ image })
  })

  // ── Add Product Variant ───────────────────────
  app.post('/:id/variants', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const body = request.body as any

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    const variant = await prisma.productVariant.create({ data: { productId: id, ...body } })
    return reply.status(201).send({ variant })
  })

  // ── Storefront: List Products (public) ────────
  app.get('/store/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { page = '1', limit = '20', search, categoryId, sort = 'newest' } =
      request.query as Record<string, string>

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId, isActive: true }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
    ]
    if (categoryId) where.categoryId = categoryId

    const orderBy: any =
      sort === 'price_asc' ? { price: 'asc' } :
      sort === 'price_desc' ? { price: 'desc' } :
      sort === 'featured' ? { isFeatured: 'desc' } :
      { createdAt: 'desc' }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { take: 1, orderBy: { sortOrder: 'asc' } },
          variants: { where: { isActive: true }, select: { id: true, name: true, nameAr: true, price: true, stock: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy,
      }),
      prisma.product.count({ where }),
    ])

    return reply.send({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })
}
