import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import nodemailer from 'nodemailer'

export async function notifyBackInStock(storeId: string, productId: string) {
  const subs = await prisma.backInStockSubscription.findMany({
    where: { storeId, productId, notified: false },
    include: {
      product: { select: { name: true, nameAr: true, slug: true, store: { select: { subdomain: true, nameAr: true } } } },
    },
  })
  if (subs.length === 0) return

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  for (const sub of subs) {
    if (!sub.email) continue
    const product = sub.product
    const url = `https://${product.store.subdomain}.bazar.bh/products/${product.slug}`
    try {
      await transporter.sendMail({
        from: `"${product.store.nameAr}" <${process.env.SMTP_FROM ?? 'noreply@bazar.bh'}>`,
        to: sub.email,
        subject: `عاد للمخزون: ${product.nameAr}`,
        html: `<div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2>عاد إلى المخزون! 🎉</h2>
          <p>المنتج الذي كنت تنتظره <strong>${product.nameAr}</strong> عاد متوفراً الآن.</p>
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none">اطلب الآن</a>
          <p style="color:#999;font-size:12px;margin-top:24px">لإلغاء الاشتراك من هذه الإشعارات، تجاهل هذه الرسالة.</p>
        </div>`,
      })
      await prisma.backInStockSubscription.update({
        where: { id: sub.id },
        data: { notified: true, notifiedAt: new Date() },
      })
    } catch { /* email failed - don't crash */ }
  }
}

export async function backInStockRoutes(app: FastifyInstance) {

  // List subscriptions (auth)
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, productId } = request.query as { storeId?: string; productId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const subs = await prisma.backInStockSubscription.findMany({
      where: { storeId, ...(productId ? { productId } : {}) },
      include: { product: { select: { id: true, nameAr: true, slug: true, stock: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ subscriptions: subs })
  })

  // Trigger notifications for a product (after restocking)
  app.post('/notify/:productId', { preHandler: authenticate }, async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const merchantId = (request.user as any).id
    const product = await prisma.product.findFirst({ where: { id: productId, store: { merchantId } } })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    await notifyBackInStock(product.storeId, productId)
    return reply.send({ message: 'تم إرسال الإشعارات' })
  })

  // Public: subscribe to back-in-stock notification
  app.post('/public/subscribe', async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      productId: z.string().cuid(),
      variantId: z.string().cuid().optional(),
      email: z.string().email(),
      phone: z.string().optional(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, productId, variantId, email, phone } = result.data

    const product = await prisma.product.findFirst({ where: { id: productId, storeId } })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })
    if (product.stock > 0) return reply.status(400).send({ error: 'المنتج متوفر بالفعل' })

    await prisma.backInStockSubscription.upsert({
      where: { storeId_productId_email: { storeId, productId, email } },
      update: { notified: false, notifiedAt: null },
      create: { storeId, productId, variantId, email, phone },
    })

    return reply.send({ message: 'تم تسجيلك، سنُعلمك عند توفر المنتج' })
  })
}
