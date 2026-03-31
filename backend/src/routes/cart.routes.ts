import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendAbandonedCartEmail } from '../lib/email'

const saveCartSchema = z.object({
  storeId: z.string().cuid(),
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  cartData: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    name: z.string(),
    nameAr: z.string().optional(),
    price: z.number(),
    quantity: z.number().int().min(1),
    image: z.string().optional(),
  })).min(1),
})

export async function cartRoutes(app: FastifyInstance) {
  // ── Save abandoned cart ───────────────────────
  app.post('/save', async (request, reply) => {
    const result = saveCartSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const { storeId, email, phone, firstName, cartData } = result.data

    // Upsert — one record per email per store
    await prisma.abandonedCart.upsert({
      where: { storeId_email: { storeId, email } },
      update: {
        phone: phone ?? undefined,
        firstName: firstName ?? undefined,
        cartData: cartData as object[],
        reminderSent: false,
        recoveredAt: null,
        updatedAt: new Date(),
      },
      create: {
        storeId,
        email,
        phone: phone ?? null,
        firstName: firstName ?? null,
        cartData: cartData as object[],
      },
    })

    return reply.status(200).send({ ok: true })
  })

  // ── Mark cart as recovered ────────────────────
  app.patch('/recover/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.abandonedCart.update({
      where: { id },
      data: { recoveredAt: new Date() },
    })
    return reply.send({ ok: true })
  })

  // ── Send reminders for unrecovered carts ─────
  // This endpoint is meant to be called by a cron job / external scheduler
  app.post('/send-reminders', async (request, reply) => {
    const { storeId, hoursOld = 3 } = request.body as { storeId?: string; hoursOld?: number }

    const since = new Date(Date.now() - hoursOld * 3600 * 1000)

    const carts = await prisma.abandonedCart.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        reminderSent: false,
        recoveredAt: null,
        updatedAt: { lt: since },
      },
      include: { store: { select: { name: true, nameAr: true, subdomain: true } } },
      take: 50,
    })

    let sent = 0
    for (const cart of carts) {
      try {
        await sendAbandonedCartEmail({
          to: cart.email,
          firstName: cart.firstName ?? 'عزيزنا',
          storeName: cart.store.nameAr ?? cart.store.name,
          cartUrl: `https://${cart.store.subdomain}.bazar.bh/cart`,
          items: cart.cartData as Array<{ nameAr?: string; name: string; price: number; quantity: number; image?: string }>,
        })
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { reminderSent: true, reminderSentAt: new Date() },
        })
        sent++
      } catch {
        // continue
      }
    }

    return reply.send({ sent, total: carts.length })
  })

  // ── List abandoned carts (merchant) ──────────
  app.get('/:storeId', async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const carts = await prisma.abandonedCart.findMany({
      where: { storeId, recoveredAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return reply.send({ carts })
  })
}
