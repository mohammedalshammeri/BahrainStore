import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const createCustomerSchema = z.object({
  storeId: z.string().cuid(),
  phone: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email().optional(),
})

export async function customerRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const result = createCustomerSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const { storeId, phone, firstName, lastName, email } = result.data

    const existing = await prisma.customer.findUnique({ where: { storeId_phone: { storeId, phone } } })
    if (existing) return reply.send({ customer: existing })

    const customer = await prisma.customer.create({ data: { storeId, phone, firstName, lastName, email } })
    return reply.status(201).send({ customer })
  })

  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const { storeId, page = '1', limit = '20', search } = request.query as Record<string, string>

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { storeId }
    if (search) where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ]

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { totalSpent: 'desc' },
      }),
      prisma.customer.count({ where }),
    ])

    return reply.send({ customers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  })

  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        store: { select: { merchantId: true } },
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, orderNumber: true, total: true, status: true, createdAt: true } },
      },
    })

    if (!customer || customer.store.merchantId !== merchantId) {
      return reply.status(404).send({ error: 'العميل غير موجود' })
    }

    return reply.send({ customer })
  })
}
