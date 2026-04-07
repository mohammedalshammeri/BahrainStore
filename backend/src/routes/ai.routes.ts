import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AI_MODEL, aiErrorReply, buildAICapabilities, callOpenAI, getAICapabilityState } from '../lib/ai-provider'
import { prisma } from '../lib/prisma'
import { findMerchantOrder, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

// ─── Bazar AI Layer ───────────────────────────────────────────────────────────
// AI Product Writer + Merchant Copilot + Price Suggestion + Fraud Detection
// Uses OpenAI API (GPT-4o). Set OPENAI_API_KEY in .env

// ─── Fraud Score Calculator (rule-based) ─────────────────────────────────────
function calculateFraudScore(order: any): { score: number; flags: string[]; risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  let score = 0
  const flags: string[] = []

  const total = Number(order.total || 0)
  const previousOrders = Number(order._count?.orders || 0)
  const shippingAddress = order.shippingAddress || {}
  const billingAddress = order.billingAddress || {}
  const customer = order.customer || {}

  // Large order from new customer
  if (total > 500 && previousOrders === 0) { score += 30; flags.push('طلب كبير من عميل جديد') }
  else if (total > 200 && previousOrders === 0) { score += 15; flags.push('طلب متوسط من عميل جديد') }

  // Email from free provider + high value
  const email = (customer.email || '').toLowerCase()
  const freeProviders = ['tempmail', 'guerrilla', 'throwam', 'mailnull', 'spamgourmet']
  if (freeProviders.some((p) => email.includes(p)) && total > 100) { score += 25; flags.push('بريد مؤقت مع قيمة عالية') }

  // Address mismatch indicators
  if (shippingAddress.country && billingAddress.country && shippingAddress.country !== billingAddress.country) {
    score += 20; flags.push('بلد الشحن مختلف عن بلد الفاتورة')
  }

  // Multiple orders in short time
  if (order._recentOrderCount > 3) { score += 25; flags.push('طلبات متعددة في وقت قصير') }

  // Suspicious order patterns
  if (order.items?.length > 20) { score += 15; flags.push('عدد كبير من المنتجات') }

  // No phone number
  if (!customer.phone && total > 100) { score += 10; flags.push('لا يوجد رقم هاتف') }

  const risk = score >= 70 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW'
  return { score, flags, risk }
}

export async function aiRoutes(app: FastifyInstance) {
  app.get('/capabilities', { preHandler: authenticate }, async (_request, reply) => {
    return reply.send(buildAICapabilities({
      onboardingAssistant: { label: 'المساعد الذكي للإعداد' },
      importMapping: { label: 'المطابقة الذكية لملفات الاستيراد' },
    }))
  })

  // ─── POST /ai/product-writer ─────────────────────────────────────────────
  // Generate product name, description, SEO keywords with AI
  app.post('/product-writer', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      productName: z.string().min(2).max(200),
      category: z.string().optional(),
      price: z.number().optional(),
      features: z.array(z.string()).optional(),
      language: z.enum(['ar', 'en', 'both']).default('both'),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    const { storeId, productName, category, price, features, language } = parsed.data
    const merchantId = (request.user as any).id

    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true, nameAr: true } })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const featuresText = features?.length ? `المميزات: ${features.join('، ')}` : ''
    const priceText = price ? `السعر: ${price} BHD` : ''
    const catText = category ? `التصنيف: ${category}` : ''

    const systemPrompt = `أنت كاتب محتوى تسويقي متخصص في التجارة الإلكترونية الخليجية. تكتب محتوى مقنع وجذاب يزيد المبيعات. اكتب بأسلوب احترافي ومقنع.`

    const userPrompt = language === 'ar'
      ? `اكتب وصفاً تسويقياً للمنتج التالي:\nاسم المنتج: ${productName}\n${catText}\n${priceText}\n${featuresText}\n\nالمطلوب:\n1. وصف قصير (50 كلمة)\n2. وصف تفصيلي (150 كلمة)\n3. نقاط بيع رئيسية (5 نقاط)\n4. كلمات مفتاحية للـ SEO (10 كلمات)\n\nرد بـ JSON: { shortDescription, longDescription, bulletPoints, seoKeywords }`
      : language === 'en'
        ? `Write marketing copy for this product:\nProduct name: ${productName}\n${catText}\n${priceText}\n${featuresText}\n\nRequired:\n1. Short description (50 words)\n2. Long description (150 words)\n3. Key selling points (5 bullets)\n4. SEO keywords (10 keywords)\n\nReply with JSON: { shortDescription, longDescription, bulletPoints, seoKeywords }`
        : `اكتب محتوى تسويقياً للمنتج بالعربي والإنجليزي:\nاسم المنتج: ${productName}\n${catText}\n${priceText}\n${featuresText}\n\nالمطلوب بالعربي والإنجليزي:\n1. وصف قصير\n2. وصف تفصيلي\n3. نقاط البيع\n4. كلمات SEO\n\nرد بـ JSON: { ar: { shortDescription, longDescription, bulletPoints, seoKeywords }, en: { shortDescription, longDescription, bulletPoints, seoKeywords } }`

    try {
      const aiResponse = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 'gpt-4o', 1500)

      // Try parse JSON from response
      let result: any = {}
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) result = JSON.parse(jsonMatch[0])
        else result = { raw: aiResponse }
      } catch {
        result = { raw: aiResponse }
      }

      return reply.send({ success: true, data: result, model: AI_MODEL, capabilityStatus: getAICapabilityState() })
    } catch (err: any) {
      return aiErrorReply(reply, err, 'فشل توليد المحتوى')
    }
  })

  // ─── POST /ai/copilot ─────────────────────────────────────────────────────
  // Merchant AI assistant chat (Arabic + English)
  app.post('/copilot', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      message: z.string().min(1).max(2000),
      sessionId: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, message } = parsed.data
    const merchantId = (request.user as any).id

    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    // Fetch store context for AI
    const [store, stats] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true, nameAr: true, currency: true },
      }),
      prisma.order.aggregate({
        where: { storeId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        _sum: { total: true },
        _count: { id: true },
      }),
    ])

    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    // Fetch last 10 chat history for context
    const chatHistory = await prisma.aiChat.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, message: true },
    })

    // Save user message
    await prisma.aiChat.create({ data: { storeId, role: 'merchant', message } })

    const contextPrompt = `أنت "بازار كوبايلوت" - مساعد التاجر الذكي لمنصة بازار للتجارة الإلكترونية.
متجر التاجر: ${store.nameAr || store.name}
الإحصائيات (30 يوم): الإيرادات ${Number(stats._sum.total || 0).toFixed(3)} ${store.currency}، الطلبات: ${stats._count.id}
تحدث بالعربي إذا سألك بالعربي، وبالإنجليزي إذا سألك بالإنجليزي.
أجب بشكل موجز ومفيد. قدم توصيات عملية قابلة للتنفيذ.`

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: contextPrompt },
      ...chatHistory.reverse().map((h) => ({ role: h.role === 'merchant' ? 'user' as const : 'assistant' as const, content: h.message })),
      { role: 'user', content: message },
    ]

    try {
      const response = await callOpenAI(messages, 'gpt-4o', 800)

      // Save assistant response
      await prisma.aiChat.create({ data: { storeId, role: 'assistant', message: response } })

      return reply.send({ success: true, response, model: AI_MODEL, capabilityStatus: getAICapabilityState() })
    } catch (err: any) {
      return aiErrorReply(reply, err, 'فشل المساعد الذكي')
    }
  })

  // ─── GET /ai/copilot/history ──────────────────────────────────────────────
  app.get('/copilot/history', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, limit = '50' } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    const history = await prisma.aiChat.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit),
    })
    return reply.send({ history })
  })

  // ─── DELETE /ai/copilot/history ───────────────────────────────────────────
  app.delete('/copilot/history', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.aiChat.deleteMany({ where: { storeId } })
    return reply.send({ success: true })
  })

  // ─── POST /ai/price-suggestion ────────────────────────────────────────────
  // Suggest optimal price based on competitors + category
  app.post('/price-suggestion', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      productName: z.string(),
      category: z.string().optional(),
      costPrice: z.number().optional(),
      currentPrice: z.number().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    const { storeId, productName, category, costPrice, currentPrice } = parsed.data
    const merchantId = (request.user as any).id

    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    // Get similar products in the store for context
    const similar = await prisma.product.findMany({
      where: {
        storeId,
        OR: [
          { name: { contains: productName.split(' ')[0], mode: 'insensitive' } },
          ...(category ? [{ name: { contains: category, mode: 'insensitive' as const } }] : []),
        ],
        isActive: true,
      },
      select: { name: true, price: true, stock: true },
      take: 10,
    })

    const similarPrices = similar.map((p) => Number(p.price))
    const avgPrice = similarPrices.length > 0 ? similarPrices.reduce((a, b) => a + b, 0) / similarPrices.length : null

    const prompt = `أنت خبير تسعير للتجارة الإلكترونية في الخليج.
المنتج: ${productName}
${category ? `التصنيف: ${category}` : ''}
${costPrice ? `تكلفة المنتج: ${costPrice} BHD` : ''}
${currentPrice ? `السعر الحالي: ${currentPrice} BHD` : ''}
${avgPrice ? `متوسط أسعار المنتجات المشابهة في المتجر: ${avgPrice.toFixed(3)} BHD` : ''}

اقترح السعر الأمثل. رد بـ JSON: { suggestedPrice, minPrice, maxPrice, marginPercent, reasoning, competitivePosition }`

    try {
      const aiResponse = await callOpenAI([{ role: 'user', content: prompt }], 'gpt-4o', 300)

      let result: any = {}
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) result = JSON.parse(jsonMatch[0])
        else result = { suggestedPrice: avgPrice || currentPrice || 0, reasoning: aiResponse }
      } catch {
        result = { suggestedPrice: avgPrice || currentPrice || 0, raw: aiResponse }
      }

      return reply.send({ success: true, data: result, similarProducts: similar.length, capabilityStatus: getAICapabilityState() })
    } catch (err: any) {
      return aiErrorReply(reply, err, 'فشل اقتراح السعر')
    }
  })

  // ─── POST /ai/fraud-detection ─────────────────────────────────────────────
  // Real-time order fraud scoring
  app.post('/fraud-detection', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string().cuid(),
      storeId: z.string(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    const { orderId, storeId } = parsed.data

    const merchantId = (request.user as any).id
    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    const ownedOrder = await findMerchantOrder(merchantId, orderId)
    if (!ownedOrder || ownedOrder.storeId !== storeId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: {
          select: {
            email: true, phone: true, firstName: true, lastName: true,
            _count: { select: { orders: true } },
          },
        },
        items: { select: { quantity: true, price: true } },
      },
    })

    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    // Count recent orders from same IP or email
    const recentOrderCount = await prisma.order.count({
      where: {
        storeId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
        customerId: order.customerId || undefined,
      },
    })

    const orderWithContext = { ...order, _recentOrderCount: recentOrderCount }
    const result = calculateFraudScore(orderWithContext)

    // Store fraud score in order metadata (update notes field)
    if (result.risk === 'HIGH' || result.risk === 'CRITICAL') {
      await prisma.order.update({
        where: { id: orderId },
        data: { notes: `[FRAUD_SCORE: ${result.score}] ${result.flags.join(', ')} | ${order.notes || ''}`.trim() },
      })
    }

    return reply.send({
      orderId,
      fraudScore: result.score,
      riskLevel: result.risk,
      flags: result.flags,
      recommendation: result.risk === 'CRITICAL' ? 'احجب الطلب فوراً'
        : result.risk === 'HIGH' ? 'راجع الطلب يدوياً قبل الشحن'
        : result.risk === 'MEDIUM' ? 'تحقق من تفاصيل العميل'
        : 'الطلب يبدو آمناً',
    })
  })

  // ─── POST /ai/analyze-store ───────────────────────────────────────────────
  // Deep AI analysis of store performance with actionable recommendations
  app.post('/analyze-store', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ storeId: z.string() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    const { storeId } = parsed.data
    const merchantId = (request.user as any).id

    const ownedStore = await findMerchantStore(merchantId, storeId)
    if (!ownedStore) return reply.status(403).send({ error: 'غير مصرح' })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const [store, currentOrders, prevOrders, products, lowStockProducts, topProducts] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId }, select: { name: true, nameAr: true, currency: true, plan: true } }),
      prisma.order.aggregate({ where: { storeId, createdAt: { gte: thirtyDaysAgo }, paymentStatus: 'PAID' }, _sum: { total: true }, _count: { id: true } }),
      prisma.order.aggregate({ where: { storeId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, paymentStatus: 'PAID' }, _sum: { total: true }, _count: { id: true } }),
      prisma.product.count({ where: { storeId, isActive: true } }),
      prisma.product.count({ where: { storeId, stock: { lte: 5 }, isActive: true } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { storeId, createdAt: { gte: thirtyDaysAgo } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ])

    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const revenue = Number(currentOrders._sum.total || 0)
    const prevRevenue = Number(prevOrders._sum.total || 0)
    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null
    const ordersCount = currentOrders._count.id
    const avgOrderValue = ordersCount > 0 ? (revenue / ordersCount).toFixed(3) : '0'

    const prompt = `أنت مستشار نمو لمتاجر التجارة الإلكترونية الخليجية.
بيانات المتجر (30 يوم الأخيرة):
- الإيرادات: ${revenue.toFixed(3)} BHD
- نمو الإيرادات: ${revenueGrowth ? revenueGrowth + '%' : 'لا يوجد بيانات سابقة'}
- عدد الطلبات: ${ordersCount}
- متوسط قيمة الطلب: ${avgOrderValue} BHD
- المنتجات النشطة: ${products}
- منتجات مخزونها منخفض: ${lowStockProducts}

قدم تحليلاً موجزاً (200 كلمة) وأهم 5 توصيات عملية لزيادة المبيعات.
رد بـ JSON: { summary, insights: [{ title, description, priority, impact }] }`

    try {
      const aiResponse = await callOpenAI([{ role: 'user', content: prompt }], 'gpt-4o', 1000)
      let result: any = {}
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) result = JSON.parse(jsonMatch[0])
        else result = { summary: aiResponse, insights: [] }
      } catch {
        result = { summary: aiResponse, insights: [] }
      }

      return reply.send({
        storeId,
        period: '30 days',
        metrics: { revenue, revenueGrowth, ordersCount, avgOrderValue, products, lowStockProducts },
        analysis: result,
        capabilityStatus: getAICapabilityState(),
      })
    } catch (err: any) {
      return aiErrorReply(reply, err, 'فشل تحليل المتجر')
    }
  })

  // ─── GET /ai/copilot/suggestions ─────────────────────────────────────────
  // Return suggested questions for the copilot
  app.get('/copilot/suggestions', { preHandler: authenticate }, async (_request, reply) => {
    const suggestions = [
      { id: 1, text: 'لماذا انخفضت مبيعاتي هذا الأسبوع؟', category: 'analytics' },
      { id: 2, text: 'أخبرني أفضل وقت لعمل عرض', category: 'marketing' },
      { id: 3, text: 'اقترح لي منتجات مكملة لأضيفها', category: 'products' },
      { id: 4, text: 'اكتب لي رسالة واتساب لعميل مهجور', category: 'marketing' },
      { id: 5, text: 'ما هي أفضل طريقة لتسعير منتجاتي؟', category: 'pricing' },
      { id: 6, text: 'كيف أزيد معدل تحويل زوار متجري؟', category: 'conversion' },
      { id: 7, text: 'ما هي المنتجات التي يجب أن أعيد طلبها الآن؟', category: 'inventory' },
      { id: 8, text: 'اقترح اسم وتصميم حملة رمضان', category: 'seasonal' },
    ]
    return reply.send({ suggestions })
  })
}
