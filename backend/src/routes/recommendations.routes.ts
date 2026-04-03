import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// â”€â”€â”€ AI Recommendations Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Collaborative Filtering + Content-Based + Market Basket Analysis
// No external ML library needed â€” pure SQL-driven ML patterns

// â”€â”€â”€ Helper: cosine similarity between two item vectors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0
  for (const [key, val] of vecA) {
    if (vecB.has(key)) dot += val * vecB.get(key)!
    normA += val * val
  }
  for (const [, val] of vecB) normB += val * val
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// â”€â”€â”€ Helper: time-decay score (more recent = higher weight) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function timeDecay(date: Date, halfLifeDays = 30): number {
  const ageMs = Date.now() - date.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.exp(-ageDays / halfLifeDays)
}

export async function recommendationRoutes(app: FastifyInstance) {
  // POST /recommendations/view â€” Track product view
  app.post('/view', async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      productId: z.string(),
      customerId: z.string().optional(),
      sessionId: z.string(),
      referrer: z.enum(['search', 'category', 'recommendation', 'direct', 'social']).optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'ط¨ظٹط§ظ†ط§طھ ط؛ظٹط± طµط­ظٹط­ط©' })

    const { storeId, productId, customerId, sessionId } = result.data

    await prisma.productView.create({
      data: { storeId, productId, customerId, sessionId },
    })

    return reply.send({ recorded: true })
  })

  // GET /recommendations/also-viewed/:productId â€” Item-based Collaborative Filtering
  app.get('/also-viewed/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const { storeId, limit = '8' } = request.query as { storeId: string; limit?: string }

    // Find sessions that viewed this product
    const sessionsWithProduct = await prisma.productView.findMany({
      where: { productId, storeId },
      select: { sessionId: true },
      distinct: ['sessionId'],
      take: 500,
    })

    const sessionIds = sessionsWithProduct.map(s => s.sessionId).filter((id): id is string => id !== null)
    if (sessionIds.length === 0) return reply.send({ products: [] })

    // Find other products viewed in those sessions with time-weighted scoring
    const otherViews = await prisma.productView.findMany({
      where: {
        sessionId: { in: sessionIds },
        productId: { not: productId },
        storeId,
      },
      select: { productId: true, createdAt: true },
    })

    // Build weighted score map with time decay
    const scoreMap = new Map<string, number>()
    for (const view of otherViews) {
      const decay = timeDecay(new Date(view.createdAt), 14)
      const current = scoreMap.get(view.productId) || 0
      scoreMap.set(view.productId!, current + decay)
    }

    const ranked = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit))
      .map(([pid]) => pid)

    if (ranked.length === 0) return reply.send({ products: [] })

    const products = await prisma.product.findMany({
      where: { id: { in: ranked }, isActive: true, storeId, stock: { gt: 0 } },
      select: {
        id: true, name: true, nameAr: true, price: true, comparePrice: true,
        slug: true, stock: true, images: { take: 1, select: { url: true } },
        category: { select: { name: true, nameAr: true } },
      },
    })

    const sorted = ranked.map(id => products.find(p => p.id === id)).filter(Boolean)
    return reply.send({ products: sorted, algorithm: 'item-based-cf' })
  })

  // GET /recommendations/complete-the-look/:productId â€” Market Basket Analysis
  app.get('/complete-the-look/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const { storeId, limit = '4' } = request.query as { storeId: string; limit?: string }

    // Find orders that contained this product
    const ordersWithProduct = await prisma.orderItem.findMany({
      where: { productId, order: { storeId } },
      select: { orderId: true },
      distinct: ['orderId'],
      take: 500,
    })

    const orderIds = ordersWithProduct.map(o => o.orderId)
    if (orderIds.length === 0) {
      // Fallback: same-category products
      const sourceProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true, price: true },
      })

      if (!sourceProduct?.categoryId) return reply.send({ products: [], algorithm: 'fallback-new' })

      const fallback = await prisma.product.findMany({
        where: {
          storeId, isActive: true, stock: { gt: 0 },
          id: { not: productId },
          categoryId: sourceProduct.categoryId,
          price: {
            gte: Number(sourceProduct.price) * 0.3,
            lte: Number(sourceProduct.price) * 3,
          },
        },
        take: parseInt(limit),
        orderBy: { isFeatured: 'desc' },
        select: {
          id: true, name: true, nameAr: true, price: true, comparePrice: true,
          slug: true, stock: true, images: { take: 1, select: { url: true } },
        },
      })
      return reply.send({ products: fallback, algorithm: 'fallback-category' })
    }

    // Market basket: find co-purchased products with confidence score
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, productId: { not: productId } },
      select: { productId: true, orderId: true },
    })

    // Lift calculation: P(Aâˆ©B) / (P(A) * P(B))
    const totalOrders = await prisma.order.count({ where: { storeId } })
    const coFreqMap = new Map<string, number>()
    const orderSet = new Set<string>()

    for (const item of allItems) {
      coFreqMap.set(item.productId, (coFreqMap.get(item.productId) || 0) + 1)
      orderSet.add(item.orderId)
    }

    // Get individual product frequencies for lift
    const candIds = [...coFreqMap.keys()]
    const indivFreqs = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { productId: { in: candIds }, order: { storeId } },
      _count: { orderId: true },
    })
    const freqMap = new Map(indivFreqs.map(f => [f.productId, f._count.orderId]))
    const sourceFreq = ordersWithProduct.length

    const liftScores = candIds.map(pid => {
      const coFreq = coFreqMap.get(pid) || 0
      const indivFreq = freqMap.get(pid) || 1
      const lift = (coFreq / totalOrders) / ((sourceFreq / totalOrders) * (indivFreq / totalOrders))
      return { pid, lift, coFreq }
    })

    const ranked = liftScores
      .filter(s => s.coFreq >= 2)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, parseInt(limit))
      .map(s => s.pid)

    const products = await prisma.product.findMany({
      where: { id: { in: ranked }, isActive: true, storeId, stock: { gt: 0 } },
      select: {
        id: true, name: true, nameAr: true, price: true, comparePrice: true,
        slug: true, stock: true, images: { take: 1, select: { url: true } },
      },
    })

    const sorted = ranked.map(id => products.find(p => p.id === id)).filter(Boolean)
    return reply.send({ products: sorted, algorithm: 'market-basket-lift' })
  })

  // GET /recommendations/trending/:storeId â€” Time-decayed trending products
  app.get('/trending/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { limit = '10', days = '7' } = request.query as { limit?: string; days?: string }

    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)

    const allViews = await prisma.productView.findMany({
      where: { storeId, createdAt: { gte: since } },
      select: { productId: true, createdAt: true },
    })

    // Time-decay aggregation
    const scoreMap = new Map<string, number>()
    for (const view of allViews) {
      const decay = timeDecay(new Date(view.createdAt), parseInt(days) / 2)
      const current = scoreMap.get(view.productId!) || 0
      scoreMap.set(view.productId!, current + decay)
    }

    const ranked = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit))

    if (ranked.length === 0) {
      // Fallback to newest featured
      const fallback = await prisma.product.findMany({
        where: { storeId, isActive: true, stock: { gt: 0 } },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: parseInt(limit),
        select: {
          id: true, name: true, nameAr: true, price: true, comparePrice: true,
          slug: true, stock: true, images: { take: 1, select: { url: true } },
        },
      })
      return reply.send({ products: fallback, algorithm: 'featured-newest' })
    }

    const productIds = ranked.map(([pid]) => pid)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true, storeId },
      select: {
        id: true, name: true, nameAr: true, price: true, comparePrice: true,
        slug: true, stock: true, images: { take: 1, select: { url: true } },
      },
    })

    const result = ranked.map(([pid, score]) => ({
      ...products.find(p => p.id === pid),
      trendScore: Math.round(score * 100) / 100,
    })).filter(p => (p as any).id)

    return reply.send({ products: result, algorithm: 'time-decayed-views' })
  })

  // GET /recommendations/personalized/:customerId â€” User-based Collaborative Filtering
  app.get('/personalized/:customerId', async (request, reply) => {
    const { customerId } = request.params as { customerId: string }
    const { storeId, limit = '8' } = request.query as { storeId: string; limit?: string }

    if (!storeId) return reply.status(400).send({ error: 'storeId ظ…ط·ظ„ظˆط¨' })

    // Get current customer's view history
    const myViews = await prisma.productView.findMany({
      where: { customerId, storeId },
      select: { productId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const myProductIds = [...new Set(myViews.map(v => v.productId!).filter(Boolean))]

    if (myProductIds.length === 0) {
      // New customer â€” return trending
      const trending = await prisma.product.findMany({
        where: { storeId, isActive: true, stock: { gt: 0 } },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: parseInt(limit),
        select: {
          id: true, name: true, nameAr: true, price: true, comparePrice: true,
          slug: true, stock: true, images: { take: 1, select: { url: true } },
        },
      })
      return reply.send({ products: trending, algorithm: 'new-user-trending' })
    }

    // Build my item vector (productId â†’ weighted view count)
    const myVector = new Map<string, number>()
    for (const v of myViews) {
      const w = timeDecay(new Date(v.createdAt), 30)
      myVector.set(v.productId!, (myVector.get(v.productId!) || 0) + w)
    }

    // Find other customers who viewed similar products (find neighbors)
    const neighbors = await prisma.productView.findMany({
      where: {
        storeId,
        productId: { in: myProductIds },
        AND: [
          { customerId: { not: customerId } },
          { customerId: { not: null } },
        ],
      },
      select: { customerId: true, productId: true, createdAt: true },
      distinct: ['customerId', 'productId'],
      take: 1000,
    })

    // Group by customer and build their vectors
    const customerVectors = new Map<string, Map<string, number>>()
    for (const n of neighbors) {
      if (!n.customerId) continue
      if (!customerVectors.has(n.customerId)) customerVectors.set(n.customerId, new Map())
      const vec = customerVectors.get(n.customerId)!
      const w = timeDecay(new Date(n.createdAt), 30)
      vec.set(n.productId!, (vec.get(n.productId!) || 0) + w)
    }

    // Calculate similarity scores
    const similarities: Array<{ customerId: string; similarity: number }> = []
    for (const [cid, vec] of customerVectors) {
      const sim = cosineSimilarity(myVector, vec)
      if (sim > 0.1) similarities.push({ customerId: cid, similarity: sim })
    }

    similarities.sort((a, b) => b.similarity - a.similarity)
    const topNeighbors = similarities.slice(0, 20).map(s => s.customerId)

    if (topNeighbors.length === 0) {
      // Fallback to category-based
      const myCategories = await prisma.product.findMany({
        where: { id: { in: myProductIds } },
        select: { categoryId: true },
      })
      const catIds = [...new Set(myCategories.map(p => p.categoryId).filter(Boolean))] as string[]

      const catBased = await prisma.product.findMany({
        where: {
          storeId, isActive: true, stock: { gt: 0 },
          id: { notIn: myProductIds },
          categoryId: catIds.length > 0 ? { in: catIds } : undefined,
        },
        orderBy: [{ isFeatured: 'desc' }],
        take: parseInt(limit),
        select: {
          id: true, name: true, nameAr: true, price: true, comparePrice: true,
          slug: true, stock: true, images: { take: 1, select: { url: true } },
        },
      })
      return reply.send({ products: catBased, algorithm: 'content-based-category' })
    }

    // Get products viewed by neighbors but not by me
    const neighborViews = await prisma.productView.findMany({
      where: {
        customerId: { in: topNeighbors },
        productId: { notIn: myProductIds },
        storeId,
      },
      select: { productId: true, customerId: true },
    })

    // Weight neighbor products by neighbor similarity
    const recScores = new Map<string, number>()
    for (const v of neighborViews) {
      const sim = similarities.find(s => s.customerId === v.customerId)?.similarity || 0
      recScores.set(v.productId!, (recScores.get(v.productId!) || 0) + sim)
    }

    const rankedPids = [...recScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit))
      .map(([pid]) => pid)

    const products = await prisma.product.findMany({
      where: { id: { in: rankedPids }, isActive: true, storeId, stock: { gt: 0 } },
      select: {
        id: true, name: true, nameAr: true, price: true, comparePrice: true,
        slug: true, stock: true, images: { take: 1, select: { url: true } },
      },
    })

    const sorted = rankedPids.map(pid => products.find(p => p.id === pid)).filter(Boolean)
    return reply.send({ products: sorted, algorithm: 'user-based-cf' })
  })

  // GET /recommendations/new-arrivals/:storeId â€” New products user might like
  app.get('/new-arrivals/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { limit = '8', customerId } = request.query as { limit?: string; customerId?: string }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const where: any = { storeId, isActive: true, stock: { gt: 0 }, createdAt: { gte: since } }

    if (customerId) {
      // Filter by customer's preferred categories
      const purchasedItems = await prisma.orderItem.findMany({
        where: { order: { customerId, storeId } },
        select: { product: { select: { categoryId: true } } },
        take: 20,
      })
      const preferredCats = [...new Set(purchasedItems.map(i => i.product?.categoryId).filter(Boolean))]
      if (preferredCats.length > 0) where.categoryId = { in: preferredCats }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      select: {
        id: true, name: true, nameAr: true, price: true, comparePrice: true,
        slug: true, stock: true, createdAt: true,
        images: { take: 1, select: { url: true } },
      },
    })

    return reply.send({ products, algorithm: 'new-arrivals' })
  })

  // GET /recommendations/frequently-bought-together/:productId â€” FBT bundle suggestions
  app.get('/frequently-bought-together/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const { storeId, limit = '3' } = request.query as { storeId: string; limit?: string }

    const ordersWithProduct = await prisma.orderItem.findMany({
      where: { productId, order: { storeId } },
      select: { orderId: true },
      distinct: ['orderId'],
      take: 200,
    })

    const orderIds = ordersWithProduct.map(o => o.orderId)
    if (orderIds.length < 3) return reply.send({ products: [], bundleDiscount: 0 })

    const coItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { orderId: { in: orderIds }, productId: { not: productId } },
      _count: { orderId: true },
      orderBy: { _count: { orderId: 'desc' } },
      take: parseInt(limit),
    })

    const candidateIds = coItems.map(c => c.productId).filter(Boolean) as string[]
    const products = await prisma.product.findMany({
      where: { id: { in: candidateIds }, isActive: true, storeId, stock: { gt: 0 } },
      select: {
        id: true, name: true, nameAr: true, price: true, comparePrice: true,
        slug: true, stock: true, images: { take: 1, select: { url: true } },
      },
    })

    const sourceProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, nameAr: true, price: true, slug: true, images: { take: 1, select: { url: true } } },
    })

    const bundle = [sourceProduct, ...candidateIds.map(id => products.find(p => p.id === id)).filter(Boolean)]
    const bundleTotal = bundle.reduce((sum, p: any) => sum + Number(p?.price || 0), 0)

    return reply.send({
      products: bundle.filter(Boolean),
      bundleTotal,
      bundleDiscount: 0.1, // suggest 10% off for the bundle
      algorithm: 'frequently-bought-together',
    })
  })

  // GET /recommendations/settings/:storeId â€” Admin: recommendation settings
  app.get('/settings/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'ط؛ظٹط± ظ…طµط±ط­' })

    return reply.send({
      algorithms: {
        alsoViewed: { enabled: true, algorithm: 'item-based-cf', minDataPoints: 10 },
        completeTheLook: { enabled: true, algorithm: 'market-basket-lift', minOrders: 3 },
        trending: { enabled: true, algorithm: 'time-decayed-views', halfLifeDays: 7 },
        personalized: { enabled: true, algorithm: 'user-based-cf', minHistory: 5 },
        newArrivals: { enabled: true, algorithm: 'category-preference', lookbackDays: 30 },
        fbt: { enabled: true, algorithm: 'frequently-bought-together', bundleDiscount: 0.10 },
      },
      widgetPositions: ['product-page', 'cart-page', 'checkout-page', 'homepage', 'category-page'],
    })
  })
}
