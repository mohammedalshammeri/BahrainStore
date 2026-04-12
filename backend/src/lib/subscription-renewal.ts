import { prisma } from './prisma'

/**
 * Cancel or expire subscriptions that have passed their current period end.
 * - cancelAtPeriodEnd=true → status becomes CANCELLED
 * - cancelAtPeriodEnd=false → status becomes EXPIRED (overdue, likely payment failed)
 * Runs on startup and every hour via setInterval in index.ts
 */
export async function processExpiredSubscriptions(): Promise<void> {
  const now = new Date()

  // Subscriptions the customer chose to cancel at period end
  await prisma.customerSubscription.updateMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { lt: now },
      cancelAtPeriodEnd: true,
    },
    data: { status: 'CANCELLED', cancelledAt: now },
  })

  // Subscriptions that simply expired (e.g., payment failed, not manually cancelled)
  await prisma.customerSubscription.updateMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { lt: now },
      cancelAtPeriodEnd: false,
    },
    data: { status: 'EXPIRED' },
  })
}
