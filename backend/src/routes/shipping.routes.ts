import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { trackAramexShipment } from '../lib/aramex'
import { trackDhlShipment } from '../lib/dhl'
import { findMerchantOrder, findMerchantShipmentTracking, findMerchantShipmentTrackingByNumber, findMerchantShippingRate, findMerchantShippingZone, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate } from '../middleware/auth.middleware'

// ─── Shipping Zones, Rates & Carrier Integration Routes ──────────────────────

export async function shippingRoutes(app: FastifyInstance) {
  async function validateOperationalRateProvider(storeId: string, provider: string) {
    const normalizedProvider = provider.trim().toUpperCase()

    if (normalizedProvider === 'MANUAL') {
      return null
    }

    if (normalizedProvider === 'ARAMEX') {
      const settings = await prisma.storeSettings.findUnique({
        where: { storeId },
        select: {
          aramexEnabled: true,
          aramexUser: true,
          aramexPassword: true,
          aramexAccountNumber: true,
          aramexPinCode: true,
        },
      })

      if (!settings?.aramexEnabled || !settings.aramexUser || !settings.aramexPassword || !settings.aramexAccountNumber || !settings.aramexPinCode) {
        return 'Aramex غير مفعّل أو إعداداته ناقصة في هذا المتجر.'
      }

      return null
    }

    if (normalizedProvider === 'DHL') {
      const settings = await prisma.storeSettings.findUnique({
        where: { storeId },
        select: {
          dhlEnabled: true,
          dhlApiKey: true,
          dhlAccountNumber: true,
        },
      })

      if (!settings?.dhlEnabled || !settings.dhlApiKey || !settings.dhlAccountNumber) {
        return 'DHL غير مفعّل أو إعداداته ناقصة في هذا المتجر.'
      }

      return null
    }

    return 'مزود الشحن غير مدعوم حالياً.'
  }

  // ── Shipping Zones ──────────────────────────────────────────────────────────

  // GET /shipping/zones — List store's shipping zones
  app.get('/zones', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const zones = await prisma.shippingZone.findMany({
      where: { storeId },
      include: { rates: true },
      orderBy: { name: 'asc' },
    })

    return reply.send({ zones })
  })

  // POST /shipping/zones — Create shipping zone
  app.post('/zones', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      name: z.string(),
      nameAr: z.string().default(''),
      countries: z.array(z.string()),
      cities: z.array(z.string()).optional().default([]),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const store = await findMerchantStore(merchantId, result.data.storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const zone = await prisma.shippingZone.create({ data: result.data })
    return reply.status(201).send({ message: 'تم إنشاء المنطقة', zone })
  })

  // PUT /shipping/zones/:id — Update shipping zone
  app.put('/zones/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const zone = await findMerchantShippingZone(merchantId, id)
    if (!zone) return reply.status(404).send({ error: 'المنطقة غير موجودة' })

    const updated = await prisma.shippingZone.update({
      where: { id },
      data: request.body as any,
    })
    return reply.send({ message: 'تم التحديث', zone: updated })
  })

  // DELETE /shipping/zones/:id — Delete shipping zone
  app.delete('/zones/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const zone = await findMerchantShippingZone(merchantId, id)
    if (!zone) return reply.status(404).send({ error: 'المنطقة غير موجودة' })

    await prisma.shippingZone.delete({ where: { id } })
    return reply.send({ message: 'تم حذف المنطقة' })
  })

  // ── Shipping Rates ──────────────────────────────────────────────────────────

  // POST /shipping/rates — Add rate to zone
  app.post('/rates', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      zoneId: z.string(),
      name: z.string(),
      nameAr: z.string().default(''),
      provider: z.string().default('MANUAL'),
      minWeight: z.number().optional(),
      maxWeight: z.number().optional(),
      minOrderValue: z.number().optional(),
      price: z.number(),
      estimatedDays: z.number().default(3),
      isFree: z.boolean().default(false),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const zone = await findMerchantShippingZone(merchantId, result.data.zoneId)
    if (!zone) return reply.status(403).send({ error: 'غير مصرح' })

    const providerError = await validateOperationalRateProvider(zone.storeId, result.data.provider)
    if (providerError) return reply.status(400).send({ error: providerError })

    const rate = await prisma.shippingRate.create({ data: result.data })
    return reply.status(201).send({ message: 'تم إضافة السعر', rate })
  })

  // PUT /shipping/rates/:id — Update rate
  app.put('/rates/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const rate = await findMerchantShippingRate(merchantId, id)
    if (!rate) return reply.status(403).send({ error: 'غير مصرح' })

    const nextProvider = typeof (request.body as any)?.provider === 'string'
      ? (request.body as any).provider
      : undefined

    if (nextProvider) {
      const providerError = await validateOperationalRateProvider(rate.zone.storeId, nextProvider)
      if (providerError) return reply.status(400).send({ error: providerError })
    }

    const updated = await prisma.shippingRate.update({
      where: { id },
      data: request.body as any,
    })
    return reply.send({ rate: updated })
  })

  // DELETE /shipping/rates/:id — Delete rate
  app.delete('/rates/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const merchantId = (request.user as any).id
    const rate = await findMerchantShippingRate(merchantId, id)
    if (!rate) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.shippingRate.delete({ where: { id } })
    return reply.send({ message: 'تم الحذف' })
  })

  // POST /shipping/calculate — Calculate shipping cost for an order
  app.post('/calculate', async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      country: z.string(),
      city: z.string().optional(),
      orderValue: z.number(),
      totalWeight: z.number().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, country, city, orderValue, totalWeight = 0 } = result.data

    // Find matching zones
    const normalizedCity = city?.trim().toLowerCase()
    const zones = await prisma.shippingZone.findMany({
      where: {
        storeId,
        isActive: true,
        OR: [
          { countries: { has: country } },
          { countries: { has: 'ALL' } },
        ],
      },
      include: { rates: { where: { isActive: true } } },
    })

    const availableRates: any[] = []

    for (const zone of zones) {
      const zoneCities = Array.isArray(zone.cities) ? zone.cities : []
      const cityMatches =
        zoneCities.length === 0 ||
        !normalizedCity ||
        zoneCities.some((entry) => entry.trim().toLowerCase() === normalizedCity || entry.trim().toUpperCase() === 'ALL')

      if (!cityMatches) {
        continue
      }

      for (const rate of zone.rates) {
        const w = totalWeight
        const minW = rate.minWeight ? Number(rate.minWeight) : 0
        const maxW = rate.maxWeight ? Number(rate.maxWeight) : Infinity
        const minOrderValue = rate.minOrderValue ? Number(rate.minOrderValue) : 0

        if (orderValue < minOrderValue) {
          continue
        }

        if (w >= minW && w <= maxW) {
          availableRates.push({
            ...rate,
            finalPrice: rate.isFree ? 0 : Number(rate.price),
            zoneName: zone.name,
            zoneNameAr: zone.nameAr,
          })
        }
      }
    }

    availableRates.sort((a, b) => a.finalPrice - b.finalPrice)

    return reply.send({ rates: availableRates })
  })

  // ── Shipment Tracking ───────────────────────────────────────────────────────

  // POST /shipping/track — Create tracking record
  app.post('/track', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string(),
      trackingNumber: z.string(),
      provider: z.string(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const ownedOrder = await findMerchantOrder(merchantId, result.data.orderId)
    if (!ownedOrder) return reply.status(403).send({ error: 'غير مصرح' })

    const tracking = await prisma.shipmentTracking.create({ data: result.data })
    return reply.status(201).send({ message: 'تم إضافة معلومات الشحن', tracking })
  })

  // GET /shipping/track/:trackingNumber — Get live tracking from carrier
  app.get('/track/:trackingNumber', { preHandler: authenticate }, async (request, reply) => {
    const { trackingNumber } = request.params as { trackingNumber: string }
    const merchantId = (request.user as any).id

    const tracking = await findMerchantShipmentTrackingByNumber(merchantId, trackingNumber)
    if (!tracking) {
      return reply.status(404).send({ error: 'الشحنة غير موجودة' })
    }

    const order = await prisma.order.findFirst({
      where: { id: tracking.orderId, store: { merchantId } },
      select: {
        id: true,
        storeId: true,
        store: {
          select: {
            settings: {
              select: {
                aramexEnabled: true,
                aramexUser: true,
                aramexPassword: true,
                aramexAccountNumber: true,
                aramexPinCode: true,
                dhlEnabled: true,
                dhlApiKey: true,
                dhlAccountNumber: true,
              },
            },
          },
        },
      },
    })
    if (!order) return reply.status(404).send({ error: 'الطلب غير موجود' })

    const provider = (tracking.provider || '').toUpperCase()
    const settings = order.store.settings
    let liveStatus: any

    if (provider === 'ARAMEX') {
      if (!settings?.aramexEnabled || !settings.aramexUser || !settings.aramexPassword || !settings.aramexAccountNumber || !settings.aramexPinCode) {
        liveStatus = {
          available: false,
          status: 'NOT_READY',
          source: 'disabled',
          message: 'Aramex tracking غير مفعل أو إعداداته ناقصة في هذا المتجر.',
        }
      } else {
        const description = await trackAramexShipment(trackingNumber, {
          user: settings.aramexUser,
          password: settings.aramexPassword,
          accountNumber: settings.aramexAccountNumber,
          pinCode: settings.aramexPinCode,
        })

        liveStatus = {
          available: true,
          status: description,
          source: 'carrier-live',
          provider: 'ARAMEX',
          checkedAt: new Date().toISOString(),
        }

        await prisma.shipmentTracking.update({
          where: { id: tracking.id },
          data: {
            status: description,
            lastCheckedAt: new Date(),
          },
        }).catch(() => {})
      }
    } else if (provider === 'DHL') {
      if (!settings?.dhlEnabled || !settings.dhlApiKey || !settings.dhlAccountNumber) {
        liveStatus = {
          available: false,
          status: 'NOT_READY',
          source: 'disabled',
          provider: 'DHL',
          message: 'DHL غير مفعّل أو إعداداته ناقصة في هذا المتجر.',
        }
      } else {
        const dhlTracking = await trackDhlShipment(trackingNumber, {
          apiKey: settings.dhlApiKey,
          accountNumber: settings.dhlAccountNumber,
        })

        if (!dhlTracking.success) {
          liveStatus = {
            available: false,
            status: 'UNAVAILABLE',
            source: 'carrier-live',
            provider: 'DHL',
            message: dhlTracking.error || 'تعذر الحصول على التتبع المباشر من DHL.',
          }
        } else {
          liveStatus = {
            available: true,
            status: dhlTracking.description || dhlTracking.status,
            source: 'carrier-live',
            provider: 'DHL',
            checkedAt: dhlTracking.checkedAt || new Date().toISOString(),
          }

          await prisma.shipmentTracking.update({
            where: { id: tracking.id },
            data: {
              status: dhlTracking.status || dhlTracking.description || 'IN_TRANSIT',
              lastCheckedAt: new Date(),
            },
          }).catch(() => {})
        }
      }
    } else {
      liveStatus = {
        available: false,
        status: 'NOT_READY',
        source: 'unsupported-provider',
        provider: provider || 'UNKNOWN',
        message: 'هذا المزوّد لا يملك طبقة live tracking حقيقية حالياً.',
      }
    }

    return reply.send({ tracking, liveStatus })
  })

  // PATCH /shipping/track/:id — Update tracking status manually
  app.patch('/track/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const { status, location, events } = request.body as {
      status?: string; location?: string; events?: any[]
    }

    const tracking = await findMerchantShipmentTracking(merchantId, id)
    if (!tracking) return reply.status(403).send({ error: 'غير مصرح' })

    const updated = await prisma.shipmentTracking.update({
      where: { id },
      data: { status, events, updatedAt: new Date() },
    })

    return reply.send({ tracking: updated })
  })
}
