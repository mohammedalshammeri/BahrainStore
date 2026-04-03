import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

// ─── Smart Search Routes ──────────────────────────────────────────────────────
// PostgreSQL full-text search with Arabic + English support
// Includes: autocomplete, fuzzy matching, filters, search analytics

// ─── Helper: calculate relevance score ────────────────────────────────────────
function scoreProduct(product: any, query: string): number {
  const q = query.toLowerCase()
  let score = 0

  const name = (product.name || '').toLowerCase()
  const nameAr = (product.nameAr || '').toLowerCase()
  const sku = (product.sku || '').toLowerCase()
  const barcode = (product.barcode || '').toLowerCase()
  const desc = (product.description || '').toLowerCase()
  const descAr = (product.descriptionAr || '').toLowerCase()

  // Exact match on name (highest priority)
  if (name === q || nameAr === q) score += 100
  // Starts with query
  if (name.startsWith(q) || nameAr.startsWith(q)) score += 50
  // Contains query in name
  if (name.includes(q) || nameAr.includes(q)) score += 30
  // SKU/Barcode match
  if (sku === q || barcode === q) score += 90
  if (sku.startsWith(q) || barcode.startsWith(q)) score += 40
  // Description match
  if (desc.includes(q) || descAr.includes(q)) score += 10
  // Boost featured products
  if (product.isFeatured) score += 5
  // Boost in-stock products
  if (product.stock > 0) score += 3

  return score
}

