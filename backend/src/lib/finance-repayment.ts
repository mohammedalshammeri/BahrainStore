import { prisma } from './prisma'

/**
 * FEAT-006 — Bazar Finance automatic repayment
 * Called after every paid order. If the store has an active loan (DISBURSED or REPAYING),
 * deducts `repaymentRate * orderTotal` and records a LoanRepayment entry.
 * Runs fire-and-forget from order.routes.ts — errors are logged, not surfaced to customers.
 */
export async function processLoanRepayment(
  storeId: string,
  orderId: string,
  orderTotal: number,
): Promise<void> {
  const loan = await prisma.merchantLoan.findFirst({
    where: { storeId, status: { in: ['DISBURSED', 'REPAYING'] } },
    select: {
      id: true,
      approvedAmount: true,
      requestedAmount: true,
      feeAmount: true,
      repaidAmount: true,
      repaymentRate: true,
    },
  })

  if (!loan) return

  const repaymentAmount = Number((orderTotal * loan.repaymentRate).toFixed(3))
  if (repaymentAmount <= 0) return

  const totalOwed = (Number(loan.approvedAmount ?? loan.requestedAmount)) + Number(loan.feeAmount ?? 0)
  const newRepaid = Number(loan.repaidAmount) + repaymentAmount
  const isFullyRepaid = newRepaid >= totalOwed

  await prisma.$transaction([
    prisma.loanRepayment.create({
      data: { loanId: loan.id, orderId, amount: repaymentAmount },
    }),
    prisma.merchantLoan.update({
      where: { id: loan.id },
      data: {
        repaidAmount: newRepaid,
        status: isFullyRepaid ? 'FULLY_REPAID' : 'REPAYING',
      },
    }),
  ])
}
