import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function financeRoutes(fastify: FastifyInstance) {
  // GET /finance/summary?storeId=&period=30
  fastify.get('/finance/summary', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, period = '30' } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const days = parseInt(period)
    const from = new Date()
    from.setDate(from.getDate() - days)

    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (!store) return reply.code(404).send({ error: 'Store not found' })

    const [orders, prevOrders] = await Promise.all([
      prisma.order.findMany({
        where: { storeId, createdAt: { gte: from }, paymentStatus: 'PAID' },
        select: { total: true, subtotal: true, vatAmount: true, createdAt: true, status: true },
      }),
      prisma.order.findMany({
        where: {
          storeId,
          createdAt: {
            gte: new Date(from.getTime() - days * 24 * 60 * 60 * 1000),
            lt: from,
          },
          paymentStatus: 'PAID',
        },
        select: { total: true },
      }),
    ])

    const revenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const vat = orders.reduce((s, o) => s + Number(o.vatAmount ?? 0), 0)
    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0)
    const refunded = orders.filter(o => o.status === 'REFUNDED').reduce((s, o) => s + Number(o.total), 0)

    // daily breakdown
    const dailyMap: Record<string, number> = {}
    for (const o of orders) {
      const day = o.createdAt.toISOString().split('T')[0]
      dailyMap[day] = (dailyMap[day] ?? 0) + Number(o.total)
    }
    const daily = Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      revenue,
      vat,
      net: revenue - vat - refunded,
      refunded,
      ordersCount: orders.length,
      prevRevenue,
      growth: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null,
      daily,
    }
  })

  // GET /finance/vat-report?storeId=&year=&month=
  fastify.get('/finance/vat-report', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, year, month } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const y = parseInt(year ?? new Date().getFullYear())
    const m = month ? parseInt(month) : null

    let from: Date, to: Date
    if (m) {
      from = new Date(y, m - 1, 1)
      to = new Date(y, m, 0, 23, 59, 59)
    } else {
      from = new Date(y, 0, 1)
      to = new Date(y, 11, 31, 23, 59, 59)
    }

    const orders = await prisma.order.findMany({
      where: { storeId, createdAt: { gte: from, lte: to }, paymentStatus: 'PAID' },
      select: { id: true, total: true, subtotal: true, vatAmount: true, createdAt: true, orderNumber: true },
    })

    const totalVat = orders.reduce((s, o) => s + Number(o.vatAmount ?? 0), 0)
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const totalNet = orders.reduce((s, o) => s + Number(o.subtotal ?? 0), 0)

    // Group by month if year-only
    let monthly: any[] = []
    if (!m) {
      const monthMap: Record<number, { revenue: number; vat: number; count: number }> = {}
      for (const o of orders) {
        const mn = o.createdAt.getMonth() + 1
        if (!monthMap[mn]) monthMap[mn] = { revenue: 0, vat: 0, count: 0 }
        monthMap[mn].revenue += Number(o.total)
        monthMap[mn].vat += Number(o.vatAmount ?? 0)
        monthMap[mn].count++
      }
      monthly = Object.entries(monthMap).map(([mn, data]) => ({ month: mn, ...data }))
    }

    return {
      from,
      to,
      totalRevenue,
      totalNet,
      totalVat,
      ordersCount: orders.length,
      monthly: monthly.length ? monthly : undefined,
      orders: m
        ? orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            date: o.createdAt,
            total: Number(o.total),
            vat: Number(o.vatAmount ?? 0),
          }))
        : undefined,
    }
  })

  // GET /finance/export?storeId=&period=&format=csv
  fastify.get('/finance/export', { preHandler: authenticate }, async (req: any, reply) => {
    const { storeId, period = '30', format = 'csv' } = req.query as any
    if (!storeId) return reply.code(400).send({ error: 'storeId required' })

    const days = parseInt(period)
    const from = new Date()
    from.setDate(from.getDate() - days)

    const orders = await prisma.order.findMany({
      where: { storeId, createdAt: { gte: from }, paymentStatus: 'PAID' },
      select: {
        orderNumber: true,
        createdAt: true,
        total: true,
        subtotal: true,
        vatAmount: true,
        shippingCost: true,
        status: true,
        paymentMethod: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (format === 'csv') {
      const header = 'Order,Date,Subtotal,Tax,Shipping,Total,Status,Payment\n'
      const rows = orders
        .map(o =>
          [
            o.orderNumber,
            o.createdAt.toISOString().split('T')[0],
            Number(o.subtotal ?? 0).toFixed(3),
            Number(o.vatAmount ?? 0).toFixed(3),
            Number(o.shippingCost ?? 0).toFixed(3),
            Number(o.total).toFixed(3),
            o.status,
            o.paymentMethod ?? '',
          ].join(',')
        )
        .join('\n')

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="finance-report.csv"')
      return reply.send(header + rows)
    }

    return { orders }
  })
}
