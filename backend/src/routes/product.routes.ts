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
  digitalFileUrl: z.string().url().optional(),
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
  app.get('/:id/merchant', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const product = await prisma.product.findFirst({
      where: { id, store: { merchantId } },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        },
        variants: {
          orderBy: { sortOrder: 'asc' },
          include: { optionValues: { include: { optionValue: true } } },
        },
        category: { select: { id: true, name: true, nameAr: true, slug: true } },
      },
    })

    if (!product) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    return reply.send({ product })
  })

  // ── Get Product by ID ─────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { optionValues: { include: { optionValue: true } } },
        },
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

  // ── Get Product Options & Variants ───────────
  app.get('/:id/options', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    const options = await prisma.productOption.findMany({
      where: { productId: id },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    })

    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      include: {
        optionValues: { include: { optionValue: { include: { option: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send({ options, variants })
  })

  // ── Save All Options + Auto-generate Variants ─
  app.post('/:id/options/save', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { options } = request.body as {
      options: Array<{
        name: string
        nameAr: string
        values: Array<{ value: string; valueAr: string; color?: string }>
      }>
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { store: true, variants: true },
    })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    // Delete old options (cascade deletes values + variantOptionValues)
    await prisma.productOption.deleteMany({ where: { productId: id } })

    if (!options || options.length === 0) {
      await prisma.productVariant.deleteMany({ where: { productId: id } })
      return reply.send({ message: 'تم حذف جميع المتغيرات', variants: [] })
    }

    // Create new options and values
    const createdOptions = []
    for (let oi = 0; oi < options.length; oi++) {
      const opt = options[oi]
      const createdOpt = await prisma.productOption.create({
        data: {
          productId: id,
          name: opt.name,
          nameAr: opt.nameAr,
          sortOrder: oi,
          values: {
            create: opt.values.map((v, vi) => ({
              value: v.value,
              valueAr: v.valueAr,
              color: v.color ?? null,
              sortOrder: vi,
            })),
          },
        },
        include: { values: true },
      })
      createdOptions.push(createdOpt)
    }

    // Generate all combinations (cartesian product)
    function cartesian(arrays: any[][]): any[][] {
      return arrays.reduce<any[][]>(
        (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
        [[]]
      )
    }

    const valueGroups = createdOptions.map((o) => o.values)
    const combinations = cartesian(valueGroups)

    // Delete existing variants
    await prisma.productVariant.deleteMany({ where: { productId: id } })

    // Create new variants from combinations
    const variants = []
    for (let ci = 0; ci < combinations.length; ci++) {
      const combo = combinations[ci]
      const nameParts = combo.map((v: any) => v.value).join(' / ')
      const nameArParts = combo.map((v: any) => v.valueAr).join(' / ')

      const variant = await prisma.productVariant.create({
        data: {
          productId: id,
          name: nameParts,
          nameAr: nameArParts,
          price: product.price,
          stock: product.stock,
          sortOrder: ci,
          optionValues: {
            create: combo.map((v: any) => ({ optionValueId: v.id })),
          },
        },
        include: {
          optionValues: { include: { optionValue: { include: { option: true } } } },
        },
      })
      variants.push(variant)
    }

    return reply.send({ message: `تم إنشاء ${variants.length} متغير`, variants })
  })

  // ── Update Single Variant (price/stock/sku) ───
  app.patch('/:id/variants/:variantId', { preHandler: authenticate }, async (request, reply) => {
    const { id, variantId } = request.params as { id: string; variantId: string }
    const merchantId = (request.user as any).id
    const body = request.body as any

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    const allowed = ['price', 'comparePrice', 'costPrice', 'stock', 'sku', 'barcode', 'image', 'isActive']
    const data: any = {}
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key]
    }

    const variant = await prisma.productVariant.update({ where: { id: variantId }, data })
    return reply.send({ variant })
  })

  // ── Bulk Update Variants ──────────────────────
  app.patch('/:id/variants', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { variants } = request.body as { variants: Array<{ id: string; price?: number; stock?: number; sku?: string; isActive?: boolean }> }

    const product = await prisma.product.findUnique({ where: { id }, include: { store: true } })
    if (!product || product.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'المنتج غير موجود' })
    }

    await Promise.all(
      variants.map((v) => {
        const { id: vid, ...data } = v
        return prisma.productVariant.update({ where: { id: vid }, data })
      })
    )

    const updated = await prisma.productVariant.findMany({
      where: { productId: id },
      include: { optionValues: { include: { optionValue: { include: { option: true } } } } },
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send({ message: 'تم تحديث المتغيرات', variants: updated })
  })

  // ── Add Product Variant (legacy simple) ───────
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
    const { page = '1', limit = '20', search, categoryId, sort = 'newest',
            minPrice, maxPrice, inStock } =
      request.query as Record<string, string>

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const store = await prisma.store.findFirst({
      where: {
        OR: [{ id: storeId }, { subdomain: storeId }],
        isActive: true,
      },
      select: { id: true },
    })
    if (!store) return reply.send({ products: [], total: 0, page: parseInt(page), pages: 0 })

    const where: any = { storeId: store.id, isActive: true }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ]
    if (categoryId) where.categoryId = categoryId
    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }
    if (inStock === 'true') where.stock = { gt: 0 }

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

  app.get('/public/:subdomain/:slug', async (request, reply) => {
    const { subdomain, slug } = request.params as { subdomain: string; slug: string }

    const product = await prisma.product.findFirst({
      where: {
        slug,
        isActive: true,
        store: { subdomain, isActive: true },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { optionValues: { include: { optionValue: { include: { option: true } } } } },
        },
        category: { select: { id: true, name: true, nameAr: true, slug: true } },
        store: { select: { id: true, subdomain: true } },
      },
    })

    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    return reply.send({ product })
  })

  // ── Instant Search Suggestions ────────────────
  app.get('/store/:storeId/instant', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { q = '' } = request.query as { q?: string }

    if (!q || q.trim().length < 2) return reply.send({ products: [] })

    const products = await prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
      },
      take: 8,
      orderBy: { isFeatured: 'desc' },
    })

    return reply.send({ products })
  })

  // ── Bulk Create Products (CSV import) ────────────────────
  app.post('/bulk', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId, products } = request.body as { storeId?: string; products?: any[] }

    if (!storeId || !Array.isArray(products) || products.length === 0) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    }
    if (products.length > 500) {
      return reply.status(400).send({ error: 'الحد الأقصى 500 منتج في كل عملية' })
    }

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const p of products) {
      try {
        const slug = (p.slug || p.name)
          .toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/(^-|-$)/g, '')
        const existing = await prisma.product.findUnique({
          where: { storeId_slug: { storeId, slug } },
        })
        if (existing) { skipped++; continue }

        await prisma.product.create({
          data: {
            storeId,
            name: String(p.name ?? '').trim() || 'منتج',
            nameAr: String(p.nameAr ?? p.name ?? '').trim() || 'منتج',
            slug,
            description: p.description ?? null,
            descriptionAr: p.descriptionAr ?? null,
            sku: p.sku ?? null,
            barcode: p.barcode ?? null,
            price: Number(p.price) || 0,
            comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
            costPrice: p.costPrice ? Number(p.costPrice) : null,
            stock: Number(p.stock) || 0,
            isActive: p.isActive !== false,
            isFeatured: Boolean(p.isFeatured),
            isDigital: Boolean(p.isDigital),
            digitalFileUrl: p.digitalFileUrl ?? null,
          },
        })
        created++
      } catch (e) {
        errors.push(`التخطي ${p.name ?? '?'}: ${(e as Error).message}`)
      }
    }

    return reply.send({
      message: `تم إضافة ${created} منتج، تخطي ${skipped}، أخطاء ${errors.length}`,
      created, skipped, errors,
    })
  })

  // ── Related Products (same category, public) ──────────────
  app.get('/:id/related', async (request, reply) => {
    const { id } = request.params as { id: string }
    const limit = parseInt((request.query as Record<string, string>).limit ?? '6')

    const product = await prisma.product.findUnique({
      where: { id },
      select: { storeId: true, categoryId: true },
    })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    const related = await prisma.product.findMany({
      where: {
        storeId: product.storeId,
        isActive: true,
        id: { not: id },
        ...(product.categoryId ? { categoryId: product.categoryId } : {}),
      },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: { isFeatured: 'desc' },
      take: limit,
    })

    // fallback: same store if no category products
    if (related.length === 0) {
      const fallback = await prisma.product.findMany({
        where: { storeId: product.storeId, isActive: true, id: { not: id } },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        orderBy: { isFeatured: 'desc' },
        take: limit,
      })
      return reply.send({ products: fallback })
    }

    return reply.send({ products: related })
  })
}
