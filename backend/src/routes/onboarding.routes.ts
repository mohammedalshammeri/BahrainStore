import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

export async function onboardingRoutes(app: FastifyInstance) {

  // Get onboarding progress
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({
      where: { id: storeId, merchantId },
      include: { onboarding: true, settings: true, _count: { select: { products: true, orders: true } } },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Auto-detect steps
    const step1Done = !!(store.nameAr && store.logo && store.settings?.primaryColor)
    const step2Done = store._count.products > 0
    const step3Done = !!(store.logo)
    const step4Done = !!(store.settings?.tapEnabled || store.settings?.moyasarEnabled || store.settings?.benefitEnabled)
    const step5Done = !!(store.settings?.freeShippingMin !== null)

    const onboarding = store.onboarding ?? await prisma.onboarding.upsert({
      where: { storeId },
      update: {},
      create: { storeId, step1Done, step2Done, step3Done, step4Done, step5Done },
    })

    const steps = [
      { id: 1, titleAr: 'معلومات المتجر', desc: 'أضف اسم ووصف وشعار متجرك', done: step1Done },
      { id: 2, titleAr: 'أضف أول منتج', desc: 'أضف منتجاً واحداً على الأقل', done: step2Done },
      { id: 3, titleAr: 'العلامة التجارية', desc: 'ارفع شعار متجرك وأيقونته', done: step3Done },
      { id: 4, titleAr: 'طريقة الدفع', desc: 'فعّل بوابة دفع واحدة على الأقل', done: step4Done },
      { id: 5, titleAr: 'الشحن والتوصيل', desc: 'حدد إعدادات الشحن', done: step5Done },
    ]

    const completedCount = steps.filter(s => s.done).length
    const isComplete = completedCount === 5

    return reply.send({ steps, completedCount, isComplete, onboarding })
  })

  // Mark a step as done/undone manually
  app.patch('/step', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      step: z.number().int().min(1).max(5),
      done: z.boolean(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, step, done } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const field = `step${step}Done` as any

    const onboarding = await prisma.onboarding.upsert({
      where: { storeId },
      update: { [field]: done },
      create: { storeId, [field]: done },
    })
    return reply.send({ onboarding })
  })

  // Skip onboarding
  app.post('/skip', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ storeId: z.string().cuid() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId } = result.data
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.onboarding.upsert({
      where: { storeId },
      update: { skippedAt: new Date() },
      create: { storeId, skippedAt: new Date() },
    })
    return reply.send({ message: 'تم تخطي الإعداد' })
  })
}
