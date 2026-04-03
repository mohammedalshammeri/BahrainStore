import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import * as https from 'https'

// ─── Shipping Zones, Rates & Carrier Integration Routes ──────────────────────

export async function shippingRoutes(app: FastifyInstance) {
  // ── Shipping Zones ──────────────────────────────────────────────────────────

  // GET /shipping/zones — List store's shipping zones
  app.get('/zones', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
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
    const store = await prisma.store.findFirst({
      where: { id: result.data.storeId, merchantId },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const zone = await prisma.shippingZone.create({ data: result.data })
    return reply.status(201).send({ message: 'تم إنشاء المنطقة', zone })
  })

  // PUT /shipping/zones/:id — Update shipping zone
  app.put('/zones/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const zone = await prisma.shippingZone.findUnique({ where: { id } })
    if (!zone) return reply.status(404).send({ error: 'المنطقة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: zone.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

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

    const zone = await prisma.shippingZone.findUnique({ where: { id } })
    if (!zone) return reply.status(404).send({ error: 'المنطقة غير موجودة' })

    const store = await prisma.store.findFirst({ where: { id: zone.storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

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

    const rate = await prisma.shippingRate.create({ data: result.data })
    return reply.status(201).send({ message: 'تم إضافة السعر', rate })
  })

  // PUT /shipping/rates/:id — Update rate
  app.put('/rates/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const updated = await prisma.shippingRate.update({
      where: { id },
      data: request.body as any,
    })
    return reply.send({ rate: updated })
  })

  // DELETE /shipping/rates/:id — Delete rate
  app.delete('/rates/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
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
    const zones = await prisma.shippingZone.findMany({
      where: {
        storeId,
        OR: [
          { countries: { has: country } },
          { countries: { has: 'ALL' } },
        ],
      },
      include: { rates: true },
    })

    const availableRates: any[] = []

    for (const zone of zones) {
      for (const rate of zone.rates) {
        const w = totalWeight
        const minW = rate.minWeight ? Number(rate.minWeight) : 0
        const maxW = rate.maxWeight ? Number(rate.maxWeight) : Infinity
        if (w >= minW && w <= maxW) {
          if (rate.isFree) {
            availableRates.push({ ...rate, finalPrice: 0, zoneName: zone.name })
          } else {
            availableRates.push({ ...rate, finalPrice: Number(rate.price), zoneName: zone.name })
          }
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

    const tracking = await prisma.shipmentTracking.create({ data: result.data })
    return reply.status(201).send({ message: 'تم إضافة معلومات الشحن', tracking })
  })

  // GET /shipping/track/:trackingNumber — Get live tracking from carrier
  app.get('/track/:trackingNumber', async (request, reply) => {
    const { trackingNumber } = request.params as { trackingNumber: string }
    const { carrier } = request.query as { carrier?: string }

    // Get tracking record
    const tracking = await prisma.shipmentTracking.findFirst({
      where: { trackingNumber },
    })

    let liveStatus: any = null

    if (carrier === 'ARAMEX' || tracking?.provider === 'ARAMEX') {
      liveStatus = await getAramexTracking(trackingNumber)
    } else if (carrier === 'DHL' || tracking?.provider === 'DHL') {
      liveStatus = await getDhlTracking(trackingNumber)
    }

    return reply.send({ tracking, liveStatus })
  })

  // PATCH /shipping/track/:id — Update tracking status manually
  app.patch('/track/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status, location, events } = request.body as {
      status?: string; location?: string; events?: any[]
    }

    const updated = await prisma.shipmentTracking.update({
      where: { id },
      data: { status, events, updatedAt: new Date() },
    })

    return reply.send({ tracking: updated })
  })
}

// ─── Carrier API Helpers ──────────────────────────────────────────────────────

function getAramexTracking(trackingNumber: string): Promise<any> {
  return new Promise((resolve) => {
    // Mock response — in production connect to Aramex WSDL API
    resolve({
      carrier: 'ARAMEX',
      trackingNumber,
      status: 'IN_TRANSIT',
      lastUpdate: new Date().toISOString(),
      events: [
        { date: new Date().toISOString(), status: 'Shipment picked up', location: 'Manama, BH' },
      ],
    })
  })
}

function getDhlTracking(trackingNumber: string): Promise<any> {
  return new Promise((resolve) => {
    // Mock response — in production call DHL API: https://api-eu.dhl.com/track/shipments
    resolve({
      carrier: 'DHL',
      trackingNumber,
      status: 'IN_TRANSIT',
      lastUpdate: new Date().toISOString(),
      events: [
        { date: new Date().toISOString(), status: 'Shipment in transit', location: 'Hub Bahrain' },
      ],
    })
  })
}
