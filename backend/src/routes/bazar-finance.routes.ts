import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { findMerchantLoan, findMerchantStore } from '../lib/merchant-ownership'
import { authenticate, requireAdmin, requireFullPlatformAdmin, requirePlatformPermission } from '../middleware/auth.middleware'

// ─── Bazar Finance — Merchant Advance Financing ───────────────────────────────
// Merchants apply for cash advances based on their sales history
// Repayment: automatic deduction of X% from each sale
// Fee: flat rate on approved amount (e.g., 10%)

// ─── Helper: calculate eligibility ──────────────────────────────────────────
async function calculateEligibility(storeId: string): Promise<{
  eligible: boolean
  maxAmount: number
  avgMonthlySales: number
  salesHistory: number[]
  reason?: string
}> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)

  // LOGIC-010: Replace $queryRaw with Prisma API to avoid hardcoded column names
  const paidOrders = await prisma.order.findMany({
    where: { storeId, paymentStatus: 'PAID', createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, total: true },
  })

  const monthMap = new Map<string, number>()
  for (const o of paidOrders) {
    const monthKey = o.createdAt.toISOString().slice(0, 7) // 'YYYY-MM'
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + Number(o.total))
  }
  const monthlyRevenue = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }))

  if (monthlyRevenue.length < 2) {
    return { eligible: false, maxAmount: 0, avgMonthlySales: 0, salesHistory: [], reason: 'تحتاج إلى 2 أشهر على الأقل من المبيعات' }
  }

  const salesHistory = monthlyRevenue.map((r) => Number(r.revenue))
  const avgMonthlySales = salesHistory.reduce((a, b) => a + b, 0) / salesHistory.length

  if (avgMonthlySales < 100) {
    return { eligible: false, maxAmount: 0, avgMonthlySales, salesHistory, reason: 'يجب أن تتجاوز المبيعات الشهرية 100 BHD' }
  }

  // Max advance = 60% of average monthly * 6 months = up to 3.6x average monthly
  const maxAmount = Math.floor(avgMonthlySales * 0.6 * Math.min(salesHistory.length, 6))

  // Check no active loans
  const activeLoan = await prisma.merchantLoan.findFirst({
    where: { storeId, status: { in: ['APPROVED', 'DISBURSED', 'REPAYING'] } },
  })

  if (activeLoan) {
    return { eligible: false, maxAmount: 0, avgMonthlySales, salesHistory, reason: 'لديك قرض نشط حالياً' }
  }

  return { eligible: true, maxAmount, avgMonthlySales, salesHistory }
}

