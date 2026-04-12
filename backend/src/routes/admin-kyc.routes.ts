import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, requirePlatformPermission, resolvePlatformAccess } from '../middleware/auth.middleware'
import { sendKycDecisionEmail } from '../lib/email'

const adminKycReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(1000).optional(),
})

const adminKycCreateSchema = z.object({
  merchantId: z.string().cuid(),
  type: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(255).optional(),
})

function buildKycTimelineDates(reviewedAt: Date) {
  const expiresAt = new Date(reviewedAt)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const reVerifyBy = new Date(expiresAt)
  reVerifyBy.setDate(reVerifyBy.getDate() - 30)

  return { expiresAt, reVerifyBy }
}

function getAuditActor(req: any, access: Awaited<ReturnType<typeof resolvePlatformAccess>>) {
  return {
    actorId: access?.staffId ?? req.user.id,
    actorType: access?.staffId ? 'STAFF' : 'ADMIN',
    actorName: `${req.user.firstName ?? ''} ${req.user.lastName ?? ''}`.trim(),
    actorEmail: req.user.email ?? '',
  }
}

export async function adminKycRoutes(app: FastifyInstance) {
  app.get('/admin/kyc', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReviewKYC')] }, async (req, reply) => {
    const { status, page = '1', search = '', type = '' } = req.query as {
      status?: string
      page?: string
      search?: string
      type?: string
    }
    const take = 20
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1)
    const skip = (currentPage - 1) * take
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (type.trim()) {
      where.type = type.trim()
    }

    if (search.trim()) {
      where.OR = [
        { merchant: { email: { contains: search.trim(), mode: 'insensitive' } } },
        { merchant: { firstName: { contains: search.trim(), mode: 'insensitive' } } },
        { merchant: { lastName: { contains: search.trim(), mode: 'insensitive' } } },
      ]
    }

    const [docs, total] = await Promise.all([
      prisma.kycDocument.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          merchant: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } },
        },
      }),
      prisma.kycDocument.count({ where }),
    ])
    return reply.send({ docs, total, page: currentPage, pages: Math.ceil(total / take) })
  })

  app.patch('/admin/kyc/:id/review', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReviewKYC')] }, async (req, reply) => {
    const { id } = req.params as any
    const parsed = adminKycReviewSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'بيانات مراجعة KYC غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const { status, reviewNote } = parsed.data
    const admin = (req as any).user
    const access = await resolvePlatformAccess(req, reply)
    if (!access || reply.sent) return

    if (status === 'REJECTED' && !reviewNote?.trim()) {
      return reply.status(400).send({ error: 'ملاحظة المراجعة مطلوبة عند رفض وثيقة KYC' })
    }

    const existingDoc = await prisma.kycDocument.findUnique({
      where: { id },
      select: {
        id: true,
        merchantId: true,
        status: true,
        type: true,
        merchant: { select: { email: true, firstName: true, lastName: true } },
      },
    })

    if (!existingDoc) {
      return reply.status(404).send({ error: 'وثيقة KYC غير موجودة' })
    }

    if (existingDoc.status !== 'PENDING') {
      return reply.status(400).send({ error: 'لا يمكن إعادة مراجعة وثيقة KYC بعد حسمها' })
    }

    const reviewedAt = new Date()
    const timeline = status === 'APPROVED' ? buildKycTimelineDates(reviewedAt) : { expiresAt: null, reVerifyBy: null }

    const doc = await prisma.kycDocument.update({
      where: { id },
      data: {
        status,
        reviewNote: reviewNote?.trim() || null,
        reviewedAt,
        reviewedBy: admin.email,
        expiresAt: timeline.expiresAt,
        reVerifyBy: timeline.reVerifyBy,
      },
    })

    const pending = await prisma.kycDocument.count({ where: { merchantId: doc.merchantId, status: 'PENDING' } })
    const approved = await prisma.kycDocument.count({ where: { merchantId: doc.merchantId, status: 'APPROVED' } })
    const rejected = await prisma.kycDocument.count({ where: { merchantId: doc.merchantId, status: 'REJECTED' } })
    let kycStatus: 'PENDING' | 'REJECTED' | 'APPROVED' = 'PENDING'
    if (rejected > 0) kycStatus = 'REJECTED'
    else if (pending === 0 && approved > 0) kycStatus = 'APPROVED'

    await prisma.merchant.update({ where: { id: doc.merchantId }, data: { kycStatus } })

    await prisma.auditLog.create({
      data: {
        ...getAuditActor(req, access),
        action: status === 'APPROVED' ? 'APPROVE_KYC' : 'REJECT_KYC',
        entityType: 'KYC_DOCUMENT',
        entityId: doc.id,
        entityName: existingDoc.type,
        details: {
          merchantId: doc.merchantId,
          merchantKycStatus: kycStatus,
          reviewNote: reviewNote?.trim() || null,
          expiresAt: timeline.expiresAt,
          reVerifyBy: timeline.reVerifyBy,
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    })

    if (existingDoc.merchant.email) {
      sendKycDecisionEmail({
        to: existingDoc.merchant.email,
        merchantName: `${existingDoc.merchant.firstName} ${existingDoc.merchant.lastName}`.trim(),
        status,
        reviewNote: reviewNote?.trim() || null,
        documentType: existingDoc.type,
        expiresAt: timeline.expiresAt,
        reVerifyBy: timeline.reVerifyBy,
      }).catch((error: unknown) => {
        req.log.error({ error, kycDocumentId: doc.id }, 'Failed to send KYC decision email')
      })
    }

    return reply.send({ doc, kycStatus })
  })

  app.post('/admin/kyc', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReviewKYC')] }, async (req, reply) => {
    const parsed = adminKycCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'بيانات وثيقة KYC غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const { merchantId, type, fileUrl, fileName } = parsed.data
    const access = await resolvePlatformAccess(req, reply)
    if (!access || reply.sent) return
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true, email: true } })
    if (!merchant) {
      return reply.status(404).send({ error: 'التاجر غير موجود' })
    }

    const doc = await prisma.kycDocument.create({
      data: { merchantId, type, fileUrl, fileName: fileName ?? null },
    })
    await prisma.merchant.update({ where: { id: merchantId }, data: { kycStatus: 'PENDING' } })

    await prisma.auditLog.create({
      data: {
        ...getAuditActor(req, access),
        action: 'CREATE_KYC_DOCUMENT',
        entityType: 'KYC_DOCUMENT',
        entityId: doc.id,
        entityName: type,
        details: { merchantId, merchantEmail: merchant.email, fileName: fileName ?? null },
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    })

    return reply.status(201).send({ doc })
  })

  app.get('/admin/kyc/merchants', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReviewKYC')] }, async (req, reply) => {
    const { limit = '20', search = '' } = req.query as { limit?: string; search?: string }
    const take = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20))
    const trimmedSearch = search.trim()

    const merchants = await prisma.merchant.findMany({
      where: trimmedSearch
        ? {
            OR: [
              { email: { contains: trimmedSearch, mode: 'insensitive' } },
              { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
              { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, firstName: true, lastName: true },
    })

    return reply.send({ merchants })
  })

  app.get('/admin/kyc/stats', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReviewKYC')] }, async (_req, reply) => {
    const [pending, approved, rejected, total] = await Promise.all([
      prisma.kycDocument.count({ where: { status: 'PENDING' } }),
      prisma.kycDocument.count({ where: { status: 'APPROVED' } }),
      prisma.kycDocument.count({ where: { status: 'REJECTED' } }),
      prisma.kycDocument.count(),
    ])
    return reply.send({ pending, approved, rejected, total })
  })
}