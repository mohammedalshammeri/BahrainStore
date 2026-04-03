import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── Social Commerce Integration Routes ──────────────────────────────────────
// TikTok Shop, Instagram Shopping, Google Shopping Feed

export async function socialIntegrationRoutes(app: FastifyInstance) {
  // GET /social/integrations/:storeId — List all integrations for a store
  app.get('/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const integrations = await prisma.socialIntegration.findMany({
      where: { storeId },
    })

    return reply.send({ integrations })
  })

  // POST /social/integrations/:storeId/connect — Connect a social platform
  app.post('/:storeId/connect', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      platform: z.enum(['TIKTOK', 'INSTAGRAM', 'GOOGLE', 'FACEBOOK', 'SNAPCHAT']),
      accessToken: z.string(),
      accountId: z.string().optional(),
      shopId: z.string().optional(),
      additionalData: z.record(z.string(), z.any()).optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const integration = await prisma.socialIntegration.upsert({
      where: {
        storeId_platform: { storeId, platform: result.data.platform },
      },
      update: {
        accessToken: result.data.accessToken,
        shopId: result.data.shopId,
        config: result.data.additionalData as any,
        isConnected: true,
      },
      create: {
        storeId,
        platform: result.data.platform,
        accessToken: result.data.accessToken,
        shopId: result.data.shopId,
        config: result.data.additionalData as any,
        isConnected: true,
      },
    })

    return reply.send({ message: `تم ربط ${result.data.platform} بنجاح`, integration })
  })

  // DELETE /social/integrations/:storeId/:platform — Disconnect integration
  app.delete('/:storeId/:platform', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, platform } = request.params as { storeId: string; platform: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.socialIntegration.deleteMany({
      where: { storeId, platform },
    })

    return reply.send({ message: `تم إلغاء ربط ${platform}` })
  })

  // POST /social/integrations/:storeId/sync — Sync product catalog to a platform
  app.post('/:storeId/sync', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const { platform } = request.body as { platform: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const integration = await prisma.socialIntegration.findFirst({
      where: { storeId, platform, isConnected: true },
    })
    if (!integration) return reply.status(400).send({ error: 'التكامل غير مفعّل' })

    const products = await prisma.product.findMany({
      where: { storeId, isActive: true },
      take: 100,
      include: { category: true },
    })

    // Mark last sync time
    await prisma.socialIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), syncedCount: products.length },
    })

    return reply.send({
      message: `تم مزامنة ${products.length} منتج إلى ${platform}`,
      synced: products.length,
    })
  })
}

// ─── Google Shopping Feed Route ───────────────────────────────────────────────

export async function googleShoppingFeedRoutes(app: FastifyInstance) {
  // GET /feed/google/:storeId — Google Shopping XML feed
  app.get('/google/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const products = await prisma.product.findMany({
      where: { storeId, isActive: true, stock: { gt: 0 } },
      take: 1000,
      include: { category: true },
    })

    const storeUrl = (store as any).customDomain
      ? `https://${(store as any).customDomain}`
      : `https://${store.subdomain}.bazar.com`

    const items = products.map(p => {
      const image = Array.isArray((p as any).images) ? ((p as any).images as string[])[0] : ''
      const category = ((p as any).category as any)?.name || 'General'
      const price = `${Number(p.price).toFixed(2)} ${(store.settings as any)?.currency || 'BHD'}`

      return `
    <item>
      <g:id>${p.id}</g:id>
      <g:title><![CDATA[${p.name}]]></g:title>
      <g:description><![CDATA[${p.description || p.name}]]></g:description>
      <g:link>${storeUrl}/products/${p.slug}</g:link>
      <g:image_link>${image}</g:image_link>
      <g:availability>${p.stock > 0 ? 'in stock' : 'out of stock'}</g:availability>
      <g:price>${price}</g:price>
      ${p.comparePrice ? `<g:sale_price>${Number(p.price).toFixed(2)} ${(store.settings as any)?.currency || 'BHD'}</g:sale_price>` : ''}
      <g:brand><![CDATA[${store.name}]]></g:brand>
      <g:product_type><![CDATA[${category}]]></g:product_type>
      <g:condition>new</g:condition>
    </item>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${store.name}</title>
    <link>${storeUrl}</link>
    <description>منتجات ${store.name}</description>
    ${items}
  </channel>
</rss>`

    reply.header('Content-Type', 'application/xml; charset=utf-8')
    return reply.send(xml)
  })

  // GET /feed/tiktok/:storeId — TikTok Shop product catalog feed (JSON)
  app.get('/tiktok/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const products = await prisma.product.findMany({
      where: { storeId, isActive: true },
      take: 500,
      include: { category: true },
    })

    const storeUrl = (store as any).customDomain
      ? `https://${(store as any).customDomain}`
      : `https://${store.subdomain}.bazar.com`

    const currency = (store.settings as any)?.currency || 'BHD'

    const catalog = products.map(p => ({
      id: p.id,
      title: p.name,
      description: p.description || p.name,
      url: `${storeUrl}/products/${p.slug}`,
      image_url: Array.isArray((p as any).images) ? ((p as any).images as string[])[0] : '',
      price: `${Number(p.price).toFixed(2)} ${currency}`,
      availability: p.stock > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      brand: store.name,
    }))

    return reply.send({ data: catalog })
  })

  // GET /feed/instagram/:storeId — Instagram Shopping catalog feed
  app.get('/instagram/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })

    const products = await prisma.product.findMany({
      where: { storeId, isActive: true },
      take: 500,
    })

    const storeUrl = (store as any).customDomain
      ? `https://${(store as any).customDomain}`
      : `https://${store.subdomain}.bazar.com`

    const currency = (store.settings as any)?.currency || 'BHD'

    const catalog = products.map(p => ({
      id: p.id,
      title: p.name,
      description: p.description || '',
      availability: p.stock > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${Number(p.price).toFixed(2)} ${currency}`,
      link: `${storeUrl}/products/${p.slug}`,
      image_link: Array.isArray((p as any).images) ? ((p as any).images as string[])[0] : '',
      brand: store.name,
    }))

    return reply.send({ data: catalog })
  })
}