export async function bazarFinanceRoutes(app: FastifyInstance) {
  // ─── GET /bazar-finance/eligibility ──────────────────────────────────────
  // Check merchant eligibility for a cash advance
  app.get('/eligibility', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId }, select: { id: true, name: true, currency: true } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const eligibility = await calculateEligibility(storeId)

    return reply.send({
      storeId,
      storeName: store.name,
      currency: store.currency,
      ...eligibility,
      feeRate: 0.10,
      repaymentRate: 0.10,
      maxTermMonths: 6,
    })
  })

  // ─── POST /bazar-finance/apply ────────────────────────────────────────────
  // Submit a loan application
  app.post('/apply', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      requestedAmount: z.number().positive().max(50000),
      purpose: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })
    const merchantId = (request.user as any).id
    const { storeId, requestedAmount, purpose } = parsed.data

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const eligibility = await calculateEligibility(storeId)
    if (!eligibility.eligible) {
      return reply.status(400).send({ error: 'غير مؤهل للتمويل', reason: eligibility.reason })
    }

    if (requestedAmount > eligibility.maxAmount) {
      return reply.status(400).send({
        error: `المبلغ المطلوب يتجاوز الحد الأقصى`,
        maxAmount: eligibility.maxAmount,
      })
    }

    const feeAmount = requestedAmount * 0.10
    const loan = await prisma.merchantLoan.create({
      data: {
        storeId,
        merchantId,
        requestedAmount,
        feeRate: 0.10,
        feeAmount,
        repaymentRate: 0.10,
        status: 'PENDING',
        notes: purpose,
      },
    })

    return reply.status(201).send({ success: true, loan })
  })

  // ─── GET /bazar-finance/loans ─────────────────────────────────────────────
  // Get all loans for a store
  app.get('/loans', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const loans = await prisma.merchantLoan.findMany({
      where: { storeId },
      include: {
        repayments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    })

    const loansWithProgress = loans.map((loan) => ({
      ...loan,
      totalOwed: (loan.approvedAmount || loan.requestedAmount) + (loan.feeAmount || 0),
      remainingAmount: Math.max(0, ((loan.approvedAmount || loan.requestedAmount) + (loan.feeAmount || 0)) - loan.repaidAmount),
      repaymentProgress: loan.feeAmount
        ? (loan.repaidAmount / ((loan.approvedAmount || loan.requestedAmount) + loan.feeAmount)) * 100
        : 0,
    }))

    return reply.send({ loans: loansWithProgress })
  })

  // ─── GET /bazar-finance/loans/:id ─────────────────────────────────────────
  app.get('/loans/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any

    const merchantId = (request.user as any).id
    const ownedLoan = await findMerchantLoan(merchantId, id)
    if (!ownedLoan) return reply.status(403).send({ error: 'غير مصرح' })

    const loan = await prisma.merchantLoan.findUnique({
      where: { id },
      include: { repayments: { orderBy: { createdAt: 'desc' } } },
    })
    if (!loan) return reply.status(404).send({ error: 'القرض غير موجود' })
    return reply.send({ loan })
  })

  // ─── PATCH /bazar-finance/loans/:id/approve ───────────────────────────────
  // Admin: approve and disburse a loan
  app.patch('/loans/:id/approve', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const schema = z.object({ approvedAmount: z.number().positive() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const loan = await prisma.merchantLoan.findUnique({ where: { id } })
    if (!loan) return reply.status(404).send({ error: 'القرض غير موجود' })
    if (loan.status !== 'PENDING') return reply.status(400).send({ error: 'القرض ليس في حالة انتظار' })

    const updated = await prisma.merchantLoan.update({
      where: { id },
      data: {
        approvedAmount: parsed.data.approvedAmount,
        feeAmount: parsed.data.approvedAmount * loan.feeRate,
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })

    return reply.send({ success: true, loan: updated })
  })

  // ─── PATCH /bazar-finance/loans/:id/disburse ──────────────────────────────
  app.patch('/loans/:id/disburse', { preHandler: [authenticate, requireAdmin, requireFullPlatformAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const loan = await prisma.merchantLoan.findUnique({ where: { id } })
    if (!loan) return reply.status(404).send({ error: 'القرض غير موجود' })
    if (loan.status !== 'APPROVED') return reply.status(400).send({ error: 'القرض غير معتمد' })

    const updated = await prisma.merchantLoan.update({
      where: { id },
      data: { status: 'DISBURSED', disbursedAt: new Date() },
    })

    return reply.send({ success: true, loan: updated })
  })

  // ─── POST /bazar-finance/loans/:id/repay ──────────────────────────────────
  // Record a repayment (called automatically on each order)
  app.post('/loans/:id/repay', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as any
    const schema = z.object({
      amount: z.number().positive(),
      orderId: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const ownedLoan = await findMerchantLoan(merchantId, id)
    if (!ownedLoan) return reply.status(403).send({ error: 'غير مصرح' })

    const loan = await prisma.merchantLoan.findUnique({ where: { id } })
    if (!loan) return reply.status(404).send({ error: 'القرض غير موجود' })
    if (!['DISBURSED', 'REPAYING'].includes(loan.status)) {
      return reply.status(400).send({ error: 'القرض غير نشط' })
    }

    const totalOwed = (loan.approvedAmount || loan.requestedAmount) + (loan.feeAmount || 0)
    const newRepaid = loan.repaidAmount + parsed.data.amount

    const isFullyRepaid = newRepaid >= totalOwed

    await prisma.$transaction([
      prisma.loanRepayment.create({
        data: { loanId: id, orderId: parsed.data.orderId, amount: parsed.data.amount },
      }),
      prisma.merchantLoan.update({
        where: { id },
        data: {
          repaidAmount: newRepaid,
          status: isFullyRepaid ? 'FULLY_REPAID' : 'REPAYING',
          fullyRepaidAt: isFullyRepaid ? new Date() : undefined,
        },
      }),
    ])

    return reply.send({
      success: true,
      isFullyRepaid,
      totalOwed,
      repaidAmount: newRepaid,
      remaining: Math.max(0, totalOwed - newRepaid),
    })
  })

  // ─── GET /bazar-finance/dashboard ─────────────────────────────────────────
  // Overview stats for admin finance dashboard
  app.get('/dashboard', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canViewFinancials')] }, async (_request, reply) => {
    const [pending, disbursed, repaying, totalDisbursed, totalRepaid] = await Promise.all([
      prisma.merchantLoan.count({ where: { status: 'PENDING' } }),
      prisma.merchantLoan.count({ where: { status: 'DISBURSED' } }),
      prisma.merchantLoan.count({ where: { status: 'REPAYING' } }),
      prisma.merchantLoan.aggregate({
        where: { status: { in: ['DISBURSED', 'REPAYING', 'FULLY_REPAID'] } },
        _sum: { approvedAmount: true, feeAmount: true },
      }),
      prisma.merchantLoan.aggregate({ _sum: { repaidAmount: true } }),
    ])

    return reply.send({
      pending,
      disbursed,
      repaying,
      totalDisbursed: Number(totalDisbursed._sum.approvedAmount || 0),
      totalFees: Number(totalDisbursed._sum.feeAmount || 0),
      totalRepaid: Number(totalRepaid._sum.repaidAmount || 0),
    })
  })

  // ─── GET /bazar-finance/auto-repayment/:storeId ───────────────────────────
  // Calculate repayment amount for a given order total
  app.get('/auto-repayment/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as any
    const { orderTotal } = request.query as any

    const merchantId = (request.user as any).id
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const activeLoan = await prisma.merchantLoan.findFirst({
      where: { storeId, status: { in: ['DISBURSED', 'REPAYING'] } },
    })

    if (!activeLoan) return reply.send({ hasActiveLoan: false, deductionAmount: 0 })

    const total = parseFloat(orderTotal || '0')
    const deductionAmount = total * activeLoan.repaymentRate

    return reply.send({
      hasActiveLoan: true,
      loanId: activeLoan.id,
      deductionAmount,
      repaymentRate: activeLoan.repaymentRate,
      remaining: Math.max(0, ((activeLoan.approvedAmount || activeLoan.requestedAmount) + (activeLoan.feeAmount || 0)) - activeLoan.repaidAmount),
    })
  })
}
