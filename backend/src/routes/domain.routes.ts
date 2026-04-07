import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── Domain Management Routes ─────────────────────────────────────────────────
// Handles: custom domain connection, DNS verification, SSL provisioning, CDN

export async function domainRoutes(app: FastifyInstance) {
  // GET /domain/:storeId — Get domain verification status
  app.get('/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const verification = await prisma.domainVerification.findUnique({ where: { storeId } })
    return reply.send({ store: { domain: store.domain }, verification })
  })

  // POST /domain/connect — Request domain connection
  app.post('/connect', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      domain: z.string().min(4).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'دومين غير صحيح'),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'دومين غير صحيح', details: result.error.flatten() })
    }

    const { storeId, domain } = result.data
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Check if domain already used by another store
    const existing = await prisma.store.findFirst({
      where: { domain, id: { not: storeId } },
    })
    if (existing) return reply.status(400).send({ error: 'هذا الدومين مستخدم بالفعل' })

    const verifyToken = `bazar-verify-${crypto.randomBytes(16).toString('hex')}`

    const verification = await prisma.domainVerification.upsert({
      where: { storeId },
      update: { domain, verifyToken, isVerified: false, sslStatus: 'PENDING' },
      create: { storeId, domain, verifyToken },
    })

    // Update store domain
    await prisma.store.update({ where: { id: storeId }, data: { domain } })

    return reply.status(201).send({
      message: 'تم طلب ربط الدومين. يرجى إضافة سجل DNS التالي:',
      verification,
      dnsInstructions: {
        type: 'TXT',
        name: `_bazar-verify.${domain}`,
        value: verifyToken,
        ttl: 300,
        alternativeCNAME: {
          type: 'CNAME',
          name: domain,
          value: 'stores.bazar.bh',
        },
      },
    })
  })

  // POST /domain/verify — Verify DNS records
  app.post('/verify', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.body as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const verification = await prisma.domainVerification.findUnique({ where: { storeId } })
    if (!verification) return reply.status(404).send({ error: 'لا يوجد طلب ربط دومين' })

    // Verify DNS TXT record = verifyToken
    let isVerified = false
    try {
      const records = await dns.resolveTxt(verification.domain)
      const flat = records.flat()
      isVerified = flat.includes(verification.verifyToken)
    } catch {
      // DNS lookup failed (domain not found or no TXT records)
      isVerified = false
    }

    if (isVerified) {
      await prisma.domainVerification.update({
        where: { storeId },
        data: { isVerified: true, verifiedAt: new Date(), sslStatus: 'PENDING', sslIssuedAt: null, sslExpiresAt: null },
      })

      return reply.send({
        success: true,
        message: 'تم التحقق من الدومين بنجاح، لكن إصدار SSL الآلي غير مفعّل حالياً. أبقينا الحالة معلّقة بدلاً من محاكاة شهادة غير حقيقية.',
      })
    }

    return reply.status(400).send({ success: false, message: 'لم يتم العثور على سجل DNS. يرجى الانتظار 24 ساعة بعد إضافة السجل.' })
  })

  // POST /domain/cdn — Enable/Disable CDN
  app.post('/cdn', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, enabled } = request.body as { storeId: string; enabled: boolean }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const verification = await prisma.domainVerification.findUnique({ where: { storeId } })

    if (enabled && !verification?.isVerified) {
      return reply.status(400).send({ error: 'يجب التحقق من الدومين أولاً لتفعيل CDN' })
    }

    await prisma.domainVerification.upsert({
      where: { storeId },
      update: { cdnEnabled: enabled },
      create: { storeId, domain: store.domain || '', verifyToken: crypto.randomBytes(16).toString('hex'), cdnEnabled: enabled },
    })

    return reply.send({ message: enabled ? 'تم تفعيل CDN بنجاح' : 'تم تعطيل CDN', cdnEnabled: enabled })
  })

  // DELETE /domain/:storeId — Remove custom domain
  app.delete('/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.store.update({ where: { id: storeId }, data: { domain: null } })
    await prisma.domainVerification.deleteMany({ where: { storeId } })

    return reply.send({ message: 'تم إزالة الدومين المخصص' })
  })
}
