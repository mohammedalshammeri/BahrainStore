import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { requireAdmin } from '../middleware/auth.middleware'

// ─── Partner Program Routes ────────────────────────────────────────────────────

export async function partnerRoutes(app: FastifyInstance) {
  // POST /partners/apply — Apply to partner program
  app.post('/apply', async (request, reply) => {
    const schema = z.object({
      companyName: z.string().min(2),
      contactName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      website: z.string().url().optional(),
      type: z.enum(['AGENCY', 'FREELANCER', 'RESELLER', 'TECHNOLOGY']).default('AGENCY'),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const existing = await prisma.partner.findUnique({ where: { email: result.data.email } })
    if (existing) return reply.status(400).send({ error: 'البريد الإلكتروني مسجّل بالفعل' })

    const referralCode = `BAZAR-${result.data.companyName.toUpperCase().replace(/\s+/g, '').substring(0, 6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const partner = await prisma.partner.create({
      data: { ...result.data, referralCode, status: 'PENDING' },
    })

    return reply.status(201).send({
      message: 'تم استلام طلبك! سيتم مراجعته خلال 3-5 أيام عمل',
      partnerId: partner.id,
    })
  })

  // GET /partners/:id — Partner profile (for partners to view their stats)
  app.get('/:code/stats', async (request, reply) => {
    const { code } = request.params as { code: string }

    const partner = await prisma.partner.findUnique({
      where: { referralCode: code },
      include: {
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!partner || partner.status !== 'APPROVED') {
      return reply.status(404).send({ error: 'الشريك غير موجود أو غير معتمد' })
    }

    return reply.send({
      partner: {
        companyName: partner.companyName,
        contactName: partner.contactName,
        type: partner.type,
        referralCode: partner.referralCode,
        certifiedBadge: partner.certifiedBadge,
        commissionRate: partner.commissionRate,
        totalEarned: partner.totalEarned,
        totalPaid: partner.totalPaid,
        referralsCount: partner.referrals.length,
        status: partner.status,
      },
    })
  })

  // GET /partners/all — Admin: all partners
  app.get('/all', { preHandler: requireAdmin }, async (request, reply) => {
    const { status, page = 1, limit = 20 } = request.query as { status?: string; page?: number; limit?: number }

    const where: any = {}
    if (status) where.status = status

    const [partners, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        include: { _count: { select: { referrals: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.partner.count({ where }),
    ])

    return reply.send({ partners, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  })

  // PATCH /partners/:id/approve — Admin: approve partner
  app.patch('/:id/approve', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { commissionRate } = request.body as { commissionRate?: number }

    const partner = await prisma.partner.update({
      where: { id },
      data: {
        status: 'APPROVED',
        commissionRate: commissionRate || 0.20,
      },
    })

    return reply.send({ message: 'تم اعتماد الشريك', partner })
  })

  // PATCH /partners/:id/certify — Admin: award certified badge
  app.patch('/:id/certify', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const partner = await prisma.partner.update({ where: { id }, data: { certifiedBadge: true } })
    return reply.send({ message: 'تم منح شهادة الشريك المعتمد', partner })
  })

  // POST /partners/track — Track a partner referral (when store signs up with code)
  app.post('/track', async (request, reply) => {
    const { referralCode, storeId } = request.body as { referralCode: string; storeId: string }

    const partner = await prisma.partner.findUnique({ where: { referralCode, status: 'APPROVED' } })
    if (!partner) return reply.status(404).send({ error: 'رمز الشريك غير صحيح' })

    const existing = await prisma.partnerReferral.findFirst({ where: { storeId } })
    if (existing) return reply.status(400).send({ error: 'هذا المتجر مرتبط بشريك بالفعل' })

    const referral = await prisma.partnerReferral.create({
      data: { partnerId: partner.id, storeId, status: 'PENDING' },
    })

    return reply.status(201).send({ tracked: true, referral })
  })

  // POST /partners/:id/payout — Admin: record commission payout
  app.post('/:id/payout', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { amount } = request.body as { amount: number }

    const partner = await prisma.partner.findUnique({ where: { id } })
    if (!partner) return reply.status(404).send({ error: 'الشريك غير موجود' })

    await prisma.partner.update({
      where: { id },
      data: { totalPaid: { increment: amount } },
    })

    // Mark pending referrals as paid
    await prisma.partnerReferral.updateMany({
      where: { partnerId: id, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    })

    return reply.send({ message: `تم تسجيل صرف ${amount} BHD للشريك` })
  })
}
