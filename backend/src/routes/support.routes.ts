import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, requirePlatformPermission } from '../middleware/auth.middleware'

export async function supportRoutes(app: FastifyInstance) {

  // List tickets (merchant)
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, status, page = '1' } = request.query as { storeId?: string; status?: string; page?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const take = 20
    const skip = (Number(page) - 1) * take

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { storeId, ...(status ? { status: status as any } : {}) },
        include: {
          _count: { select: { messages: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
      }),
      prisma.supportTicket.count({ where: { storeId, ...(status ? { status: status as any } : {}) } }),
    ])

    return reply.send({ tickets, total, pages: Math.ceil(total / take) })
  })

  // Get single ticket with messages
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, store: { merchantId } },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!ticket) return reply.status(404).send({ error: 'غير موجود' })
    return reply.send({ ticket })
  })

  // Create ticket
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      subject: z.string().min(5),
      body: z.string().min(10),
      category: z.string().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, subject, body, category, priority } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const ticket = await prisma.supportTicket.create({
      data: {
        storeId,
        merchantId,
        subject,
        priority: priority as any,
        category,
        messages: {
          create: { senderType: 'MERCHANT', senderId: merchantId, body },
        },
      },
      include: { messages: true },
    })
    return reply.status(201).send({ ticket })
  })

  // Add message to ticket
  app.post('/:id/messages', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({ body: z.string().min(1) })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'الرسالة فارغة' })

    const merchantId = (request.user as any).id
    const ticket = await prisma.supportTicket.findFirst({ where: { id, store: { merchantId } } })
    if (!ticket) return reply.status(404).send({ error: 'غير موجود' })
    if (ticket.status === 'CLOSED') return reply.status(400).send({ error: 'التذكرة مغلقة' })

    const message = await prisma.ticketMessage.create({
      data: { ticketId: id, senderType: 'MERCHANT', senderId: merchantId, body: result.data.body },
    })
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'WAITING_MERCHANT', updatedAt: new Date() },
    })
    return reply.status(201).send({ message })
  })

  // Close ticket
  app.patch('/:id/close', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const ticket = await prisma.supportTicket.findFirst({ where: { id, store: { merchantId } } })
    if (!ticket) return reply.status(404).send({ error: 'غير موجود' })
    await prisma.supportTicket.update({ where: { id }, data: { status: 'CLOSED' } })
    return reply.send({ message: 'تم إغلاق التذكرة' })
  })

  // ── Admin endpoints ────────────────────────────
  // List all tickets (admin)
  app.get('/admin/all', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (request, reply) => {
    const { status, priority, page = '1' } = request.query as { status?: string; priority?: string; page?: string }

    const take = 20
    const skip = (Number(page) - 1) * take

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where: {
          ...(status ? { status: status as any } : {}),
          ...(priority ? { priority: priority as any } : {}),
        },
        include: {
          store: { select: { nameAr: true, slug: true } },
          _count: { select: { messages: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take,
        skip,
      }),
      prisma.supportTicket.count({
        where: {
          ...(status ? { status: status as any } : {}),
          ...(priority ? { priority: priority as any } : {}),
        },
      }),
    ])
    return reply.send({ tickets, total, pages: Math.ceil(total / take) })
  })

  // Admin reply to ticket
  app.post('/admin/:id/reply', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    const schema = z.object({ body: z.string().min(1) })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'الرسالة فارغة' })

    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) return reply.status(404).send({ error: 'غير موجود' })

    const message = await prisma.ticketMessage.create({
      data: { ticketId: id, senderType: 'ADMIN', senderId: user.id, body: result.data.body },
    })
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
    })
    return reply.status(201).send({ message })
  })

  // Admin resolve ticket
  app.patch('/admin/:id/resolve', { preHandler: [authenticate, requireAdmin, requirePlatformPermission('canReplyTickets')] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })
    return reply.send({ message: 'تم حل التذكرة' })
  })
}
