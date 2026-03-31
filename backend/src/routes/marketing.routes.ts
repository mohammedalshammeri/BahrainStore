import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function marketingRoutes(app: FastifyInstance) {

  // Get marketing settings (pixels)
  app.get('/pixels', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, include: { settings: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const s = store.settings
    return reply.send({
      googleTagId: s?.googleTagId ?? null,
      facebookPixelId: s?.facebookPixelId ?? null,
      tiktokPixelId: s?.tiktokPixelId ?? null,
      snapchatPixelId: s?.snapchatPixelId ?? null,
      googleAdsId: s?.googleAdsId ?? null,
    })
  })

  // Save marketing settings (pixels)
  app.put('/pixels', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      googleTagId: z.string().optional().nullable(),
      facebookPixelId: z.string().optional().nullable(),
      tiktokPixelId: z.string().optional().nullable(),
      snapchatPixelId: z.string().optional().nullable(),
      googleAdsId: z.string().optional().nullable(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, ...pixels } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.storeSettings.upsert({
      where: { storeId },
      update: pixels,
      create: { storeId, ...pixels },
    })
    return reply.send({ message: 'تم حفظ إعدادات التسويق' })
  })

  // Public: get pixels for storefront (to inject into page head)
  app.get('/public/:storeSlug/pixels', async (request, reply) => {
    const { storeSlug } = request.params as { storeSlug: string }
    const store = await prisma.store.findUnique({
      where: { subdomain: storeSlug },
      include: { settings: { select: {
        googleTagId: true, facebookPixelId: true,
        tiktokPixelId: true, snapchatPixelId: true, googleAdsId: true,
      } } },
    })
    if (!store) return reply.status(404).send({ error: 'المتجر غير موجود' })
    return reply.send({ pixels: store.settings ?? {} })
  })
}