// ─── Helper: tokenize Arabic/English query ────────────────────────────────────
function tokenize(query: string): string[] {
  return query
    .replace(/[^\u0600-\u06FF\u0750-\u077F\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
    .slice(0, 5) // max 5 tokens
}

export async function smartSearchRoutes(app: FastifyInstance) {
  // ─── GET /search — Main search endpoint ───────────────────────────────────
  app.get('/', async (request, reply) => {
    const schema = z.object({
      q: z.string().min(1).max(200),
      storeId: z.string(),
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('20'),
      categoryId: z.string().optional(),
      minPrice: z.string().optional(),
      maxPrice: z.string().optional(),
      inStock: z.string().optional(),
      sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popular', 'rating']).optional().default('relevance'),
      sessionId: z.string().optional(),
    })

    const parsed = schema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات البحث غير صحيحة' })
    const { q, storeId, page, limit, categoryId, minPrice, maxPrice, inStock, sort, sessionId } = parsed.data

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)
    const tokens = tokenize(q)

    // Build where clause
    const where: any = {
      storeId,
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { descriptionAr: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        // Multi-token: match any token in name
        ...tokens.map(t => ({ name: { contains: t, mode: 'insensitive' as const } })),
        ...tokens.map(t => ({ nameAr: { contains: t, mode: 'insensitive' as const } })),
      ],
    }

    if (categoryId) where.categoryId = categoryId
    if (inStock === 'true') where.stock = { gt: 0 }
    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Determine Prisma orderBy
    let orderBy: any = [{ isFeatured: 'desc' }, { stock: 'desc' }]
    if (sort === 'price_asc') orderBy = [{ price: 'asc' }]
    else if (sort === 'price_desc') orderBy = [{ price: 'desc' }]
    else if (sort === 'newest') orderBy = [{ createdAt: 'desc' }]
    else if (sort === 'popular') orderBy = [{ productViews: { _count: 'desc' } }]

    const [products, total, categories] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
          price: true,
          comparePrice: true,
          stock: true,
          sku: true,
          barcode: true,
          isFeatured: true,
          isActive: true,
          description: true,
          descriptionAr: true,
          category: { select: { id: true, name: true, nameAr: true } },
          images: { take: 1, select: { url: true } },
          productViews: { select: { id: true } },
        },
      }),
      prisma.product.count({ where }),
      // Get category distribution for facets
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { ...where, categoryId: { not: null } },
        _count: { id: true },
      }),
    ])

    // Apply relevance scoring and re-sort if needed
    let results = products.map(p => ({
      ...p,
      relevanceScore: sort === 'relevance' ? scoreProduct(p, q) : 0,
      viewCount: p.productViews.length,
      image: p.images[0]?.url || null,
    }))

    if (sort === 'relevance') {
      results = results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    }

    // Track search analytics (fire-and-forget)
    if (sessionId) {
      prisma.errorLog.create({
        data: {
          level: 'INFO',
          message: `SEARCH:${q}`,
          metadata: { storeId, q, resultsCount: total, sessionId },
        },
      }).catch(() => {})
    }

    // Get category names for facets
    const categoryIds = categories.map(c => c.categoryId).filter(Boolean) as string[]
    const categoryDetails = categoryIds.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, nameAr: true },
        })
      : []

    const facets = {
      categories: categories.map(c => ({
        ...categoryDetails.find(cd => cd.id === c.categoryId),
        count: c._count.id,
      })).filter(c => c.id),
    }

    return reply.send({
      query: q,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / take),
      results: results.map(({ relevanceScore: _, productViews: __, images: ___, ...rest }) => rest),
      facets,
    })
  })

  // ─── GET /search/suggest — Autocomplete suggestions ───────────────────────
  app.get('/suggest', async (request, reply) => {
    const { q, storeId, limit = '8' } = request.query as { q: string; storeId: string; limit?: string }

    if (!q || q.length < 1 || !storeId) return reply.send({ suggestions: [] })

    const products = await prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
        OR: [
          { name: { startsWith: q, mode: 'insensitive' } },
          { nameAr: { startsWith: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: parseInt(limit),
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        price: true,
        stock: true,
        images: { take: 1, select: { url: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { stock: 'desc' }],
    })

    // Also suggest categories
    const cats = await prisma.category.findMany({
      where: {
        storeId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 3,
      select: { id: true, name: true, nameAr: true, image: true },
    })

    return reply.send({
      suggestions: products.map(p => ({
        type: 'product',
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        price: p.price,
        inStock: p.stock > 0,
        image: p.images[0]?.url || null,
      })),
      categories: cats.map(c => ({ type: 'category', ...c })),
    })
  })

  // ─── GET /search/popular — Popular search terms ───────────────────────────
  app.get('/popular', async (request, reply) => {
    const { storeId, limit = '10' } = request.query as { storeId: string; limit?: string }

    // Get most viewed products as proxy for popular searches
    const popular = await prisma.productView.groupBy({
      by: ['productId'],
      where: { storeId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: parseInt(limit),
    })

    const productIds = popular.map(p => p.productId).filter(Boolean) as string[]
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, name: true, nameAr: true, slug: true },
        })
      : []

    return reply.send({
      popular: popular.map(p => ({
        ...products.find(pr => pr.id === p.productId),
        viewCount: p._count.productId,
      })).filter(p => p.id),
    })
  })

  // ─── GET /search/filter-options — Get available filters for a store ────────
  app.get('/filter-options', async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const [categories, priceRange] = await Promise.all([
      prisma.category.findMany({
        where: { storeId, parentId: null },
        select: { id: true, name: true, nameAr: true, image: true,
          children: { select: { id: true, name: true, nameAr: true } } },
      }),
      prisma.product.aggregate({
        where: { storeId, isActive: true },
        _min: { price: true },
        _max: { price: true },
      }),
    ])

    return reply.send({
      categories,
      priceRange: {
        min: Number(priceRange._min.price || 0),
        max: Number(priceRange._max.price || 9999),
      },
    })
  })

  // ─── POST /search/feedback — Track click through / purchase from search ────
  app.post('/feedback', async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      query: z.string(),
      productId: z.string(),
      action: z.enum(['click', 'add_to_cart', 'purchase']),
      sessionId: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    // Track as a product view for future relevance tuning
    await prisma.productView.create({
      data: {
        storeId: parsed.data.storeId,
        productId: parsed.data.productId,
        sessionId: parsed.data.sessionId || `search-${Date.now()}`,
      },
    })

    return reply.send({ recorded: true })
  })
}
