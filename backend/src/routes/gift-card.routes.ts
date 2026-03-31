import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import crypto from 'crypto'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, (_, i) =>
    (i > 0 && i % 4 === 0 ? '-' : '') + chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export async function giftCardRoutes(app: FastifyInstance) {

  // List gift cards
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, page = '1' } = request.query as { storeId?: string; page?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const take = 20
    const skip = (Number(page) - 1) * take

    const [giftCards, total] = await Promise.all([
      prisma.giftCard.findMany({
        where: { storeId },
        include: { _count: { select: { transactions: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.giftCard.count({ where: { storeId } }),
    ])

    return reply.send({ giftCards, total, pages: Math.ceil(total / take) })
  })

  // Create gift card(s)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      value: z.number().positive(),
      quantity: z.number().int().min(1).max(50).default(1),
      expiresAt: z.string().optional(),
      recipientEmail: z.string().email().optional(),
      recipientName: z.string().optional(),
      message: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, value, quantity, expiresAt, recipientEmail, recipientName, message } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const cards = await Promise.all(
      Array.from({ length: quantity }, () =>
        prisma.giftCard.create({
          data: {
            storeId,
            code: generateCode(),
            initialValue: value,
            balance: value,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            recipientEmail,
            recipientName,
            message,
          },
        })
      )
    )

    return reply.status(201).send({ giftCards: cards })
  })

  // Disable/enable gift card
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({ isActive: z.boolean() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const card = await prisma.giftCard.findFirst({ where: { id, store: { merchantId } } })
    if (!card) return reply.status(404).send({ error: 'غير موجود' })

    const updated = await prisma.giftCard.update({ where: { id }, data: result.data })
    return reply.send({ giftCard: updated })
  })

  // Delete gift card
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id
    const card = await prisma.giftCard.findFirst({ where: { id, store: { merchantId } } })
    if (!card) return reply.status(404).send({ error: 'غير موجود' })
    if (Number(card.balance) < Number(card.initialValue)) {
      return reply.status(400).send({ error: 'لا يمكن حذف كارت هدية مستخدَم جزئياً' })
    }
    await prisma.giftCard.delete({ where: { id } })
    return reply.send({ message: 'تم الحذف' })
  })

  // Public: validate gift card at checkout
  app.post('/public/validate', async (request, reply) => {
    const schema = z.object({ storeId: z.string().cuid(), code: z.string() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, code } = result.data
    const card = await prisma.giftCard.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase().replace(/[^A-Z0-9]/g, '-') } },
    })
    if (!card) return reply.status(404).send({ error: 'كارت الهدية غير صحيح' })
    if (!card.isActive) return reply.status(400).send({ error: 'كارت الهدية غير نشط' })
    if (card.expiresAt && card.expiresAt < new Date()) return reply.status(400).send({ error: 'انتهت صلاحية كارت الهدية' })
    if (Number(card.balance) <= 0) return reply.status(400).send({ error: 'رصيد كارت الهدية صفر' })

    return reply.send({ valid: true, balance: Number(card.balance), code: card.code })
  })

  // Public: redeem gift card on order
  app.post('/public/redeem', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      code: z.string(),
      amount: z.number().positive(),
      orderId: z.string().cuid(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, code, amount, orderId } = result.data
    const card = await prisma.giftCard.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
    })
    if (!card || !card.isActive) return reply.status(400).send({ error: 'كارت الهدية غير صالح' })
    if (Number(card.balance) < amount) return reply.status(400).send({ error: 'الرصيد غير كافٍ' })

    const [, tx] = await prisma.$transaction([
      prisma.giftCard.update({ where: { id: card.id }, data: { balance: { decrement: amount } } }),
      prisma.giftCardTransaction.create({ data: { giftCardId: card.id, orderId, amount, type: 'USAGE' } }),
    ])

    return reply.send({ message: 'تم استخدام كارت الهدية', deducted: amount, remainingBalance: Number(card.balance) - amount })
  })
}
