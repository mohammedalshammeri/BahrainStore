import { prisma } from './prisma'

// ── Plan limits per StorePlan ────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, { products: number; monthlyOrders: number }> = {
  STARTER:    { products: 100,      monthlyOrders: 50 },
  GROWTH:     { products: 1_000,    monthlyOrders: 500 },
  PRO:        { products: 5_000,    monthlyOrders: 5_000 },
  ENTERPRISE: { products: Infinity, monthlyOrders: Infinity },
}

export type PlanLimitResult = {
  allowed: boolean
  limit: number
  current: number
  plan: string
}

export async function checkPlanLimit(
  storeId: string,
  resource: 'products' | 'orders',
): Promise<PlanLimitResult> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { plan: true },
  })

  const plan = (store?.plan ?? 'STARTER') as string
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.STARTER

  let current: number
  let limit: number

  if (resource === 'products') {
    limit = limits.products
    current = await prisma.product.count({ where: { storeId } })
  } else {
    limit = limits.monthlyOrders
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    current = await prisma.order.count({
      where: { storeId, createdAt: { gte: monthStart } },
    })
  }

  return { allowed: current < limit, limit, current, plan }
}
